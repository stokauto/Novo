"""
StockAuto — Iteration 3 tests
(1) Repasse privacy locks: /api/vehicles?ad_type=repasse trap, /api/repasse/vehicles auth+plan gate
(2) Regional cleanup: sitemap has no Joao Pessoa/PB, has Campo Grande/MS
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break
if not BASE_URL:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@stockauto.com"
ADMIN_PASSWORD = "Admin@123"
DEALER_PASSWORD = "Dealer@123"

created_user_ids = []


@pytest.fixture(scope="module")
def anon():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"admin login failed: {r.status_code} {r.text[:300]}")
    return s


def _register_dealer(plan_code: str):
    s = requests.Session()
    email = f"TEST_{plan_code}_{uuid.uuid4().hex[:8]}@example.com"
    payload = {
        "email": email,
        "password": DEALER_PASSWORD,
        "store_name": f"TEST {plan_code} {uuid.uuid4().hex[:5]}",
        "phone": "(67) 99999-0000",
        "whatsapp": "5567999990000",
        "city": "Campo Grande",
        "uf": "MS",
        "address": "Rua TEST 1",
        "description": "TEST dealer",
        "plan_code": plan_code,
    }
    r = s.post(f"{API}/auth/register", json=payload, timeout=30)
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text[:300]}"
    data = r.json()
    uid = (data.get("user") or data).get("id")
    assert uid, f"no user id in register response: {data}"
    created_user_ids.append(uid)
    return s, uid, email


def _activate(admin_session, uid, plan_code):
    r = admin_session.put(f"{API}/admin/users/{uid}", json={"status": "active", "plan_code": plan_code}, timeout=30)
    assert r.status_code == 200, f"activate failed: {r.status_code} {r.text[:300]}"
    u = r.json()
    assert u["status"] == "active"
    assert u["plan_code"] == plan_code
    return u


@pytest.fixture(scope="module")
def dealer_loja(admin_session):
    s, uid, email = _register_dealer("loja")
    u = _activate(admin_session, uid, "loja")
    assert u["plan_ad_limit"] == 30, f"expected plan_ad_limit 30 for loja, got {u.get('plan_ad_limit')}"
    assert u["plan_offer_limit"] == 5, f"expected plan_offer_limit 5 for loja, got {u.get('plan_offer_limit')}"
    # refresh session cookies (status changed after login)
    s.post(f"{API}/auth/login", json={"email": email, "password": DEALER_PASSWORD}, timeout=30)
    return {"session": s, "id": uid, "email": email}


@pytest.fixture(scope="module")
def dealer_avulso(admin_session):
    s, uid, email = _register_dealer("avulso")
    _activate(admin_session, uid, "avulso")
    s.post(f"{API}/auth/login", json={"email": email, "password": DEALER_PASSWORD}, timeout=30)
    return {"session": s, "id": uid, "email": email}


@pytest.fixture(scope="module", autouse=True)
def cleanup(admin_session):
    yield
    for uid in created_user_ids:
        admin_session.delete(f"{API}/admin/users/{uid}", timeout=30)


# ---------------------------------------------------------------- privacy trap
class TestPublicListingTrap:
    def test_public_vehicles_ad_type_repasse_403(self, anon):
        r = anon.get(f"{API}/vehicles?ad_type=repasse", timeout=30)
        assert r.status_code == 403, r.text[:300]
        detail = r.json().get("detail", "")
        assert "repasse" in detail.lower()
        assert "Acesso negado" in detail

    def test_public_vehicles_ad_type_repasse_403_even_for_admin(self, admin_session):
        r = admin_session.get(f"{API}/vehicles?ad_type=repasse", timeout=30)
        assert r.status_code == 403, r.text[:300]

    def test_public_vehicles_returns_only_public(self, anon):
        r = anon.get(f"{API}/vehicles?limit=100", timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert "items" in data and isinstance(data["items"], list)
        assert isinstance(data["total"], int)
        for v in data["items"]:
            assert v.get("ad_type") != "repasse", f"repasse ad leaked in public listing: {v.get('id')}"
            assert v.get("status") == "active"

    def test_public_detail_of_repasse_vehicle_is_404(self, anon, admin_session):
        r = admin_session.get(f"{API}/admin/vehicles", timeout=30)
        assert r.status_code == 200
        vehicles = r.json()
        vehicles = vehicles if isinstance(vehicles, list) else vehicles.get("items", [])
        repasse = [v for v in vehicles if v.get("ad_type") == "repasse" and v.get("status") == "active"]
        if not repasse:
            pytest.skip("no active repasse vehicle in DB to check public detail leak")
        slug = repasse[0].get("slug") or repasse[0]["id"]
        rr = anon.get(f"{API}/vehicles/{slug}", timeout=30)
        assert rr.status_code == 404, f"repasse detail leaked publicly: {rr.status_code}"


# ------------------------------------------------------------------- repasse hub
class TestRepasseHubAccess:
    def test_anon_401(self, anon):
        r = anon.get(f"{API}/repasse/vehicles", timeout=30)
        assert r.status_code == 401, r.text[:300]

    def test_anon_detail_401(self, anon):
        r = anon.get(f"{API}/repasse/vehicles/anything", timeout=30)
        assert r.status_code == 401, r.text[:300]

    def test_dealer_avulso_403(self, dealer_avulso):
        r = dealer_avulso["session"].get(f"{API}/repasse/vehicles", timeout=30)
        assert r.status_code == 403, r.text[:300]
        detail = r.json().get("detail", "")
        assert "Loja" in detail, f"expected plan-Loja message, got: {detail}"

    def test_dealer_loja_active_200(self, dealer_loja):
        r = dealer_loja["session"].get(f"{API}/repasse/vehicles", timeout=30)
        assert r.status_code == 200, r.text[:300]
        data = r.json()
        assert "items" in data and isinstance(data["items"], list)
        for v in data["items"]:
            assert v.get("ad_type") == "repasse"
            assert v.get("status") == "active"

    def test_admin_bypass_200(self, admin_session):
        r = admin_session.get(f"{API}/repasse/vehicles", timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert isinstance(r.json().get("items"), list)

    def test_pending_loja_dealer_403(self, admin_session):
        """Dealer with plan loja but status != active must be blocked."""
        s, uid, email = _register_dealer("loja")
        r = s.get(f"{API}/repasse/vehicles", timeout=30)
        assert r.status_code == 403, r.text[:300]
        assert "liberada" in r.json().get("detail", "").lower()


# ------------------------------------------------------------ regional cleanup
class TestRegionalCleanup:
    def test_sitemap_no_joao_pessoa_has_campo_grande(self, anon):
        r = anon.get(f"{API}/sitemap.xml", timeout=30)
        assert r.status_code == 200
        xml = r.text
        assert "seminovos-joao-pessoa-pb" not in xml
        assert "joao-pessoa" not in xml.lower()
        assert "seminovos-campo-grande-ms" in xml

    def test_robots_ok(self, anon):
        r = anon.get(f"{API}/robots.txt", timeout=30)
        assert r.status_code == 200
        assert "Sitemap:" in r.text

    def test_seo_home_focused_on_ms(self, anon):
        r = anon.get(f"{API}/seo/home", timeout=30)
        assert r.status_code == 200
        body = r.text
        assert "João Pessoa" not in body and "joao-pessoa" not in body.lower()
