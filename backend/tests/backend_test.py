"""
StockAuto - Backend E2E tests
Covers: public endpoints, auth (admin + dealer), dealer CRUD, admin moderation, SEO.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback to frontend .env file
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        pass
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@stockauto.com"
ADMIN_PASSWORD = "Admin@123"


# ============================================================================
# Fixtures
# ============================================================================
@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def dealer_info():
    """Register a fresh dealer and have admin activate it."""
    email = f"TEST_dealer_{uuid.uuid4().hex[:8]}@example.com"
    password = "Dealer@123"
    payload = {
        "email": email,
        "password": password,
        "store_name": f"TEST Store {uuid.uuid4().hex[:6]}",
        "phone": "(62) 99999-0000",
        "whatsapp": "5562999990000",
        "city": "Goiânia",
        "uf": "GO",
        "address": "Rua TEST 123",
        "description": "TEST dealer",
        "plan_code": "loja",
    }
    s = requests.Session()
    r = s.post(f"{API}/auth/register", json=payload, timeout=30)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    user = r.json()
    return {"email": email, "password": password, "id": user["id"], "session": s}


@pytest.fixture(scope="module")
def active_dealer_session(dealer_info, admin_session):
    # admin activates the dealer
    r = admin_session.put(
        f"{API}/admin/users/{dealer_info['id']}",
        json={"status": "active"},
        timeout=30,
    )
    assert r.status_code == 200, f"admin activation failed: {r.status_code} {r.text}"
    # re-login as dealer to get fresh cookie
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": dealer_info["email"], "password": dealer_info["password"]}, timeout=30)
    assert r.status_code == 200
    return s, dealer_info


# ============================================================================
# Public endpoints
# ============================================================================
class TestPublic:
    def test_root(self, client):
        r = client.get(f"{API}/", timeout=30)
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_categories(self, client):
        r = client.get(f"{API}/categories", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 5
        codes = [c["code"] for c in data]
        assert "carro" in codes and "moto" in codes

    def test_settings_public(self, client):
        r = client.get(f"{API}/settings/public", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "pix_key" in d and "plans" in d
        assert isinstance(d["plans"], list) and len(d["plans"]) >= 1

    def test_vehicles_list_no_filter(self, client):
        r = client.get(f"{API}/vehicles", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "items" in d and "total" in d
        assert isinstance(d["items"], list)
        # Demo seed is optional (SEED_DEMO_DATA off in this env) — shape checks still apply
        if d["total"] == 0:
            pytest.skip("no active public vehicles in DB (SEED_DEMO_DATA disabled)")
        # _id should not leak
        for v in d["items"]:
            assert "_id" not in v
            assert v.get("status") == "active"
            assert "dealer" in v

    def test_vehicles_filter_category(self, client):
        r = client.get(f"{API}/vehicles?category=carro", timeout=30)
        assert r.status_code == 200
        for v in r.json()["items"]:
            assert v["category"] == "carro"

    def test_vehicles_filter_brand_year_price_uf(self, client):
        r = client.get(f"{API}/vehicles?brand=Toyota&year_min=2020&price_max=200000&uf=GO", timeout=30)
        assert r.status_code == 200
        for v in r.json()["items"]:
            assert v["brand"].lower() == "toyota"
            assert v["year_model"] >= 2020
            if v.get("price") is not None:
                assert v["price"] <= 200000
            assert v["uf"] == "GO"

    def test_vehicles_filter_city(self, client):
        r = client.get(f"{API}/vehicles?city=Goi%C3%A2nia", timeout=30)
        assert r.status_code == 200
        for v in r.json()["items"]:
            assert "goi" in v["city"].lower()

    def test_vehicle_detail_by_slug(self, client):
        listing = client.get(f"{API}/vehicles", timeout=30).json()
        if not listing["items"]:
            pytest.skip("no active public vehicles in DB (SEED_DEMO_DATA disabled)")
        slug = listing["items"][0]["slug"]
        r = client.get(f"{API}/vehicles/{slug}", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["slug"] == slug
        assert "dealer" in d
        assert "_id" not in d

    def test_vehicle_detail_404(self, client):
        r = client.get(f"{API}/vehicles/nonexistent-slug-xyz", timeout=30)
        assert r.status_code == 404

    def test_dealers_list(self, client):
        r = client.get(f"{API}/dealers", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert isinstance(d, list)
        if not d:
            pytest.skip("no dealers in DB (SEED_DEMO_DATA disabled)")
        for x in d:
            assert "store_name" in x and "slug" in x
            assert "active_ads" in x

    def test_dealer_detail_by_slug(self, client):
        dealers = client.get(f"{API}/dealers", timeout=30).json()
        if not dealers:
            pytest.skip("no dealers in DB (SEED_DEMO_DATA disabled)")
        slug = dealers[0]["slug"]
        r = client.get(f"{API}/dealers/{slug}", timeout=30)
        assert r.status_code == 200
        assert r.json()["slug"] == slug

    def test_dealer_detail_404(self, client):
        r = client.get(f"{API}/dealers/zzz-no-such", timeout=30)
        assert r.status_code == 404


# ============================================================================
# Auth
# ============================================================================
class TestAuth:
    def test_admin_login_sets_cookies(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert body["role"] == "admin"
        assert "password_hash" not in body
        # Cookies should be present in session jar
        names = {c.name for c in s.cookies}
        assert "access_token" in names
        assert "refresh_token" in names

    def test_login_invalid(self, client):
        r = client.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=30)
        assert r.status_code == 401

    def test_me_requires_auth(self, client):
        s = requests.Session()
        r = s.get(f"{API}/auth/me", timeout=30)
        assert r.status_code == 401

    def test_me_with_admin(self, admin_session):
        r = admin_session.get(f"{API}/auth/me", timeout=30)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_logout_clears_cookies(self):
        s = requests.Session()
        s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
        r = s.post(f"{API}/auth/logout", timeout=30)
        assert r.status_code == 200
        r2 = s.get(f"{API}/auth/me", timeout=30)
        assert r2.status_code == 401

    def test_register_creates_pending(self, dealer_info):
        # registration already done in fixture; verify status pending
        s = dealer_info["session"]
        r = s.get(f"{API}/auth/me", timeout=30)
        assert r.status_code == 200
        u = r.json()
        assert u["role"] == "dealer"
        assert u["status"] == "pending"

    def test_register_duplicate_email(self, dealer_info):
        s = requests.Session()
        r = s.post(f"{API}/auth/register", json={
            "email": dealer_info["email"],
            "password": "Dealer@123",
            "store_name": "Dup",
            "phone": "x", "whatsapp": "x",
            "city": "X", "uf": "GO",
            "plan_code": "avulso",
        }, timeout=30)
        assert r.status_code == 400


# ============================================================================
# Dealer (authenticated)
# ============================================================================
class TestDealer:
    def test_pending_cannot_create_vehicle(self, dealer_info):
        s = dealer_info["session"]
        payload = {
            "category": "carro", "brand": "TEST", "model": "X",
            "year_made": 2020, "year_model": 2021, "city": "Goiânia", "uf": "GO",
        }
        r = s.post(f"{API}/dealer/vehicles", json=payload, timeout=30)
        # status pending => 403
        assert r.status_code == 403

    def test_dealer_update_profile(self, active_dealer_session):
        s, info = active_dealer_session
        r = s.put(f"{API}/dealer/profile", json={"description": "TEST updated desc", "uf": "sp"}, timeout=30)
        assert r.status_code == 200
        body = r.json()
        assert body["description"] == "TEST updated desc"
        assert body["uf"] == "SP"

    def test_dealer_vehicles_list_empty(self, active_dealer_session):
        s, _ = active_dealer_session
        r = s.get(f"{API}/dealer/vehicles", timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_dealer_create_edit_delete_vehicle(self, active_dealer_session):
        s, info = active_dealer_session
        payload = {
            "category": "carro", "brand": "TEST-Brand", "model": "TEST-Model",
            "version": "v1", "year_made": 2020, "year_model": 2021,
            "km": 30000, "transmission": "Automático", "fuel": "Flex",
            "color": "Preto", "city": "Goiânia", "uf": "GO",
            "price": 50000.0, "description": "TEST vehicle",
            "photos": [],
        }
        r = s.post(f"{API}/dealer/vehicles", json=payload, timeout=30)
        assert r.status_code == 200, f"create failed: {r.status_code} {r.text}"
        v = r.json()
        assert v["brand"] == "TEST-Brand"
        assert v["status"] == "pending"
        assert v["dealer_id"] == info["id"]
        vid = v["id"]

        # listing should include it
        r = s.get(f"{API}/dealer/vehicles", timeout=30)
        assert any(x["id"] == vid for x in r.json())

        # edit
        payload["price"] = 45000.0
        payload["description"] = "TEST updated"
        r = s.put(f"{API}/dealer/vehicles/{vid}", json=payload, timeout=30)
        assert r.status_code == 200
        assert r.json()["price"] == 45000.0
        assert r.json()["description"] == "TEST updated"

        # delete (soft)
        r = s.delete(f"{API}/dealer/vehicles/{vid}", timeout=30)
        assert r.status_code == 200
        # verify gone from dealer list
        r = s.get(f"{API}/dealer/vehicles", timeout=30)
        assert not any(x["id"] == vid for x in r.json())

    def test_admin_cannot_use_dealer_endpoints(self, admin_session):
        r = admin_session.get(f"{API}/dealer/vehicles", timeout=30)
        assert r.status_code == 403


# ============================================================================
# Admin
# ============================================================================
class TestAdmin:
    def test_admin_users_list(self, admin_session, dealer_info):
        r = admin_session.get(f"{API}/admin/users", timeout=30)
        assert r.status_code == 200
        users = r.json()
        assert isinstance(users, list)
        assert any(u["id"] == dealer_info["id"] for u in users)

    def test_admin_users_requires_admin(self, client):
        r = client.get(f"{API}/admin/users", timeout=30)
        assert r.status_code == 401

    def test_admin_vehicles_list(self, admin_session):
        r = admin_session.get(f"{API}/admin/vehicles", timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_moderate_vehicle(self, admin_session, active_dealer_session):
        s, info = active_dealer_session
        # create a vehicle as dealer
        payload = {
            "category": "moto", "brand": "TEST-Honda", "model": "TEST-CB",
            "version": "v", "year_made": 2022, "year_model": 2022,
            "city": "Goiânia", "uf": "GO", "price": 30000.0, "photos": [],
        }
        r = s.post(f"{API}/dealer/vehicles", json=payload, timeout=30)
        assert r.status_code == 200
        vid = r.json()["id"]

        # admin approves it
        upd = {**payload, "status": "active"}
        r = admin_session.put(f"{API}/admin/vehicles/{vid}", json=upd, timeout=30)
        assert r.status_code == 200
        assert r.json()["status"] == "active"

        # now publicly visible
        r = requests.get(f"{API}/vehicles/{vid}", timeout=30)
        assert r.status_code == 200
        assert r.json()["status"] == "active"

        # cleanup
        admin_session.delete(f"{API}/admin/vehicles/{vid}", timeout=30)

    def test_admin_notifications(self, admin_session):
        r = admin_session.get(f"{API}/admin/notifications", timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_settings_get_and_update(self, admin_session):
        r = admin_session.get(f"{API}/admin/settings", timeout=30)
        assert r.status_code == 200
        orig = r.json()

        new_key = f"TEST_pix_{uuid.uuid4().hex[:6]}@pix.com"
        r = admin_session.put(f"{API}/admin/settings", json={"pix_key": new_key}, timeout=30)
        assert r.status_code == 200
        assert r.json()["pix_key"] == new_key

        # public reflects
        r = requests.get(f"{API}/settings/public", timeout=30)
        assert r.json()["pix_key"] == new_key

        # restore
        admin_session.put(f"{API}/admin/settings", json={"pix_key": orig.get("pix_key")}, timeout=30)


# ============================================================================
# Admin - NEW endpoints (stats, vehicle status, seed Campo Grande)
# ============================================================================
class TestAdminNew:
    def test_admin_stats(self, admin_session):
        r = admin_session.get(f"{API}/admin/stats", timeout=30)
        assert r.status_code == 200
        d = r.json()
        for k in ["dealers_total", "dealers_pending", "dealers_active",
                  "vehicles_total", "vehicles_active", "vehicles_pending",
                  "notifications_unread"]:
            assert k in d, f"missing key {k}"
            assert isinstance(d[k], int)

    def test_admin_stats_requires_admin(self, client):
        r = client.get(f"{API}/admin/stats", timeout=30)
        assert r.status_code == 401

    def test_admin_vehicle_status_full_cycle(self, admin_session, active_dealer_session):
        s, _ = active_dealer_session
        payload = {
            "category": "carro", "brand": "TEST-Statuscycle", "model": "M",
            "year_made": 2020, "year_model": 2021,
            "city": "Goiânia", "uf": "GO", "price": 40000.0, "photos": [],
        }
        r = s.post(f"{API}/dealer/vehicles", json=payload, timeout=30)
        assert r.status_code == 200
        vid = r.json()["id"]

        # while pending, NOT publicly accessible
        rp = requests.get(f"{API}/vehicles/{vid}", timeout=30)
        assert rp.status_code == 404, f"pending should be hidden: {rp.status_code}"

        # approve via status endpoint
        r = admin_session.put(f"{API}/admin/vehicles/{vid}/status", json={"status": "active"}, timeout=30)
        assert r.status_code == 200
        assert r.json()["status"] == "active"

        # now visible publicly
        rp = requests.get(f"{API}/vehicles/{vid}", timeout=30)
        assert rp.status_code == 200
        assert rp.json()["status"] == "active"

        # block
        r = admin_session.put(f"{API}/admin/vehicles/{vid}/status", json={"status": "blocked"}, timeout=30)
        assert r.status_code == 200
        assert r.json()["status"] == "blocked"

        # blocked => 404 publicly
        rp = requests.get(f"{API}/vehicles/{vid}", timeout=30)
        assert rp.status_code == 404

        # invalid status
        r = admin_session.put(f"{API}/admin/vehicles/{vid}/status", json={"status": "weird"}, timeout=30)
        assert r.status_code == 400

        # 404 for unknown id
        r = admin_session.put(f"{API}/admin/vehicles/nonexistent-id-xyz/status", json={"status": "active"}, timeout=30)
        assert r.status_code == 404

        # cleanup
        admin_session.delete(f"{API}/admin/vehicles/{vid}", timeout=30)

    def test_admin_vehicles_filter_by_status(self, admin_session):
        r = admin_session.get(f"{API}/admin/vehicles?status=pending", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        for v in data:
            assert v["status"] == "pending"


# ============================================================================
# Seed Campo Grande
# ============================================================================
class TestSeedCampoGrande:
    """Demo seed data (SEED_DEMO_DATA=true). Skipped when demo seeds are disabled."""

    def test_campo_grande_vehicles_count(self, client):
        r = client.get(f"{API}/vehicles?city=Campo%20Grande", timeout=30)
        assert r.status_code == 200
        items = r.json()["items"]
        if not items:
            pytest.skip("demo seed disabled (SEED_DEMO_DATA off) — no Campo Grande vehicles")
        assert len(items) >= 6, f"expected >=6 Campo Grande vehicles, got {len(items)}"
        for v in items:
            assert "campo grande" in v["city"].lower()
            assert v["uf"] == "MS"

    def test_campo_grande_dealers(self, client):
        r = client.get(f"{API}/dealers", timeout=30)
        assert r.status_code == 200
        dealers = r.json()
        names = [d["store_name"].lower() for d in dealers]
        if not any("bandeirantes" in n or "ms ve" in n for n in names):
            pytest.skip("demo seed disabled (SEED_DEMO_DATA off) — no Campo Grande seed dealers")
        assert any("bandeirantes" in n for n in names), f"Bandeirantes missing in {names}"
        assert any("ms ve" in n or "ms veículos" in n or "ms veiculos" in n for n in names), \
            f"MS Veículos missing in {names}"


# ============================================================================
# Public detail respects active-only
# ============================================================================
class TestPublicActiveOnly:
    def test_pending_vehicle_404_public(self, admin_session, active_dealer_session):
        s, _ = active_dealer_session
        r = s.post(f"{API}/dealer/vehicles", json={
            "category": "carro", "brand": "TEST-Hidden", "model": "P",
            "year_made": 2019, "year_model": 2020, "city": "Goiânia", "uf": "GO",
            "photos": [],
        }, timeout=30)
        assert r.status_code == 200
        v = r.json()
        assert v["status"] == "pending"
        # public detail by id and by slug => 404
        rp = requests.get(f"{API}/vehicles/{v['id']}", timeout=30)
        assert rp.status_code == 404
        rp = requests.get(f"{API}/vehicles/{v['slug']}", timeout=30)
        assert rp.status_code == 404
        admin_session.delete(f"{API}/admin/vehicles/{v['id']}", timeout=30)


# ============================================================================
# SEO
# ============================================================================
class TestSEO:
    def test_robots_txt(self, client):
        r = client.get(f"{API}/robots.txt", timeout=30)
        assert r.status_code == 200
        assert "User-agent" in r.text
        assert "Sitemap:" in r.text

    def test_sitemap_xml(self, client):
        r = client.get(f"{API}/sitemap.xml", timeout=30)
        assert r.status_code == 200
        assert "<urlset" in r.text
        assert "<loc>" in r.text


# ============================================================================
# Cleanup (delete created dealer)
# ============================================================================
@pytest.fixture(scope="module", autouse=True)
def _cleanup(request, dealer_info):
    def teardown():
        try:
            s = requests.Session()
            s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
            s.delete(f"{API}/admin/users/{dealer_info['id']}", timeout=30)
        except Exception:
            pass
    request.addfinalizer(teardown)
