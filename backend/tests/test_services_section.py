"""
StockAuto - Serviços (empresas prestadoras) + Landing/Sitemap tests
Covers: /api/service-categories, /api/services, /api/services/{slug},
        /api/admin/services (GET/POST/PUT/DELETE), authz, sitemap.
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
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@stockauto.com"
ADMIN_PASSWORD = "Admin@123"

EXPECTED_CODES = [
    "mecanica", "funilaria", "eletrica", "ar-condicionado", "vidracaria",
    "estetica", "pneus", "escapamento", "guincho", "seguros", "financiamento",
    "despachante", "rastreamento", "som-acessorios", "locadora", "vistoria",
]

VEHICLE_CODES = {"carro", "moto", "caminhao", "onibus", "nautico"}


@pytest.fixture(scope="module")
def client():
    return requests.Session()


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"Admin login failed {r.status_code}: {r.text[:300]}")
    assert "access_token" in s.cookies.get_dict(), "Cookie access_token não definido no login"
    return s


@pytest.fixture(scope="module")
def dealer_session():
    """Create a dealer account via /cadastro flow for 403 checks."""
    s = requests.Session()
    email = f"TEST_dealer_{uuid.uuid4().hex[:8]}@example.com"
    payload = {
        "email": email,
        "password": "Dealer@123",
        "name": "TEST Dealer Svc",
        "phone": "67999990000",
        "whatsapp": "67999990000",
        "store_name": "TEST Loja Svc",
        "city": "Campo Grande",
        "uf": "MS",
        "role": "dealer",
    }
    r = s.post(f"{API}/auth/register", json=payload, timeout=30)
    if r.status_code not in (200, 201):
        pytest.skip(f"Não foi possível registrar dealer para teste 403: {r.status_code} {r.text[:200]}")
    if "access_token" not in s.cookies.get_dict():
        lr = s.post(f"{API}/auth/login", json={"email": email, "password": "Dealer@123"}, timeout=30)
        if lr.status_code != 200:
            pytest.skip("Dealer criado mas login falhou")
    return s


@pytest.fixture(scope="module")
def created_ids():
    return []


@pytest.fixture(scope="module", autouse=True)
def cleanup(admin_session, created_ids):
    yield
    for sid in created_ids:
        admin_session.delete(f"{API}/admin/services/{sid}", timeout=30)


def _create(admin_session, created_ids, name, category="mecanica", city="Campo Grande", **extra):
    data = {"name": name, "category": category, "city": city, "uf": "MS"}
    data.update(extra)
    r = admin_session.post(f"{API}/admin/services", data=data, timeout=30)
    if r.status_code == 200:
        created_ids.append(r.json()["id"])
    return r


# ---------------------------------------------------------------- categories
class TestServiceCategories:
    def test_returns_16_isolated_categories(self, client):
        r = client.get(f"{API}/service-categories", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 16
        codes = [c["code"] for c in data]
        assert codes == EXPECTED_CODES
        assert all("label" in c for c in data)
        # isolamento: nenhuma categoria de veículo presente
        assert not VEHICLE_CODES.intersection(codes)

    def test_vehicle_categories_untouched(self, client):
        r = client.get(f"{API}/categories", timeout=30)
        assert r.status_code == 200
        codes = {c["code"] for c in r.json()}
        assert "carro" in codes
        assert "mecanica" not in codes


# ------------------------------------------------------------- public listing
class TestPublicServices:
    def test_list_only_active(self, client):
        r = client.get(f"{API}/services", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        for s in data:
            assert s.get("active") is True
            assert "_id" not in s
            assert "slug" in s and "category" in s

    def test_filter_by_category(self, admin_session, created_ids, client):
        r = _create(admin_session, created_ids, "TEST Guincho Alfa", category="guincho")
        assert r.status_code == 200, r.text
        res = client.get(f"{API}/services", params={"category": "guincho"}, timeout=30)
        assert res.status_code == 200
        names = [s["name"] for s in res.json()]
        assert "TEST Guincho Alfa" in names
        assert all(s["category"] == "guincho" for s in res.json())

    def test_filter_by_q_city_uf(self, admin_session, created_ids, client):
        r = _create(admin_session, created_ids, "TEST Busca Unica Xyz", description="especialista em turbo")
        assert r.status_code == 200
        assert any(s["name"] == "TEST Busca Unica Xyz"
                   for s in client.get(f"{API}/services", params={"q": "Unica Xyz"}, timeout=30).json())
        # busca por descrição
        assert any(s["name"] == "TEST Busca Unica Xyz"
                   for s in client.get(f"{API}/services", params={"q": "turbo"}, timeout=30).json())
        # city + uf
        res = client.get(f"{API}/services", params={"city": "Campo Grande", "uf": "ms"}, timeout=30)
        assert res.status_code == 200
        assert all(s["uf"] == "MS" for s in res.json())
        # filtro inexistente
        assert client.get(f"{API}/services", params={"city": "Cidade Inexistente ZZ"}, timeout=30).json() == []

    def test_get_by_slug_and_404(self, admin_session, created_ids, client):
        r = _create(admin_session, created_ids, "TEST Slug Publico", phone="6733334444",
                    whatsapp="67999998888", address="Rua A, 100", description="desc teste")
        assert r.status_code == 200
        created = r.json()
        slug = created["slug"]
        g = client.get(f"{API}/services/{slug}", timeout=30)
        assert g.status_code == 200
        d = g.json()
        assert d["name"] == "TEST Slug Publico"
        assert d["city"] == "Campo Grande"
        assert d["uf"] == "MS"
        assert d["phone"] == "6733334444"
        assert d["whatsapp"] == "67999998888"
        assert d["address"] == "Rua A, 100"
        assert d["description"] == "desc teste"
        assert "_id" not in d
        # também por id
        assert client.get(f"{API}/services/{created['id']}", timeout=30).status_code == 200
        # slug inexistente
        assert client.get(f"{API}/services/slug-que-nao-existe-999", timeout=30).status_code == 404

    def test_inactive_service_returns_404_and_hidden_from_list(self, admin_session, created_ids, client):
        r = _create(admin_session, created_ids, "TEST Inativa Empresa", active="false")
        assert r.status_code == 200
        s = r.json()
        assert s["active"] is False
        assert client.get(f"{API}/services/{s['slug']}", timeout=30).status_code == 404
        names = [x["name"] for x in client.get(f"{API}/services", timeout=30).json()]
        assert "TEST Inativa Empresa" not in names


# --------------------------------------------------------------- admin CRUD
class TestAdminServicesCRUD:
    def test_create_full_fields_and_persist(self, admin_session, created_ids, client):
        r = _create(admin_session, created_ids, "TEST Empresa Completa", category="estetica",
                    description="lavagem premium", phone="6730001111", whatsapp="67991112222",
                    address="Av B, 500")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["category"] == "estetica"
        assert d["slug"] == "test-empresa-completa-campo-grande"
        assert d["active"] is True
        assert d["created_at"] and d["updated_at"]
        # GET público confirma persistência
        g = client.get(f"{API}/services/{d['slug']}", timeout=30).json()
        assert g["description"] == "lavagem premium"
        assert g["id"] == d["id"]

    def test_duplicate_name_gets_suffix_2(self, admin_session, created_ids):
        base = "TEST Duplicado Slug"
        r1 = _create(admin_session, created_ids, base)
        r2 = _create(admin_session, created_ids, base)
        assert r1.status_code == 200 and r2.status_code == 200
        s1, s2 = r1.json()["slug"], r2.json()["slug"]
        assert s1 == "test-duplicado-slug-campo-grande"
        assert s2 == "test-duplicado-slug-campo-grande-2", f"esperado -2, veio {s2}"
        r3 = _create(admin_session, created_ids, base)
        assert r3.json()["slug"] == "test-duplicado-slug-campo-grande-3"

    def test_invalid_category_400(self, admin_session):
        r = admin_session.post(f"{API}/admin/services", data={
            "name": "TEST Invalida", "category": "carro", "city": "Campo Grande", "uf": "MS"}, timeout=30)
        assert r.status_code == 400
        assert "Categoria de serviço inválida" in r.text

    def test_missing_required_fields(self, admin_session):
        r = admin_session.post(f"{API}/admin/services", data={
            "name": "   ", "category": "mecanica", "city": "Campo Grande", "uf": "MS"}, timeout=30)
        assert r.status_code == 400
        r2 = admin_session.post(f"{API}/admin/services", data={"name": "TEST X"}, timeout=30)
        assert r2.status_code == 422

    def test_partial_update_keeps_other_fields(self, admin_session, created_ids, client):
        r = _create(admin_session, created_ids, "TEST Patch Empresa", phone="6711112222",
                    description="antes")
        sid = r.json()["id"]
        original_slug = r.json()["slug"]
        u = admin_session.put(f"{API}/admin/services/{sid}", data={"description": "depois"}, timeout=30)
        assert u.status_code == 200, u.text
        d = u.json()
        assert d["description"] == "depois"
        assert d["phone"] == "6711112222"
        assert d["name"] == "TEST Patch Empresa"
        assert d["slug"] == original_slug, "slug não deve mudar se nome/cidade não mudaram"
        g = client.get(f"{API}/services/{original_slug}", timeout=30).json()
        assert g["description"] == "depois"

    def test_update_regenerates_slug_on_name_change(self, admin_session, created_ids):
        r = _create(admin_session, created_ids, "TEST Nome Antigo")
        sid = r.json()["id"]
        u = admin_session.put(f"{API}/admin/services/{sid}", data={"name": "TEST Nome Novo"}, timeout=30)
        assert u.status_code == 200
        assert u.json()["slug"] == "test-nome-novo-campo-grande"

    def test_update_regenerates_slug_on_city_change(self, admin_session, created_ids):
        r = _create(admin_session, created_ids, "TEST Cidade Muda")
        sid = r.json()["id"]
        u = admin_session.put(f"{API}/admin/services/{sid}", data={"city": "Dourados"}, timeout=30)
        assert u.status_code == 200
        assert u.json()["slug"] == "test-cidade-muda-dourados"
        assert u.json()["city"] == "Dourados"

    def test_toggle_active(self, admin_session, created_ids, client):
        r = _create(admin_session, created_ids, "TEST Toggle Ativo")
        sid, slug = r.json()["id"], r.json()["slug"]
        u = admin_session.put(f"{API}/admin/services/{sid}", data={"active": "false"}, timeout=30)
        assert u.status_code == 200 and u.json()["active"] is False
        assert client.get(f"{API}/services/{slug}", timeout=30).status_code == 404
        u2 = admin_session.put(f"{API}/admin/services/{sid}", data={"active": "true"}, timeout=30)
        assert u2.json()["active"] is True
        assert client.get(f"{API}/services/{slug}", timeout=30).status_code == 200

    def test_update_invalid_category_400_and_nonexistent_404(self, admin_session, created_ids):
        r = _create(admin_session, created_ids, "TEST Update Invalida")
        sid = r.json()["id"]
        u = admin_session.put(f"{API}/admin/services/{sid}", data={"category": "nao-existe"}, timeout=30)
        assert u.status_code == 400
        assert admin_session.put(f"{API}/admin/services/{uuid.uuid4()}",
                                 data={"name": "x"}, timeout=30).status_code == 404

    def test_admin_list_includes_inactive(self, admin_session, created_ids):
        r = _create(admin_session, created_ids, "TEST Admin List Inativa", active="false")
        assert r.status_code == 200
        lst = admin_session.get(f"{API}/admin/services", timeout=30)
        assert lst.status_code == 200
        names = [s["name"] for s in lst.json()]
        assert "TEST Admin List Inativa" in names
        assert all("_id" not in s for s in lst.json())

    def test_delete_and_verify_removal(self, admin_session, client):
        r = admin_session.post(f"{API}/admin/services", data={
            "name": "TEST Para Deletar", "category": "pneus", "city": "Campo Grande", "uf": "MS"}, timeout=30)
        assert r.status_code == 200
        sid, slug = r.json()["id"], r.json()["slug"]
        d = admin_session.delete(f"{API}/admin/services/{sid}", timeout=30)
        assert d.status_code == 200 and d.json().get("ok") is True
        assert client.get(f"{API}/services/{slug}", timeout=30).status_code == 404
        assert admin_session.delete(f"{API}/admin/services/{sid}", timeout=30).status_code == 404


# ------------------------------------------------------------------- authz
class TestServicesAuthz:
    @pytest.mark.parametrize("method,path", [
        ("get", "/admin/services"),
        ("post", "/admin/services"),
        ("put", "/admin/services/any-id"),
        ("delete", "/admin/services/any-id"),
    ])
    def test_401_without_auth(self, client, method, path):
        r = getattr(client, method)(f"{API}{path}", timeout=30)
        assert r.status_code == 401, f"{method.upper()} {path} => {r.status_code}"

    @pytest.mark.parametrize("method,path", [
        ("get", "/admin/services"),
        ("put", "/admin/services/any-id"),
        ("delete", "/admin/services/any-id"),
    ])
    def test_403_for_dealer(self, dealer_session, method, path):
        r = getattr(dealer_session, method)(f"{API}{path}", timeout=30)
        assert r.status_code == 403, f"{method.upper()} {path} => {r.status_code}"

    def test_403_for_dealer_create(self, dealer_session):
        r = dealer_session.post(f"{API}/admin/services", data={
            "name": "TEST Hack", "category": "mecanica", "city": "Campo Grande", "uf": "MS"}, timeout=30)
        assert r.status_code == 403


# ------------------------------------------------------------------ sitemap
class TestSitemapAndRegression:
    def test_sitemap_includes_services_and_landing(self, admin_session, created_ids, client):
        r = _create(admin_session, created_ids, "TEST Sitemap Empresa")
        slug = r.json()["slug"]
        sm = client.get(f"{API}/sitemap.xml", timeout=60)
        assert sm.status_code == 200
        xml = sm.text
        assert "/servicos<" in xml or "/servicos</loc>" in xml
        assert "/comece-agora" in xml
        for c in EXPECTED_CODES:
            assert f"/servicos?category={c}" in xml, f"faltando categoria {c} no sitemap"
        assert f"/servicos/{slug}" in xml

    def test_legacy_public_endpoints_ok(self, client):
        for path in ["/vehicles", "/dealers", "/settings/public", "/categories", "/banners"]:
            r = client.get(f"{API}{path}", timeout=30)
            assert r.status_code == 200, f"{path} => {r.status_code}"

    def test_repasse_still_blocked_for_non_dealer(self, client):
        r = client.get(f"{API}/vehicles", params={"ad_type": "repasse"}, timeout=30)
        # público não deve receber repasse
        assert r.status_code in (200, 401, 403)
        if r.status_code == 200:
            assert all(v.get("ad_type") != "repasse" for v in r.json()), \
                "Repasse exposto para usuário não autenticado"
