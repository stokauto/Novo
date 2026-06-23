"""
StockAuto - Brazilian Vehicle Classifieds Marketplace MVP
FastAPI + MongoDB + JWT Auth + Emergent Object Storage
"""
from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import re
import io
import uuid
import bcrypt
import jwt
import logging
import unicodedata
import requests as http_requests
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File, Query, Form
from fastapi.exceptions import RequestValidationError
from fastapi.responses import PlainTextResponse, Response as FastAPIResponse, JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from PIL import Image

# ============================================================================
# CONFIG
# ============================================================================
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@stockauto.com")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin@123")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
APP_NAME = os.environ.get("APP_NAME", "stockauto")
SITE_URL = os.environ.get("SITE_URL", "").rstrip("/")
# Demo seed: criar revendedores e veículos de exemplo no startup.
# Default = false. Active manualmente com SEED_DEMO_DATA=true para testes.
SEED_DEMO_DATA = os.environ.get("SEED_DEMO_DATA", "false").lower() in {"1", "true", "yes"}
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("stockauto")

app = FastAPI(title="StockAuto API")
api = APIRouter(prefix="/api")


# ============================================================================
# PT-BR validation error handler — translates common Pydantic English messages
# ============================================================================
_PT_VALIDATION = [
    ("Input should be a valid integer, got a number with a fractional part",
     "Este campo aceita apenas números inteiros (sem casas decimais)."),
    ("Input should be a valid integer", "Informe um número inteiro válido."),
    ("Input should be a valid number, unable to parse", "Informe um número válido."),
    ("Input should be a valid number", "Informe um número válido."),
    ("Field required", "Campo obrigatório."),
    ("value is not a valid email address", "E-mail inválido."),
    ("Input should be a valid email address", "E-mail inválido."),
    ("String should have at least 1 character", "Preencha este campo."),
    ("String should have at least", "Texto muito curto."),
    ("String should have at most", "Texto muito longo."),
    ("Input should be 'public' or 'repasse'", "Tipo de anúncio inválido (use Público ou Repasse)."),
]


def _translate_validation_msg(msg: str) -> str:
    for en, pt in _PT_VALIDATION:
        if en.lower() in (msg or "").lower():
            return pt
    return msg or "Erro de validação."


_FIELD_LABELS = {
    "year_made": "Ano de fabricação",
    "year_model": "Ano modelo",
    "km": "Quilometragem",
    "price": "Preço",
    "brand": "Marca",
    "model": "Modelo",
    "city": "Cidade",
    "uf": "UF",
    "email": "E-mail",
    "password": "Senha",
    "store_name": "Nome da loja",
    "fipe_price": "Valor FIPE",
    "offer_price": "Valor da oferta",
}


@app.exception_handler(RequestValidationError)
async def pt_br_validation_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors() or []
    if not errors:
        return JSONResponse(status_code=422, content={"detail": "Dados inválidos. Verifique e tente novamente."})
    msgs = []
    for e in errors[:3]:
        loc = [x for x in e.get("loc", ()) if x != "body"]
        field_path = ".".join(str(x) for x in loc)
        label = _FIELD_LABELS.get(loc[-1] if loc else "", field_path or "campo")
        msg = _translate_validation_msg(e.get("msg", ""))
        msgs.append(f"{label}: {msg}" if label else msg)
    return JSONResponse(status_code=422, content={"detail": " • ".join(msgs)})


# ============================================================================
# HELPERS
# ============================================================================
CATEGORIES = [
    {"code": "carro", "label": "Carro"},
    {"code": "moto", "label": "Moto"},
    {"code": "camionete", "label": "Camionete"},
    {"code": "caminhao", "label": "Caminhão"},
    {"code": "onibus", "label": "Ônibus"},
    {"code": "nautico", "label": "Náutico"},
    {"code": "utilitario", "label": "Utilitário"},
    {"code": "implementos", "label": "Implementos"},
    {"code": "tratores", "label": "Tratores"},
    {"code": "outros", "label": "Outros"},
]

DEFAULT_PLANS = [
    {"code": "avulso", "name": "Avulso", "price": 29.90, "ad_limit": 1, "offer_limit": 0, "period_days": 90, "period_label": "Trimestral"},
    {"code": "loja", "name": "Loja", "price": 250.00, "ad_limit": 30, "offer_limit": 5, "period_days": 90, "period_label": "Trimestral"},
]


def slugify(text: str) -> str:
    if not text:
        return ""
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-zA-Z0-9\s-]", "", text).strip().lower()
    text = re.sub(r"[-\s]+", "-", text)
    return text


def norm_choice(s):
    """Normalize a select value (transmission/fuel) to lowercase ascii for consistent filtering."""
    if not s:
        return s
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode("ascii")
    return s.lower().strip()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(user_id: str, kind: str = "access") -> str:
    minutes = 60 * 24  # 24h access for simpler MVP UX
    if kind == "refresh":
        delta = timedelta(days=7)
    else:
        delta = timedelta(minutes=minutes)
    payload = {"sub": user_id, "type": kind, "exp": datetime.now(timezone.utc) + delta}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, user_id: str):
    access = create_token(user_id, "access")
    refresh = create_token(user_id, "refresh")
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=60 * 60 * 24, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none", max_age=60 * 60 * 24 * 7, path="/")
    return access


def clear_auth_cookies(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")


async def _user_from_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            return None
        uid = payload.get("sub")
        user = await db.users.find_one({"id": uid}, {"_id": 0, "password_hash": 0})
        return user
    except jwt.PyJWTError:
        return None


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Não autenticado")
    user = await _user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Sessão inválida ou expirada")
    return user


async def get_admin_user(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito ao administrador")
    return user


async def get_optional_user(request: Request) -> Optional[dict]:
    try:
        return await get_current_user(request)
    except HTTPException:
        return None


# ============================================================================
# OBJECT STORAGE
# ============================================================================
storage_key: Optional[str] = None


def init_storage() -> Optional[str]:
    global storage_key
    if storage_key:
        return storage_key
    if not EMERGENT_LLM_KEY:
        logger.warning("EMERGENT_LLM_KEY not set — storage disabled")
        return None
    try:
        r = http_requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
        r.raise_for_status()
        storage_key = r.json()["storage_key"]
        logger.info("Object storage initialized")
        return storage_key
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        return None


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise HTTPException(status_code=500, detail="Storage não inicializado")
    r = http_requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data,
        timeout=120,
    )
    if r.status_code == 403:
        # Re-init key once
        global storage_key
        storage_key = None
        key = init_storage()
        r = http_requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data,
            timeout=120,
        )
    r.raise_for_status()
    return r.json()


def get_object(path: str):
    key = init_storage()
    if not key:
        raise HTTPException(status_code=500, detail="Storage não inicializado")
    r = http_requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if r.status_code == 403:
        global storage_key
        storage_key = None
        key = init_storage()
        r = http_requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "application/octet-stream")


async def upload_image_to_storage(file: UploadFile, owner_id: str, watermark: bool = False) -> str:
    ext = (file.filename or "image.jpg").split(".")[-1].lower()
    if ext not in {"jpg", "jpeg", "png", "webp", "gif"}:
        ext = "jpg"
    path = f"{APP_NAME}/uploads/{owner_id}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Imagem muito grande (máx 8 MB)")
    if watermark:
        try:
            data, ext = apply_watermark(data)
            path = f"{APP_NAME}/uploads/{owner_id}/{uuid.uuid4()}.{ext}"
        except Exception as e:
            logger.warning(f"Watermark failed, uploading original: {e}")
    content_type = file.content_type or f"image/{'jpeg' if ext=='jpg' else ext}"
    if watermark:
        content_type = "image/jpeg" if ext == "jpg" else f"image/{ext}"
    result = put_object(path, data, content_type)
    return result["path"]


# ============================================================================
# WATERMARK
# ============================================================================
WATERMARK_PATH = (ROOT_DIR / "assets" / "watermark.png").resolve()
_watermark_cache: Optional[Image.Image] = None


def _get_watermark() -> Optional[Image.Image]:
    global _watermark_cache
    if _watermark_cache is not None:
        return _watermark_cache
    if not WATERMARK_PATH.exists():
        logger.warning(f"Watermark file not found at {WATERMARK_PATH}")
        return None
    wm = Image.open(WATERMARK_PATH).convert("RGBA")
    _watermark_cache = wm
    return wm


def apply_watermark(image_bytes: bytes, width_ratio: float = 0.15, opacity: float = 0.6, margin_ratio: float = 0.025) -> tuple[bytes, str]:
    """
    Aplica a marca d'água no canto inferior direito.
    - width_ratio: largura da marca relativa à largura da foto (15% por padrão)
    - opacity: opacidade da marca (0..1)
    - margin_ratio: margem relativa à largura da foto
    Retorna (bytes_jpeg, "jpg").
    """
    wm = _get_watermark()
    if wm is None:
        return image_bytes, "jpg"

    base = Image.open(io.BytesIO(image_bytes))
    # Aplica orientação EXIF se existir
    try:
        from PIL import ImageOps
        base = ImageOps.exif_transpose(base)
    except Exception:
        pass
    base = base.convert("RGB")

    target_w = max(1, int(base.width * width_ratio))
    ratio = target_w / wm.width
    target_h = max(1, int(wm.height * ratio))
    wm_resized = wm.resize((target_w, target_h), Image.LANCZOS)

    # Aplica opacidade no canal alpha
    if opacity < 1.0:
        alpha = wm_resized.split()[-1].point(lambda a: int(a * opacity))
        wm_resized.putalpha(alpha)

    margin = int(base.width * margin_ratio)
    pos = (base.width - target_w - margin, base.height - target_h - margin)

    # Composita
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    layer.paste(wm_resized, pos, wm_resized)
    out = Image.alpha_composite(base.convert("RGBA"), layer).convert("RGB")

    buf = io.BytesIO()
    out.save(buf, format="JPEG", quality=88, optimize=True, progressive=True)
    return buf.getvalue(), "jpg"


# ============================================================================
# MODELS (pydantic)
# ============================================================================
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    store_name: str
    phone: str
    whatsapp: str
    city: str
    uf: str
    address: Optional[str] = ""
    description: Optional[str] = ""
    plan_code: Literal["avulso", "loja"] = "avulso"


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class DealerUpdateIn(BaseModel):
    store_name: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    city: Optional[str] = None
    uf: Optional[str] = None
    address: Optional[str] = None
    description: Optional[str] = None


class VehicleIn(BaseModel):
    category: str
    brand: str
    model: str
    version: Optional[str] = ""
    year_made: int
    year_model: int
    km: Optional[int] = None
    transmission: Optional[str] = ""
    fuel: Optional[str] = ""
    color: Optional[str] = ""
    city: str
    uf: str
    price: Optional[float] = None  # None => "Consultar Valor". For repasse, this is the offer/repasse price.
    description: Optional[str] = ""
    photos: Optional[List[str]] = []  # storage paths
    # Repasse B2B fields ------------------------------------------------------
    ad_type: Literal["public", "repasse"] = "public"
    fipe_price: Optional[float] = None  # FIPE reference value, only used when ad_type == "repasse"
    # Offer/promotion field (public ads only) ---------------------------------
    offer_price: Optional[float] = None  # When set & < price, the card shows "OFERTA" with original riscado


class AdminUserUpdateIn(BaseModel):
    status: Optional[str] = None  # pending / active / blocked
    plan_code: Optional[str] = None
    store_name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    city: Optional[str] = None
    uf: Optional[str] = None
    address: Optional[str] = None
    description: Optional[str] = None


class AdminVehicleUpdateIn(VehicleIn):
    status: Optional[str] = None


class SettingsIn(BaseModel):
    pix_key: Optional[str] = None
    pix_holder_name: Optional[str] = None
    pix_city: Optional[str] = None
    pix_payload: Optional[str] = None
    plans: Optional[List[dict]] = None


class BannerReorderIn(BaseModel):
    order: List[str]


def public_banner(b: dict) -> dict:
    b = dict(b)
    b.pop("_id", None)
    return b


# ============================================================================
# HELPERS (DB)
# ============================================================================
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def unique_slug(collection, base: str, current_id: Optional[str] = None) -> str:
    base = base or "item"
    slug = base
    i = 2
    while True:
        q = {"slug": slug}
        if current_id:
            q["id"] = {"$ne": current_id}
        if not await collection.find_one(q):
            return slug
        slug = f"{base}-{i}"
        i += 1


def public_user(u: dict) -> dict:
    """Sanitize user doc for API output (remove password_hash, _id)."""
    u = dict(u)
    u.pop("_id", None)
    u.pop("password_hash", None)
    return u


def public_dealer_card(u: dict) -> dict:
    return {
        "id": u.get("id"),
        "slug": u.get("slug"),
        "store_name": u.get("store_name"),
        "city": u.get("city"),
        "uf": u.get("uf"),
        "phone": u.get("phone"),
        "whatsapp": u.get("whatsapp"),
        "logo_path": u.get("logo_path"),
        "cover_path": u.get("cover_path"),
        "description": u.get("description"),
        "address": u.get("address"),
    }


async def vehicle_with_dealer(v: dict) -> dict:
    v = dict(v)
    v.pop("_id", None)
    dealer = await db.users.find_one({"id": v.get("dealer_id")}, {"_id": 0, "password_hash": 0})
    v["dealer"] = public_dealer_card(dealer) if dealer else None
    return v


async def get_settings() -> dict:
    s = await db.settings.find_one({"id": "global"}, {"_id": 0})
    if not s:
        s = {
            "id": "global",
            "pix_key": "61.343.028/0001-16",
            "pix_holder_name": "Rogerio Alves",
            "pix_city": "RIO DE JANEIRO",
            "pix_payload": "00020126360014br.gov.bcb.pix0114613430280001165204000053039865802BR592561.343.028 Rogerio Alves 6014RIO DE JANEIRO62070503***63043DED",
            "plans": DEFAULT_PLANS,
        }
        await db.settings.insert_one(s)
        s.pop("_id", None)
        return s
    # Merge missing plan fields from DEFAULT_PLANS so legacy settings stay compatible
    saved_plans = s.get("plans") or []
    defaults_by_code = {p["code"]: p for p in DEFAULT_PLANS}
    merged_plans = []
    changed = False
    for plan in saved_plans:
        default = defaults_by_code.get(plan.get("code"), {})
        merged = {**default, **plan}
        if merged != plan:
            changed = True
        merged_plans.append(merged)
    # Add any new plan codes from DEFAULT_PLANS that aren't in saved settings yet
    saved_codes = {p.get("code") for p in saved_plans}
    for p in DEFAULT_PLANS:
        if p["code"] not in saved_codes:
            merged_plans.append(p)
            changed = True
    if changed:
        s["plans"] = merged_plans
        await db.settings.update_one({"id": "global"}, {"$set": {"plans": merged_plans}})
    return s


# ============================================================================
# AUTH ROUTES
# ============================================================================
@api.post("/auth/register")
async def auth_register(body: RegisterIn, response: Response):
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")
    plans = (await get_settings())["plans"]
    plan = next((p for p in plans if p["code"] == body.plan_code), plans[0])
    user_id = str(uuid.uuid4())
    slug_base = slugify(f"{body.store_name}-{body.city}")
    slug = await unique_slug(db.users, slug_base)
    user = {
        "id": user_id,
        "email": email,
        "password_hash": hash_password(body.password),
        "role": "dealer",
        "status": "pending",  # pending → active by admin
        "store_name": body.store_name,
        "slug": slug,
        "phone": body.phone,
        "whatsapp": body.whatsapp,
        "city": body.city,
        "uf": body.uf.upper(),
        "address": body.address or "",
        "description": body.description or "",
        "logo_path": None,
        "cover_path": None,
        "plan_code": plan["code"],
        "plan_name": plan["name"],
        "plan_ad_limit": plan["ad_limit"],
        "plan_price": plan["price"],
        "plan_offer_limit": plan.get("offer_limit", 0),
        "payment_provider": "pix",
        "payment_status": "pending",
        "stripe_customer_id": None,
        "stripe_subscription_id": None,
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    # Notification to admin
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "type": "new_dealer",
        "title": f"Novo revendedor: {body.store_name}",
        "body": f"{body.store_name} ({body.city}/{body.uf.upper()}) escolheu o plano {plan['name']}.",
        "user_id": user_id,
        "read": False,
        "created_at": now_iso(),
    })
    set_auth_cookies(response, user_id)
    return public_user(user)


@api.post("/auth/login")
async def auth_login(body: LoginIn, response: Response):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="E-mail ou senha inválidos")
    set_auth_cookies(response, user["id"])
    return public_user(user)


@api.post("/auth/logout")
async def auth_logout(response: Response):
    clear_auth_cookies(response)
    return {"ok": True}


@api.get("/auth/me")
async def auth_me(user: dict = Depends(get_current_user)):
    return user


# ============================================================================
# PUBLIC ROUTES
# ============================================================================
@api.get("/categories")
async def list_categories():
    return CATEGORIES


@api.get("/settings/public")
async def public_settings():
    s = await get_settings()
    return {
        "pix_key": s.get("pix_key"),
        "pix_holder_name": s.get("pix_holder_name"),
        "pix_city": s.get("pix_city"),
        "pix_payload": s.get("pix_payload"),
        "plans": s.get("plans", DEFAULT_PLANS),
    }


@api.get("/vehicles")
async def list_vehicles(
    q: Optional[str] = None,
    category: Optional[str] = None,
    brand: Optional[str] = None,
    model: Optional[str] = None,
    transmission: Optional[str] = None,
    fuel: Optional[str] = None,
    year_min: Optional[int] = None,
    year_max: Optional[int] = None,
    price_min: Optional[float] = None,
    price_max: Optional[float] = None,
    city: Optional[str] = None,
    uf: Optional[str] = None,
    dealer_id: Optional[str] = None,
    dealer_slug: Optional[str] = None,
    featured: Optional[bool] = None,
    limit: int = 30,
    skip: int = 0,
):
    # Public listing — excludes repasse (B2B) ads
    filt: dict = {"status": "active", "ad_type": {"$ne": "repasse"}}
    if category:
        filt["category"] = category
    if brand:
        filt["brand"] = {"$regex": f"^{re.escape(brand)}$", "$options": "i"}
    if model:
        filt["model"] = {"$regex": re.escape(model), "$options": "i"}
    if transmission:
        filt["transmission"] = norm_choice(transmission)
    if fuel:
        filt["fuel"] = norm_choice(fuel)
    if year_min or year_max:
        filt["year_model"] = {}
        if year_min:
            filt["year_model"]["$gte"] = year_min
        if year_max:
            filt["year_model"]["$lte"] = year_max
    if price_min or price_max:
        filt["price"] = {}
        if price_min:
            filt["price"]["$gte"] = price_min
        if price_max:
            filt["price"]["$lte"] = price_max
    if city:
        filt["city"] = {"$regex": re.escape(city), "$options": "i"}
    if uf:
        filt["uf"] = uf.upper()
    if dealer_id:
        filt["dealer_id"] = dealer_id
    if dealer_slug:
        d = await db.users.find_one({"slug": dealer_slug})
        filt["dealer_id"] = d["id"] if d else "__none__"
    if q:
        rx = re.compile(re.escape(q), re.IGNORECASE)
        filt["$or"] = [{"brand": rx}, {"model": rx}, {"version": rx}, {"description": rx}, {"city": rx}]

    cur = db.vehicles.find(filt, {"_id": 0}).sort("created_at", -1).skip(skip).limit(min(limit, 100))
    items = []
    async for v in cur:
        items.append(await vehicle_with_dealer(v))
    total = await db.vehicles.count_documents(filt)
    return {"items": items, "total": total}


@api.get("/vehicles/{slug_or_id}")
async def get_vehicle(slug_or_id: str):
    # Public detail — repasse (B2B) ads are not exposed here
    v = await db.vehicles.find_one(
        {"$or": [{"slug": slug_or_id}, {"id": slug_or_id}], "status": "active", "ad_type": {"$ne": "repasse"}},
        {"_id": 0},
    )
    if not v:
        raise HTTPException(status_code=404, detail="Anúncio não encontrado")
    return await vehicle_with_dealer(v)


# ============================================================================
# REPASSE (B2B) — restricted to authenticated dealers and admins
# ============================================================================
def require_repasse_access(user: dict):
    role = user.get("role")
    if role not in {"dealer", "admin"}:
        raise HTTPException(status_code=403, detail="Acesso restrito a revendedores")
    if role == "dealer" and user.get("status") != "active":
        raise HTTPException(status_code=403, detail="Sua conta ainda não foi liberada pelo administrador.")
    return user


@api.get("/repasse/vehicles")
async def list_repasse_vehicles(
    q: Optional[str] = None,
    category: Optional[str] = None,
    brand: Optional[str] = None,
    uf: Optional[str] = None,
    city: Optional[str] = None,
    since_hours: Optional[int] = None,
    limit: int = 60,
    skip: int = 0,
    user: dict = Depends(get_current_user),
):
    require_repasse_access(user)
    filt: dict = {"status": "active", "ad_type": "repasse"}
    if category:
        filt["category"] = category
    if brand:
        filt["brand"] = {"$regex": f"^{re.escape(brand)}$", "$options": "i"}
    if uf:
        filt["uf"] = uf.upper()
    if city:
        filt["city"] = {"$regex": re.escape(city), "$options": "i"}
    if since_hours and since_hours > 0:
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=since_hours)).isoformat()
        filt["created_at"] = {"$gte": cutoff}
    if q:
        rx = re.compile(re.escape(q), re.IGNORECASE)
        filt["$or"] = [{"brand": rx}, {"model": rx}, {"version": rx}, {"description": rx}, {"city": rx}]
    cur = db.vehicles.find(filt, {"_id": 0}).sort("created_at", -1).skip(skip).limit(min(limit, 100))
    items = []
    async for v in cur:
        items.append(await vehicle_with_dealer(v))
    total = await db.vehicles.count_documents(filt)
    return {"items": items, "total": total}


@api.get("/repasse/vehicles/{slug_or_id}")
async def get_repasse_vehicle(slug_or_id: str, user: dict = Depends(get_current_user)):
    require_repasse_access(user)
    v = await db.vehicles.find_one(
        {"$or": [{"slug": slug_or_id}, {"id": slug_or_id}], "status": "active", "ad_type": "repasse"},
        {"_id": 0},
    )
    if not v:
        raise HTTPException(status_code=404, detail="Anúncio de repasse não encontrado")
    return await vehicle_with_dealer(v)


@api.get("/dealers")
async def list_dealers(featured: Optional[bool] = None, limit: int = 30):
    filt: dict = {"role": "dealer", "status": "active"}
    cur = db.users.find(filt, {"_id": 0, "password_hash": 0}).limit(min(limit, 100))
    out = []
    async for d in cur:
        # add count of active ads
        d["active_ads"] = await db.vehicles.count_documents({"dealer_id": d["id"], "status": "active"})
        out.append(public_dealer_card({**d, "active_ads": d["active_ads"]}) | {"active_ads": d["active_ads"]})
    return out


@api.get("/dealers/{slug_or_id}")
async def get_dealer(slug_or_id: str):
    d = await db.users.find_one({"$or": [{"slug": slug_or_id}, {"id": slug_or_id}], "role": "dealer"}, {"_id": 0, "password_hash": 0})
    if not d:
        raise HTTPException(status_code=404, detail="Revendedor não encontrado")
    if d.get("status") != "active":
        raise HTTPException(status_code=404, detail="Revendedor indisponível")
    return public_dealer_card(d)


# ============================================================================
# DEALER (authenticated) ROUTES
# ============================================================================
def require_dealer(user: dict):
    if user.get("role") != "dealer":
        raise HTTPException(status_code=403, detail="Acesso de revendedor")
    return user


@api.put("/dealer/profile")
async def dealer_update_profile(body: DealerUpdateIn, user: dict = Depends(get_current_user)):
    require_dealer(user)
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if "store_name" in update or "city" in update:
        store_name = update.get("store_name", user.get("store_name"))
        city = update.get("city", user.get("city"))
        update["slug"] = await unique_slug(db.users, slugify(f"{store_name}-{city}"), current_id=user["id"])
    if "uf" in update and update["uf"]:
        update["uf"] = update["uf"].upper()
    if update:
        await db.users.update_one({"id": user["id"]}, {"$set": update})
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return fresh


@api.post("/dealer/logo")
async def dealer_upload_logo(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    require_dealer(user)
    path = await upload_image_to_storage(file, user["id"])
    await db.users.update_one({"id": user["id"]}, {"$set": {"logo_path": path}})
    return {"logo_path": path}


@api.post("/dealer/cover")
async def dealer_upload_cover(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    require_dealer(user)
    path = await upload_image_to_storage(file, user["id"])
    await db.users.update_one({"id": user["id"]}, {"$set": {"cover_path": path}})
    return {"cover_path": path}


@api.post("/dealer/uploads")
async def dealer_upload_image(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    require_dealer(user)
    path = await upload_image_to_storage(file, user["id"], watermark=True)
    return {"path": path}


@api.get("/dealer/vehicles")
async def dealer_my_vehicles(user: dict = Depends(get_current_user)):
    require_dealer(user)
    cur = db.vehicles.find({"dealer_id": user["id"], "status": {"$ne": "deleted"}}, {"_id": 0}).sort("created_at", -1)
    return [v async for v in cur]


def vehicle_slug_base(v: dict) -> str:
    return slugify(f"{v['brand']}-{v['model']}-{v.get('version','')}-{v['year_model']}-{v['city']}".strip("-"))


@api.post("/dealer/vehicles")
async def dealer_create_vehicle(body: VehicleIn, user: dict = Depends(get_current_user)):
    require_dealer(user)
    if user.get("status") != "active":
        raise HTTPException(status_code=403, detail="Sua conta ainda não foi liberada pelo administrador.")
    # Repasse-specific validations
    if body.ad_type == "repasse":
        if body.fipe_price is None or body.fipe_price <= 0:
            raise HTTPException(status_code=400, detail="Informe o Valor da Tabela FIPE para anúncios de Repasse.")
        if body.price is None or body.price <= 0:
            raise HTTPException(status_code=400, detail="Informe o Valor de Repasse/Oferta para anúncios de Repasse.")
    count = await db.vehicles.count_documents({"dealer_id": user["id"], "status": {"$in": ["active", "pending"]}})
    if count >= int(user.get("plan_ad_limit", 1)):
        raise HTTPException(status_code=400, detail=f"Limite do plano atingido ({user.get('plan_ad_limit')} anúncios).")
    # Enforce offer_limit: count current ads with offer_price set
    if body.offer_price and body.offer_price > 0:
        offer_used = await db.vehicles.count_documents({
            "dealer_id": user["id"],
            "status": {"$in": ["active", "pending"]},
            "offer_price": {"$gt": 0},
        })
        offer_max = int(user.get("plan_offer_limit", 0))
        if offer_used >= offer_max:
            raise HTTPException(
                status_code=400,
                detail=f"Seu plano permite {offer_max} {'oferta' if offer_max == 1 else 'ofertas'} em destaque. Limite atingido."
            )
    vid = str(uuid.uuid4())
    base_slug = vehicle_slug_base(body.model_dump())
    slug = await unique_slug(db.vehicles, base_slug)
    doc = body.model_dump()
    doc.update({
        "id": vid,
        "slug": slug,
        "dealer_id": user["id"],
        # Repasse B2B é auto-publicado (parceria entre lojistas, sem moderação).
        # Anúncios públicos passam por aprovação do admin.
        "status": "active" if body.ad_type == "repasse" else "pending",
        "uf": (doc.get("uf") or "").upper(),
        "main_photo": (doc.get("photos") or [None])[0],
        "created_at": now_iso(),
        "updated_at": now_iso(),
    })
    await db.vehicles.insert_one(doc)
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "type": "new_ad",
        "title": f"Novo anúncio: {doc['brand']} {doc['model']} {doc['year_model']}",
        "body": (
            f"Publicado automaticamente no Hub de Repasse — {user.get('store_name')}"
            if body.ad_type == "repasse"
            else f"Aguardando aprovação — {user.get('store_name')}"
        ),
        "vehicle_id": vid,
        "user_id": user["id"],
        "read": False,
        "created_at": now_iso(),
    })
    return await db.vehicles.find_one({"id": vid}, {"_id": 0})


@api.put("/dealer/vehicles/{vid}")
async def dealer_update_vehicle(vid: str, body: VehicleIn, user: dict = Depends(get_current_user)):
    require_dealer(user)
    v = await db.vehicles.find_one({"id": vid, "dealer_id": user["id"]})
    if not v:
        raise HTTPException(status_code=404, detail="Anúncio não encontrado")
    if body.ad_type == "repasse":
        if body.fipe_price is None or body.fipe_price <= 0:
            raise HTTPException(status_code=400, detail="Informe o Valor da Tabela FIPE para anúncios de Repasse.")
        if body.price is None or body.price <= 0:
            raise HTTPException(status_code=400, detail="Informe o Valor de Repasse/Oferta para anúncios de Repasse.")
    update = body.model_dump()
    update["uf"] = (update.get("uf") or "").upper()
    update["main_photo"] = (update.get("photos") or [None])[0]
    update["updated_at"] = now_iso()
    update["status"] = "pending"  # re-approval after edit
    update["slug"] = await unique_slug(db.vehicles, vehicle_slug_base(update), current_id=vid)
    await db.vehicles.update_one({"id": vid}, {"$set": update})
    return await db.vehicles.find_one({"id": vid}, {"_id": 0})


@api.delete("/dealer/vehicles/{vid}")
async def dealer_delete_vehicle(vid: str, user: dict = Depends(get_current_user)):
    require_dealer(user)
    res = await db.vehicles.update_one({"id": vid, "dealer_id": user["id"]}, {"$set": {"status": "deleted", "updated_at": now_iso()}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Anúncio não encontrado")
    return {"ok": True}


# ============================================================================
# ADMIN ROUTES
# ============================================================================
@api.get("/admin/users")
async def admin_users(user: dict = Depends(get_admin_user)):
    cur = db.users.find({"role": "dealer"}, {"_id": 0, "password_hash": 0}).sort("created_at", -1)
    return [u async for u in cur]


@api.put("/admin/users/{uid}")
async def admin_update_user(uid: str, body: AdminUserUpdateIn, user: dict = Depends(get_admin_user)):
    target = await db.users.find_one({"id": uid})
    if not target:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if "email" in update:
        new_email = str(update["email"]).lower().strip()
        if new_email != target.get("email") and await db.users.find_one({"email": new_email, "id": {"$ne": uid}}):
            raise HTTPException(status_code=400, detail="E-mail já cadastrado por outro usuário")
        update["email"] = new_email
    if "password" in update:
        pwd = update.pop("password")
        if pwd:
            if len(pwd) < 6:
                raise HTTPException(status_code=400, detail="A senha deve ter ao menos 6 caracteres")
            update["password_hash"] = hash_password(pwd)
    if "uf" in update and update["uf"]:
        update["uf"] = update["uf"].upper()
    if "plan_code" in update:
        plans = (await get_settings())["plans"]
        plan = next((p for p in plans if p["code"] == update["plan_code"]), None)
        if plan:
            update["plan_name"] = plan["name"]
            update["plan_ad_limit"] = plan["ad_limit"]
            update["plan_price"] = plan["price"]
            update["plan_offer_limit"] = plan.get("offer_limit", 0)
    if "store_name" in update or "city" in update:
        store_name = update.get("store_name", target.get("store_name"))
        city = update.get("city", target.get("city"))
        update["slug"] = await unique_slug(db.users, slugify(f"{store_name}-{city}"), current_id=uid)
    if update.get("status") == "active":
        update["payment_status"] = "paid"
    await db.users.update_one({"id": uid}, {"$set": update})
    return await db.users.find_one({"id": uid}, {"_id": 0, "password_hash": 0})


@api.delete("/admin/users/{uid}")
async def admin_delete_user(uid: str, user: dict = Depends(get_admin_user)):
    await db.users.delete_one({"id": uid, "role": "dealer"})
    await db.vehicles.update_many({"dealer_id": uid}, {"$set": {"status": "deleted"}})
    return {"ok": True}


@api.get("/admin/vehicles")
async def admin_vehicles(
    status: Optional[str] = None,
    ad_type: Optional[str] = None,
    user: dict = Depends(get_admin_user),
):
    filt: dict = {}
    if status:
        filt["status"] = status
    if ad_type:
        filt["ad_type"] = ad_type
    cur = db.vehicles.find(filt, {"_id": 0}).sort("created_at", -1)
    out = []
    async for v in cur:
        out.append(await vehicle_with_dealer(v))
    return out


@api.put("/admin/vehicles/{vid}")
async def admin_update_vehicle(vid: str, body: AdminVehicleUpdateIn, user: dict = Depends(get_admin_user)):
    v = await db.vehicles.find_one({"id": vid})
    if not v:
        raise HTTPException(status_code=404, detail="Anúncio não encontrado")
    update = {k: val for k, val in body.model_dump().items() if val is not None}
    if "uf" in update and update["uf"]:
        update["uf"] = update["uf"].upper()
    if "photos" in update:
        update["main_photo"] = (update.get("photos") or [None])[0]
    update["updated_at"] = now_iso()
    if "brand" in update or "model" in update or "city" in update or "year_model" in update:
        merged = {**v, **update}
        update["slug"] = await unique_slug(db.vehicles, vehicle_slug_base(merged), current_id=vid)
    await db.vehicles.update_one({"id": vid}, {"$set": update})
    return await db.vehicles.find_one({"id": vid}, {"_id": 0})


@api.delete("/admin/vehicles/{vid}")
async def admin_delete_vehicle(vid: str, user: dict = Depends(get_admin_user)):
    await db.vehicles.update_one({"id": vid}, {"$set": {"status": "deleted"}})
    return {"ok": True}


@api.get("/admin/notifications")
async def admin_notifications(user: dict = Depends(get_admin_user)):
    cur = db.notifications.find({}, {"_id": 0}).sort("created_at", -1).limit(100)
    return [n async for n in cur]


@api.put("/admin/notifications/{nid}/read")
async def admin_mark_notification(nid: str, user: dict = Depends(get_admin_user)):
    await db.notifications.update_one({"id": nid}, {"$set": {"read": True}})
    return {"ok": True}


@api.get("/admin/settings")
async def admin_get_settings(user: dict = Depends(get_admin_user)):
    return await get_settings()


@api.put("/admin/settings")
async def admin_update_settings(body: SettingsIn, user: dict = Depends(get_admin_user)):
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    await db.settings.update_one({"id": "global"}, {"$set": update}, upsert=True)
    # Cascade plan changes (ad_limit / offer_limit / price / name) to existing dealers
    if "plans" in update and isinstance(update["plans"], list):
        for plan in update["plans"]:
            code = plan.get("code")
            if not code:
                continue
            await db.users.update_many(
                {"role": "dealer", "plan_code": code},
                {"$set": {
                    "plan_name": plan.get("name"),
                    "plan_ad_limit": int(plan.get("ad_limit", 1)),
                    "plan_price": float(plan.get("price", 0)),
                    "plan_offer_limit": int(plan.get("offer_limit", 0)),
                }}
            )
    return await get_settings()


@api.get("/admin/stats")
async def admin_stats(user: dict = Depends(get_admin_user)):
    return {
        "dealers_total": await db.users.count_documents({"role": "dealer"}),
        "dealers_pending": await db.users.count_documents({"role": "dealer", "status": "pending"}),
        "dealers_active": await db.users.count_documents({"role": "dealer", "status": "active"}),
        "dealers_blocked": await db.users.count_documents({"role": "dealer", "status": "blocked"}),
        "vehicles_total": await db.vehicles.count_documents({"status": {"$ne": "deleted"}}),
        "vehicles_active": await db.vehicles.count_documents({"status": "active"}),
        "vehicles_pending": await db.vehicles.count_documents({"status": "pending"}),
        "repasse_active": await db.vehicles.count_documents({"status": "active", "ad_type": "repasse"}),
        "repasse_pending": await db.vehicles.count_documents({"status": "pending", "ad_type": "repasse"}),
        "notifications_unread": await db.notifications.count_documents({"read": False}),
    }


class VehicleStatusIn(BaseModel):
    status: str


@api.put("/admin/vehicles/{vid}/status")
async def admin_set_vehicle_status(vid: str, body: VehicleStatusIn, user: dict = Depends(get_admin_user)):
    allowed = {"active", "pending", "blocked", "paused"}
    if body.status not in allowed:
        raise HTTPException(status_code=400, detail="Status inválido")
    res = await db.vehicles.update_one({"id": vid}, {"$set": {"status": body.status, "updated_at": now_iso()}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Anúncio não encontrado")
    return await db.vehicles.find_one({"id": vid}, {"_id": 0})


# ============================================================================
# FILES (public read)
# ============================================================================
@api.get("/files/{path:path}")
async def serve_file(path: str):
    try:
        data, ctype = get_object(path)
    except http_requests.HTTPError as e:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado") from e
    return FastAPIResponse(content=data, media_type=ctype, headers={"Cache-Control": "public, max-age=86400"})


# ============================================================================
# BANNERS (home carousel) — public read + admin CRUD
# ============================================================================
@api.get("/banners")
async def public_banners():
    cur = db.banners.find({"active": True}, {"_id": 0}).sort("position", 1)
    return [b async for b in cur]


@api.get("/admin/banners")
async def admin_list_banners(user: dict = Depends(get_admin_user)):
    cur = db.banners.find({}, {"_id": 0}).sort("position", 1)
    return [b async for b in cur]


@api.post("/admin/banners")
async def admin_create_banner(
    image_desktop: UploadFile = File(...),
    image_mobile: Optional[UploadFile] = File(None),
    link_url: str = Form(...),
    alt: str = Form(""),
    active: str = Form("true"),
    user: dict = Depends(get_admin_user),
):
    desktop_path = await upload_image_to_storage(image_desktop, user["id"])
    mobile_path = await upload_image_to_storage(image_mobile, user["id"]) if image_mobile else None
    last = await db.banners.find_one({}, sort=[("position", -1)])
    position = (last["position"] + 1) if last else 1
    doc = {
        "id": str(uuid.uuid4()),
        "image_desktop_path": desktop_path,
        "image_mobile_path": mobile_path,
        "link_url": link_url.strip(),
        "alt": alt.strip(),
        "active": str(active).lower() in ("1", "true", "on", "yes"),
        "position": position,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.banners.insert_one(doc)
    return public_banner(doc)


@api.put("/admin/banners/reorder")
async def admin_reorder_banners(body: BannerReorderIn, user: dict = Depends(get_admin_user)):
    for idx, bid in enumerate(body.order):
        await db.banners.update_one({"id": bid}, {"$set": {"position": idx + 1, "updated_at": now_iso()}})
    return {"ok": True}


@api.put("/admin/banners/{bid}")
async def admin_update_banner(
    bid: str,
    image_desktop: Optional[UploadFile] = File(None),
    image_mobile: Optional[UploadFile] = File(None),
    link_url: Optional[str] = Form(None),
    alt: Optional[str] = Form(None),
    active: Optional[str] = Form(None),
    user: dict = Depends(get_admin_user),
):
    b = await db.banners.find_one({"id": bid})
    if not b:
        raise HTTPException(status_code=404, detail="Banner não encontrado")
    update: dict = {"updated_at": now_iso()}
    if image_desktop is not None:
        update["image_desktop_path"] = await upload_image_to_storage(image_desktop, user["id"])
    if image_mobile is not None:
        update["image_mobile_path"] = await upload_image_to_storage(image_mobile, user["id"])
    if link_url is not None:
        update["link_url"] = link_url.strip()
    if alt is not None:
        update["alt"] = alt.strip()
    if active is not None:
        update["active"] = str(active).lower() in ("1", "true", "on", "yes")
    await db.banners.update_one({"id": bid}, {"$set": update})
    return public_banner(await db.banners.find_one({"id": bid}, {"_id": 0}))


@api.delete("/admin/banners/{bid}")
async def admin_delete_banner(bid: str, user: dict = Depends(get_admin_user)):
    res = await db.banners.delete_one({"id": bid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Banner não encontrado")
    return {"ok": True}


# ============================================================================
# SEO: sitemap.xml + robots.txt
# ============================================================================
def _site_base(request: Request) -> str:
    """Canonical public site URL. Uses SITE_URL env var when set (recommended for production),
    falls back to the request origin (useful in dev)."""
    if SITE_URL:
        return SITE_URL
    return str(request.base_url).rstrip("/")


@api.get("/robots.txt", response_class=PlainTextResponse)
async def robots_txt(request: Request):
    base = _site_base(request)
    return (
        "User-agent: *\n"
        "Allow: /\n"
        "Disallow: /painel\n"
        "Disallow: /admin\n"
        "Disallow: /api/dealer/\n"
        "Disallow: /api/admin/\n"
        f"Sitemap: {base}/api/sitemap.xml\n"
        f"Sitemap: {base}/sitemap.xml\n"
    )


@api.get("/sitemap.xml")
async def sitemap_xml(request: Request):
    base = _site_base(request)
    today = datetime.now(timezone.utc).date().isoformat()

    # Coleta URLs com lastmod e prioridade
    entries: list[tuple[str, str, str, str]] = []  # (loc, lastmod, changefreq, priority)
    entries.append((f"{base}/", today, "daily", "1.0"))
    entries.append((f"{base}/veiculos", today, "daily", "0.9"))
    entries.append((f"{base}/revendedores", today, "weekly", "0.8"))
    entries.append((f"{base}/cadastro", today, "monthly", "0.5"))

    # Categorias (filtros da listagem)
    for c in CATEGORIES:
        entries.append((f"{base}/veiculos?category={c['code']}", today, "daily", "0.7"))

    # Veículos ativos (excluindo Repasse — B2B fica fora do índice público)
    async for v in db.vehicles.find(
        {"status": "active", "ad_type": {"$ne": "repasse"}},
        {"slug": 1, "updated_at": 1, "_id": 0},
    ).limit(5000):
        lastmod = (v.get("updated_at") or today).split("T")[0]
        entries.append((f"{base}/veiculo/{v['slug']}", lastmod, "weekly", "0.8"))

    # Revendedores ativos
    async for d in db.users.find({"role": "dealer", "status": "active"}, {"slug": 1, "_id": 0}).limit(2000):
        if d.get("slug"):
            entries.append((f"{base}/revendedor/{d['slug']}", today, "weekly", "0.7"))

    body = ['<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for loc, lastmod, changefreq, priority in entries:
        body.append(
            "  <url>"
            f"<loc>{loc}</loc>"
            f"<lastmod>{lastmod}</lastmod>"
            f"<changefreq>{changefreq}</changefreq>"
            f"<priority>{priority}</priority>"
            "</url>"
        )
    body.append("</urlset>")
    return FastAPIResponse(content="\n".join(body), media_type="application/xml")


# Schema.org JSON-LD payloads consumed by the frontend pages via fetch.
@api.get("/seo/home")
async def seo_home(request: Request):
    base = _site_base(request)
    vehicles_count = await db.vehicles.count_documents({"status": "active"})
    dealers_count = await db.users.count_documents({"role": "dealer", "status": "active"})
    return {
        "site_url": base,
        "vehicles_count": vehicles_count,
        "dealers_count": dealers_count,
    }


# ============================================================================
# HEALTH
# ============================================================================
@api.get("/")
async def root():
    return {"app": "StockAuto", "ok": True}


# ============================================================================
# SEED + STARTUP
# ============================================================================
SEED_PHOTOS = {
    "carro": [
        "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200",
        "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=1200",
        "https://images.unsplash.com/photo-1542362567-b07e54358753?w=1200",
        "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=1200",
        "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=1200",
        "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=1200",
    ],
    "moto": [
        "https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=1200",
        "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=1200",
    ],
    "camionete": [
        "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=1200",
        "https://images.unsplash.com/photo-1606016159991-dfe4f2746ad5?w=1200",
    ],
    "caminhao": [
        "https://images.unsplash.com/photo-1592805144716-feeccccef5ac?w=1200",
    ],
    "utilitario": [
        "https://images.unsplash.com/photo-1612544448445-b8232cff3b6c?w=1200",
    ],
}


SEED_VEHICLES = [
    {"category": "carro", "brand": "Toyota", "model": "Corolla", "version": "XEi 2.0", "year_made": 2020, "year_model": 2021, "km": 45000, "transmission": "Automático", "fuel": "Flex", "color": "Prata", "city": "Goiânia", "uf": "GO", "price": 119900.00, "description": "Único dono, revisões na concessionária, todos os opcionais."},
    {"category": "carro", "brand": "Honda", "model": "Civic", "version": "EXL", "year_made": 2019, "year_model": 2019, "km": 62000, "transmission": "CVT", "fuel": "Flex", "color": "Preto", "city": "Goiânia", "uf": "GO", "price": 109500.00, "description": "Carro impecável, segundo dono."},
    {"category": "carro", "brand": "Volkswagen", "model": "T-Cross", "version": "Highline 1.4 TSI", "year_made": 2022, "year_model": 2023, "km": 22000, "transmission": "Automático", "fuel": "Flex", "color": "Branco", "city": "São Paulo", "uf": "SP", "price": 149900.00, "description": "Garantia de fábrica, multimídia."},
    {"category": "carro", "brand": "Jeep", "model": "Compass", "version": "Longitude Diesel 4x4", "year_made": 2021, "year_model": 2022, "km": 38000, "transmission": "Automático", "fuel": "Diesel", "color": "Cinza", "city": "São Paulo", "uf": "SP", "price": None, "description": "Diesel 4x4, completíssimo. Aceita troca."},
    {"category": "carro", "brand": "Fiat", "model": "Argo", "version": "Drive 1.3", "year_made": 2021, "year_model": 2021, "km": 31000, "transmission": "Manual", "fuel": "Flex", "color": "Vermelho", "city": "Belo Horizonte", "uf": "MG", "price": 67900.00, "description": "Econômico, ideal para o dia a dia."},
    {"category": "camionete", "brand": "Toyota", "model": "Hilux", "version": "SRX 2.8 4x4", "year_made": 2020, "year_model": 2021, "km": 78000, "transmission": "Automático", "fuel": "Diesel", "color": "Branco", "city": "Belo Horizonte", "uf": "MG", "price": 289900.00, "description": "Diesel automática, top de linha."},
    {"category": "camionete", "brand": "Ford", "model": "Ranger", "version": "XLT 3.2", "year_made": 2019, "year_model": 2019, "km": 95000, "transmission": "Automático", "fuel": "Diesel", "color": "Preto", "city": "Goiânia", "uf": "GO", "price": None, "description": "Couro, multimídia, revisada."},
    {"category": "moto", "brand": "Honda", "model": "CB 500F", "version": "ABS", "year_made": 2022, "year_model": 2022, "km": 8000, "transmission": "Manual", "fuel": "Gasolina", "color": "Vermelho", "city": "São Paulo", "uf": "SP", "price": 38900.00, "description": "Pouquíssimo rodada."},
    {"category": "moto", "brand": "Yamaha", "model": "MT-07", "version": "ABS", "year_made": 2021, "year_model": 2021, "km": 14000, "transmission": "Manual", "fuel": "Gasolina", "color": "Azul", "city": "Belo Horizonte", "uf": "MG", "price": 49500.00, "description": "Esportiva, revisões em dia."},
    {"category": "caminhao", "brand": "Mercedes-Benz", "model": "Actros 2651", "version": "6x4", "year_made": 2018, "year_model": 2018, "km": 480000, "transmission": "Automatizado", "fuel": "Diesel", "color": "Branco", "city": "Goiânia", "uf": "GO", "price": None, "description": "Cavalo mecânico, pronto para trabalho pesado."},
    {"category": "utilitario", "brand": "Fiat", "model": "Fiorino", "version": "Endurance", "year_made": 2022, "year_model": 2022, "km": 38000, "transmission": "Manual", "fuel": "Flex", "color": "Branco", "city": "São Paulo", "uf": "SP", "price": 89900.00, "description": "Ideal para entregas, revisada."},
    {"category": "carro", "brand": "Chevrolet", "model": "Onix", "version": "LTZ Turbo", "year_made": 2023, "year_model": 2024, "km": 12000, "transmission": "Automático", "fuel": "Flex", "color": "Cinza", "city": "Belo Horizonte", "uf": "MG", "price": 99900.00, "description": "Praticamente zero, IPVA pago."},
]


async def seed_demo():
    if await db.vehicles.count_documents({}) > 0:
        logger.info("Seed: vehicles já existem, pulando.")
        return
    dealers_seed = [
        {"email": "contato@autocentersilva.com", "store_name": "Auto Center Silva", "city": "Goiânia", "uf": "GO", "phone": "(62) 3333-1111", "whatsapp": "5562999991111", "address": "Av. T-7, 1000 - Setor Bueno", "description": "Há mais de 20 anos no mercado de Goiânia, oferecendo veículos seminovos selecionados."},
        {"email": "vendas@premiummotors.com", "store_name": "Premium Motors", "city": "São Paulo", "uf": "SP", "phone": "(11) 4002-8922", "whatsapp": "5511999992222", "address": "Av. Paulista, 2200 - Bela Vista", "description": "Especialista em veículos premium e seminovos com garantia."},
        {"email": "atendimento@garagemnacional.com", "store_name": "Garagem Nacional", "city": "Belo Horizonte", "uf": "MG", "phone": "(31) 3777-2233", "whatsapp": "5531999993333", "address": "Av. do Contorno, 5000 - Funcionários", "description": "Estoque variado, financiamento facilitado e troca aceita."},
    ]
    dealer_ids = []
    for d in dealers_seed:
        uid = str(uuid.uuid4())
        slug = await unique_slug(db.users, slugify(f"{d['store_name']}-{d['city']}"))
        user = {
            "id": uid,
            "email": d["email"],
            "password_hash": hash_password("Dealer@123"),
            "role": "dealer",
            "status": "active",
            "store_name": d["store_name"],
            "slug": slug,
            "phone": d["phone"],
            "whatsapp": d["whatsapp"],
            "city": d["city"],
            "uf": d["uf"],
            "address": d["address"],
            "description": d["description"],
            "logo_path": None,
            "cover_path": None,
            "plan_code": "loja",
            "plan_name": "Loja",
            "plan_ad_limit": 30,
            "plan_price": 129.90,
            "payment_provider": "pix",
            "payment_status": "paid",
            "stripe_customer_id": None,
            "stripe_subscription_id": None,
            "created_at": now_iso(),
        }
        await db.users.insert_one(user)
        dealer_ids.append(uid)
    # Vehicles round-robin
    for idx, vraw in enumerate(SEED_VEHICLES):
        dealer_id = dealer_ids[idx % len(dealer_ids)]
        photos = SEED_PHOTOS.get(vraw["category"], SEED_PHOTOS["carro"])
        v = dict(vraw)
        v.update({
            "id": str(uuid.uuid4()),
            "slug": await unique_slug(db.vehicles, vehicle_slug_base(v)),
            "dealer_id": dealer_id,
            "status": "active",
            "photos": photos[: 3 + (idx % 3)],
            "main_photo": photos[0],
            "created_at": now_iso(),
            "updated_at": now_iso(),
        })
        await db.vehicles.insert_one(v)
    logger.info(f"Seed: criados {len(dealer_ids)} revendedores e {len(SEED_VEHICLES)} anúncios")


async def seed_admin():
    existing = await db.users.find_one({"email": ADMIN_EMAIL})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": ADMIN_EMAIL,
            "password_hash": hash_password(ADMIN_PASSWORD),
            "role": "admin",
            "status": "active",
            "store_name": "Administrador",
            "slug": "admin",
            "created_at": now_iso(),
        })
        logger.info("Admin seeded")
    elif not verify_password(ADMIN_PASSWORD, existing.get("password_hash", "")):
        await db.users.update_one({"email": ADMIN_EMAIL}, {"$set": {"password_hash": hash_password(ADMIN_PASSWORD)}})


# ---------------------------------------------------------------------------
# Campo Grande - MS seed (idempotent) — gives the marketplace real local
# inventory so the local-SEO popular searches return results.
# ---------------------------------------------------------------------------
CG_DEALERS = [
    {"email": "vendas@bandeirantesmotors.com", "store_name": "Bandeirantes Motors", "city": "Campo Grande", "uf": "MS", "phone": "(67) 3321-4500", "whatsapp": "5567999990001", "address": "Av. Bandeirantes, 1500 - Centro", "description": "Tradição em Campo Grande há mais de 15 anos. Seminovos revisados com procedência, na Avenida Bandeirantes."},
    {"email": "contato@msveiculospremium.com", "store_name": "MS Veículos Premium", "city": "Campo Grande", "uf": "MS", "phone": "(67) 3025-7800", "whatsapp": "5567999990002", "address": "Av. Afonso Pena, 3000 - Jardim dos Estados", "description": "Os melhores carros e camionetes da capital sul-mato-grossense, com garantia e troca facilitada."},
]

CG_VEHICLES = [
    {"category": "carro", "brand": "Toyota", "model": "Corolla Cross", "version": "XRE 2.0", "year_made": 2022, "year_model": 2023, "km": 28000, "transmission": "Automático", "fuel": "Flex", "color": "Branco", "price": 169900.00, "description": "SUV completo, único dono, revisões na concessionária de Campo Grande."},
    {"category": "camionete", "brand": "Chevrolet", "model": "S10", "version": "LTZ 2.8 4x4", "year_made": 2021, "year_model": 2022, "km": 54000, "transmission": "Automático", "fuel": "Diesel", "color": "Prata", "price": 219900.00, "description": "Diesel 4x4, couro, multimídia. Pronta para o trabalho e a estrada."},
    {"category": "moto", "brand": "Honda", "model": "CG 160", "version": "Titan", "year_made": 2023, "year_model": 2023, "km": 6000, "transmission": "Manual", "fuel": "Flex", "color": "Vermelho", "price": 16900.00, "description": "Seminova, econômica, ideal para o dia a dia em Campo Grande."},
    {"category": "carro", "brand": "Volkswagen", "model": "Nivus", "version": "Highline 200 TSI", "year_made": 2022, "year_model": 2022, "km": 31000, "transmission": "Automático", "fuel": "Flex", "color": "Cinza", "price": 129900.00, "description": "SUV cupê, multimídia VW Play, garantia de fábrica."},
    {"category": "camionete", "brand": "Fiat", "model": "Toro", "version": "Volcano 2.0 Diesel", "year_made": 2021, "year_model": 2021, "km": 62000, "transmission": "Automático", "fuel": "Diesel", "color": "Preto", "price": None, "description": "Diesel automática 4x4, aceita troca. Consulte condições."},
    {"category": "carro", "brand": "Hyundai", "model": "HB20", "version": "Vision 1.0", "year_made": 2022, "year_model": 2022, "km": 24000, "transmission": "Manual", "fuel": "Flex", "color": "Branco", "price": 74900.00, "description": "Econômico, IPVA pago, revisado. Excelente custo-benefício."},
]


async def seed_campo_grande():
    if await db.users.find_one({"email": CG_DEALERS[0]["email"]}):
        logger.info("Seed: Campo Grande já existe, pulando.")
        return
    dealer_ids = []
    for d in CG_DEALERS:
        uid = str(uuid.uuid4())
        slug = await unique_slug(db.users, slugify(f"{d['store_name']}-{d['city']}"))
        await db.users.insert_one({
            "id": uid, "email": d["email"], "password_hash": hash_password("Dealer@123"),
            "role": "dealer", "status": "active", "store_name": d["store_name"], "slug": slug,
            "phone": d["phone"], "whatsapp": d["whatsapp"], "city": d["city"], "uf": d["uf"],
            "address": d["address"], "description": d["description"], "logo_path": None, "cover_path": None,
            "plan_code": "loja", "plan_name": "Loja", "plan_ad_limit": 30, "plan_price": 129.90,
            "payment_provider": "pix", "payment_status": "paid", "stripe_customer_id": None,
            "stripe_subscription_id": None, "created_at": now_iso(),
        })
        dealer_ids.append(uid)
    for idx, vraw in enumerate(CG_VEHICLES):
        dealer_id = dealer_ids[idx % len(dealer_ids)]
        photos = SEED_PHOTOS.get(vraw["category"], SEED_PHOTOS["carro"])
        v = dict(vraw)
        v["city"], v["uf"] = "Campo Grande", "MS"
        v.update({
            "id": str(uuid.uuid4()),
            "slug": await unique_slug(db.vehicles, vehicle_slug_base(v)),
            "dealer_id": dealer_id, "status": "active",
            "photos": photos[: 3 + (idx % 3)], "main_photo": photos[0],
            "created_at": now_iso(), "updated_at": now_iso(),
        })
        await db.vehicles.insert_one(v)
    logger.info("Seed: Campo Grande — 2 revendedores e 6 anúncios criados")


async def normalize_vehicle_choices():
    """One-time data hygiene: normalize transmission/fuel to lowercase ascii so filters match."""
    async for v in db.vehicles.find({}, {"id": 1, "transmission": 1, "fuel": 1, "_id": 0}):
        upd = {}
        t = norm_choice(v.get("transmission"))
        f = norm_choice(v.get("fuel"))
        if t is not None and t != v.get("transmission"):
            upd["transmission"] = t
        if f is not None and f != v.get("fuel"):
            upd["fuel"] = f
        if upd:
            await db.vehicles.update_one({"id": v["id"]}, {"$set": upd})


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("slug")
    await db.vehicles.create_index("slug")
    await db.vehicles.create_index("dealer_id")
    await db.vehicles.create_index([("category", 1), ("uf", 1)])
    init_storage()
    await seed_admin()  # Admin é necessário para login, sempre executado
    # Migration: sincroniza plan_ad_limit + plan_offer_limit dos dealers com a config atual dos planos.
    # Resolve casos onde o admin trocou o plano antes de uma atualização da app.
    settings = await get_settings()
    for plan in settings.get("plans", DEFAULT_PLANS):
        await db.users.update_many(
            {"role": "dealer", "plan_code": plan["code"]},
            {"$set": {
                "plan_name": plan["name"],
                "plan_ad_limit": plan["ad_limit"],
                "plan_price": plan["price"],
                "plan_offer_limit": plan.get("offer_limit", 0),
            }}
        )
    # Demo seeds (revendedores fictícios + veículos de exemplo) só rodam quando
    # SEED_DEMO_DATA=true no .env. Em produção fica off para preservar dados reais.
    if SEED_DEMO_DATA:
        logger.info("SEED_DEMO_DATA=true — populating demo dealers + vehicles")
        await seed_demo()
        await seed_campo_grande()
    else:
        logger.info("SEED_DEMO_DATA off — skipping demo seeds (production behavior)")
    await normalize_vehicle_choices()
    await get_settings()


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


# Mount router + CORS
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)
