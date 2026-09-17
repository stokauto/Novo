"""
Backend integration tests for white-label store sites.

Covers: admin CRUD, subdomain validation, reserved words, uniqueness by
subdomain and dealer, public tenant endpoint via X-StockAuto-Subdomain
header, correct vehicle scoping.
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


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={
        "email": "admin@stockauto.com", "password": "Admin@123",
    })
    assert r.status_code == 200
    return s


@pytest.fixture()
def dealer(admin_session):
    """Registers, approves and returns an active dealer (id + session)."""
    email = f"wl-{uuid.uuid4().hex[:8]}@test.com"
    s = requests.Session()
    r = s.post(f"{API}/auth/register", json={
        "email": email, "password": "Test@1234",
        "store_name": f"WL Store {uuid.uuid4().hex[:6]}",
        "phone": "(67) 3000-0000", "whatsapp": "(67) 99000-0000",
        "city": "Campo Grande", "uf": "MS", "plan_code": "loja",
    })
    assert r.status_code == 200
    dealer_id = r.json()["id"]
    admin_session.put(f"{API}/admin/users/{dealer_id}", json={"status": "active"})
    s2 = requests.Session()
    r = s2.post(f"{API}/auth/login", json={"email": email, "password": "Test@1234"})
    assert r.status_code == 200
    yield {"id": dealer_id, "email": email, "session": s2}
    admin_session.delete(f"{API}/admin/users/{dealer_id}")


class TestAuthorization:
    def test_create_requires_auth(self):
        r = requests.post(f"{API}/admin/store-sites", json={
            "dealer_id": "x", "subdomain": "abc"
        })
        assert r.status_code == 401

    def test_dealer_cannot_create(self, dealer):
        r = dealer["session"].post(f"{API}/admin/store-sites", json={
            "dealer_id": dealer["id"], "subdomain": "some-store"
        })
        assert r.status_code == 403


class TestSubdomainValidation:
    def _create(self, admin_session, dealer_id, sub):
        return admin_session.post(f"{API}/admin/store-sites", json={
            "dealer_id": dealer_id, "subdomain": sub,
        })

    def test_reserved_words_rejected(self, admin_session, dealer):
        for reserved in ("www", "admin", "api", "app", "stockauto"):
            r = self._create(admin_session, dealer["id"], reserved)
            assert r.status_code == 400
            assert "reservado" in r.json()["detail"].lower()

    def test_invalid_characters_rejected(self, admin_session, dealer):
        for bad in ("Auto Silva", "auto.silva", "auto_silva", "-autosilva",
                    "autosilva-", "a", ""):
            r = self._create(admin_session, dealer["id"], bad)
            assert r.status_code == 400, f"Expected 400 for {bad!r}"

    def test_valid_subdomain_accepted(self, admin_session, dealer):
        sub = f"loja-{uuid.uuid4().hex[:6]}"
        r = self._create(admin_session, dealer["id"], sub)
        assert r.status_code == 200
        assert r.json()["subdomain"] == sub


class TestCrudFlow:
    def test_full_crud(self, admin_session, dealer):
        sub = f"crud-{uuid.uuid4().hex[:6]}"

        # CREATE
        r = admin_session.post(f"{API}/admin/store-sites", json={
            "dealer_id": dealer["id"], "subdomain": sub,
            "primary_color": "#123456", "secondary_color": "#654321",
            "about_text": "Sobre a loja.",
        })
        assert r.status_code == 200
        site = r.json()
        assert site["subdomain"] == sub
        assert site["primary_color"] == "#123456"
        assert site["site_active"] is True

        # LIST
        r = admin_session.get(f"{API}/admin/store-sites")
        assert r.status_code == 200
        assert any(s["dealer_id"] == dealer["id"] for s in r.json())

        # GET
        r = admin_session.get(f"{API}/admin/store-sites/{dealer['id']}")
        assert r.status_code == 200
        assert r.json()["subdomain"] == sub

        # UPDATE
        r = admin_session.put(f"{API}/admin/store-sites/{dealer['id']}", json={
            "primary_color": "#abcdef", "about_text": "Novo texto."
        })
        assert r.status_code == 200
        assert r.json()["primary_color"] == "#abcdef"
        assert r.json()["about_text"] == "Novo texto."
        # Existing fields not touched
        assert r.json()["subdomain"] == sub

        # PATCH status
        r = admin_session.patch(f"{API}/admin/store-sites/{dealer['id']}/status",
                                json={"site_active": False})
        assert r.status_code == 200
        assert r.json()["site_active"] is False

        # Re-enable
        r = admin_session.patch(f"{API}/admin/store-sites/{dealer['id']}/status",
                                json={"site_active": True})
        assert r.status_code == 200


class TestUniqueness:
    def test_duplicate_dealer_rejected(self, admin_session, dealer):
        s1 = f"dup1-{uuid.uuid4().hex[:6]}"
        s2 = f"dup2-{uuid.uuid4().hex[:6]}"
        r1 = admin_session.post(f"{API}/admin/store-sites",
                                json={"dealer_id": dealer["id"], "subdomain": s1})
        assert r1.status_code == 200
        r2 = admin_session.post(f"{API}/admin/store-sites",
                                json={"dealer_id": dealer["id"], "subdomain": s2})
        assert r2.status_code == 409

    def test_duplicate_subdomain_rejected(self, admin_session):
        """Two different dealers can't share the same subdomain."""
        sub = f"shared-{uuid.uuid4().hex[:6]}"
        # Create dealer A
        emailA = f"a-{uuid.uuid4().hex[:8]}@test.com"
        rA = requests.post(f"{API}/auth/register", json={
            "email": emailA, "password": "Test@1234",
            "store_name": "A", "phone": "(67) 3000-0000",
            "whatsapp": "(67) 99000-0000", "city": "Campo Grande", "uf": "MS",
            "plan_code": "loja",
        })
        idA = rA.json()["id"]
        admin_session.put(f"{API}/admin/users/{idA}", json={"status": "active"})

        emailB = f"b-{uuid.uuid4().hex[:8]}@test.com"
        rB = requests.post(f"{API}/auth/register", json={
            "email": emailB, "password": "Test@1234",
            "store_name": "B", "phone": "(67) 3000-0000",
            "whatsapp": "(67) 99000-0000", "city": "Campo Grande", "uf": "MS",
            "plan_code": "loja",
        })
        idB = rB.json()["id"]
        admin_session.put(f"{API}/admin/users/{idB}", json={"status": "active"})

        try:
            r1 = admin_session.post(f"{API}/admin/store-sites",
                                    json={"dealer_id": idA, "subdomain": sub})
            assert r1.status_code == 200
            r2 = admin_session.post(f"{API}/admin/store-sites",
                                    json={"dealer_id": idB, "subdomain": sub})
            assert r2.status_code == 409
        finally:
            admin_session.delete(f"{API}/admin/users/{idA}")
            admin_session.delete(f"{API}/admin/users/{idB}")


class TestPublicEndpoint:
    def test_missing_subdomain_returns_404(self):
        # No Host header suffix, no override → primary → the endpoint has no site.
        r = requests.get(f"{API}/public/store-site")
        assert r.status_code == 404

    def test_dev_override_header_works(self, admin_session, dealer):
        sub = f"pub-{uuid.uuid4().hex[:6]}"
        admin_session.post(f"{API}/admin/store-sites",
                           json={"dealer_id": dealer["id"], "subdomain": sub})

        r = requests.get(f"{API}/public/store-site",
                         headers={"X-StockAuto-Subdomain": sub})
        assert r.status_code == 200
        body = r.json()
        assert body["site"]["subdomain"] == sub
        assert body["dealer"]["id"] == dealer["id"]
        assert "vehicles" in body
        # public shape must not leak private/admin-only fields
        assert "password_hash" not in body["dealer"]

    def test_inactive_site_returns_404(self, admin_session, dealer):
        sub = f"inactive-{uuid.uuid4().hex[:6]}"
        admin_session.post(f"{API}/admin/store-sites",
                           json={"dealer_id": dealer["id"], "subdomain": sub})
        admin_session.patch(f"{API}/admin/store-sites/{dealer['id']}/status",
                            json={"site_active": False})

        r = requests.get(f"{API}/public/store-site",
                         headers={"X-StockAuto-Subdomain": sub})
        assert r.status_code == 404

    def test_vehicles_scoped_to_dealer(self, admin_session, dealer):
        sub = f"scope-{uuid.uuid4().hex[:6]}"
        admin_session.post(f"{API}/admin/store-sites",
                           json={"dealer_id": dealer["id"], "subdomain": sub})

        # Create 1 active + 1 repasse vehicle from this dealer
        r = dealer["session"].post(f"{API}/dealer/vehicles", json={
            "category": "carro", "brand": "Fiat", "model": "Uno",
            "year_made": 2020, "year_model": 2021, "km": 50000, "price": 45000,
            "city": "Campo Grande", "uf": "MS", "ad_type": "public",
        })
        vid = r.json()["id"]
        admin_session.put(f"{API}/admin/vehicles/{vid}/status",
                          json={"status": "active"})

        # A repasse ad — must NOT appear in the tenant listing
        dealer["session"].post(f"{API}/dealer/vehicles", json={
            "category": "carro", "brand": "Toyota", "model": "Corolla",
            "year_made": 2020, "year_model": 2021, "km": 40000,
            "price": 80000, "fipe_price": 90000,
            "city": "Campo Grande", "uf": "MS", "ad_type": "repasse",
        })

        r = requests.get(f"{API}/public/store-site",
                         headers={"X-StockAuto-Subdomain": sub})
        assert r.status_code == 200
        vs = r.json()["vehicles"]
        # All vehicles must belong to this dealer AND be non-repasse.
        for v in vs:
            assert v["dealer_id"] == dealer["id"]
            assert v.get("ad_type") != "repasse"


class TestResolver:
    def test_primary_host_ignored(self):
        """Requests to www.stockauto.com.br must not be treated as tenant."""
        from store_sites import resolve_host
        assert resolve_host("www.stockauto.com.br")["kind"] == "primary"
        assert resolve_host("stockauto.com.br")["kind"] == "primary"
        assert resolve_host("localhost:3000")["kind"] == "primary"

    def test_tenant_host_resolved(self):
        from store_sites import resolve_host
        r = resolve_host("autosilva.stockauto.com.br")
        assert r == {"kind": "tenant", "subdomain": "autosilva"}
        r = resolve_host("loja-nova.stockauto.com.br")
        assert r == {"kind": "tenant", "subdomain": "loja-nova"}

    def test_reserved_subdomain_in_host_returns_unknown(self):
        from store_sites import resolve_host
        assert resolve_host("admin.stockauto.com.br")["kind"] == "unknown"
