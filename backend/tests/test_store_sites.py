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

    def test_query_param_sub_works(self, admin_session, dealer):
        """
        The path-based route `/loja/:subdomain` calls the backend with
        `?sub=<subdomain>` (no header). Backend must accept this as an
        equivalent override — same isolation guarantees apply.
        """
        sub = f"qs-{uuid.uuid4().hex[:6]}"
        admin_session.post(f"{API}/admin/store-sites",
                           json={"dealer_id": dealer["id"], "subdomain": sub})

        r = requests.get(f"{API}/public/store-site", params={"sub": sub})
        assert r.status_code == 200
        body = r.json()
        assert body["site"]["subdomain"] == sub
        assert body["dealer"]["id"] == dealer["id"]

    def test_query_param_sub_invalid_returns_404(self, admin_session):
        # Reserved/invalid subdomains must be rejected, mirroring header handling.
        r = requests.get(f"{API}/public/store-site", params={"sub": "www"})
        assert r.status_code == 404
        r = requests.get(f"{API}/public/store-site", params={"sub": "nope-not-a-real-store"})
        assert r.status_code == 404

    def test_query_param_sub_isolation(self, admin_session, dealer):
        """
        Cross-tenant isolation with the `?sub=` path — creating a second
        dealer's vehicle and querying dealer A's site must never return B's stock.
        """
        subA = f"iso-a-{uuid.uuid4().hex[:6]}"
        admin_session.post(f"{API}/admin/store-sites",
                           json={"dealer_id": dealer["id"], "subdomain": subA})

        # A's vehicle
        rA = dealer["session"].post(f"{API}/dealer/vehicles", json={
            "category": "carro", "brand": "Fiat", "model": "Palio",
            "year_made": 2019, "year_model": 2020, "km": 30000,
            "price": 42000, "city": "Campo Grande", "uf": "MS", "ad_type": "public",
        })
        vidA = rA.json()["id"]
        admin_session.put(f"{API}/admin/vehicles/{vidA}/status", json={"status": "active"})

        # Dealer B — different owner, different subdomain
        emailB = f"wl-iso-b-{uuid.uuid4().hex[:8]}@test.com"
        sB = requests.Session()
        rB_reg = sB.post(f"{API}/auth/register", json={
            "email": emailB, "password": "Test@1234",
            "store_name": f"Iso B {uuid.uuid4().hex[:6]}",
            "phone": "(67) 3000-0000", "whatsapp": "(67) 99000-2222",
            "city": "Campo Grande", "uf": "MS", "plan_code": "loja",
        })
        assert rB_reg.status_code == 200
        idB = rB_reg.json()["id"]
        admin_session.put(f"{API}/admin/users/{idB}", json={"status": "active"})
        sB2 = requests.Session()
        sB2.post(f"{API}/auth/login", json={"email": emailB, "password": "Test@1234"})
        rB = sB2.post(f"{API}/dealer/vehicles", json={
            "category": "carro", "brand": "Fiat", "model": "Palio",
            "year_made": 2019, "year_model": 2020, "km": 15000,
            "price": 39000, "city": "Campo Grande", "uf": "MS", "ad_type": "public",
        })
        vidB = rB.json()["id"]
        admin_session.put(f"{API}/admin/vehicles/{vidB}/status", json={"status": "active"})

        try:
            # 1) Listing via ?sub=subA → only A's stock
            r = requests.get(f"{API}/public/store-site", params={"sub": subA})
            assert r.status_code == 200
            for v in r.json()["vehicles"]:
                assert v["dealer_id"] == dealer["id"], "cross-tenant leak via ?sub="

            # 2) Vehicle detail: A tries to fetch B's slug scoped to subA → 404
            #    (find B's slug from admin listing)
            vB = admin_session.get(f"{API}/admin/vehicles").json()
            vB_slug = next(x.get("slug") for x in (vB if isinstance(vB, list) else vB.get("items", [])) if x.get("id") == vidB)
            r = requests.get(
                f"{API}/public/store-site/vehicle/{vB_slug}",
                params={"sub": subA},
            )
            assert r.status_code == 404, "B's vehicle should never appear under subA"

            # 3) Vehicle detail: A's slug scoped to subA → 200
            vA = admin_session.get(f"{API}/admin/vehicles").json()
            vA_slug = next(x.get("slug") for x in (vA if isinstance(vA, list) else vA.get("items", [])) if x.get("id") == vidA)
            r = requests.get(
                f"{API}/public/store-site/vehicle/{vA_slug}",
                params={"sub": subA},
            )
            assert r.status_code == 200
            assert r.json()["vehicle"]["dealer_id"] == dealer["id"]
        finally:
            admin_session.delete(f"{API}/admin/users/{idB}")

    def test_query_param_sub_precedence(self, admin_session, dealer):
        """
        When both `?sub=` and `X-StockAuto-Subdomain` are provided, the
        query param wins (path-based route is more explicit).
        """
        sub = f"prec-{uuid.uuid4().hex[:6]}"
        admin_session.post(f"{API}/admin/store-sites",
                           json={"dealer_id": dealer["id"], "subdomain": sub})

        r = requests.get(
            f"{API}/public/store-site",
            params={"sub": sub},
            headers={"X-StockAuto-Subdomain": "www"},  # would be invalid on its own
        )
        assert r.status_code == 200
        assert r.json()["site"]["subdomain"] == sub

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

    def test_filters_and_sort_scoped_to_dealer(self, admin_session, dealer):
        """
        The public store-site endpoint accepts search filters + sort, but
        MUST enforce dealer_id isolation regardless of what the caller sends.
        This test creates 2 dealers with distinct stock and verifies that:
          - filters do not leak vehicles from another dealer,
          - the km_max / sort params work as documented,
          - the response includes the `total` field.
        """
        # Dealer A (from fixture)
        subA = f"filta-{uuid.uuid4().hex[:6]}"
        admin_session.post(f"{API}/admin/store-sites",
                           json={"dealer_id": dealer["id"], "subdomain": subA})

        # Create 2 A-vehicles with different km/price
        for payload in [
            {"category": "carro", "brand": "Fiat", "model": "Palio",
             "year_made": 2019, "year_model": 2020, "km": 30000,
             "price": 42000, "city": "Campo Grande", "uf": "MS", "ad_type": "public"},
            {"category": "carro", "brand": "Fiat", "model": "Argo",
             "year_made": 2021, "year_model": 2022, "km": 120000,
             "price": 65000, "city": "Campo Grande", "uf": "MS", "ad_type": "public"},
        ]:
            r = dealer["session"].post(f"{API}/dealer/vehicles", json=payload)
            vid = r.json()["id"]
            admin_session.put(f"{API}/admin/vehicles/{vid}/status", json={"status": "active"})

        # Dealer B — different owner, different subdomain
        emailB = f"wl-b-{uuid.uuid4().hex[:8]}@test.com"
        sB = requests.Session()
        rB_reg = sB.post(f"{API}/auth/register", json={
            "email": emailB, "password": "Test@1234",
            "store_name": f"WL Store B {uuid.uuid4().hex[:6]}",
            "phone": "(67) 3000-0000", "whatsapp": "(67) 99000-0001",
            "city": "Campo Grande", "uf": "MS", "plan_code": "loja",
        })
        assert rB_reg.status_code == 200
        idB = rB_reg.json()["id"]
        admin_session.put(f"{API}/admin/users/{idB}", json={"status": "active"})
        sB2 = requests.Session()
        sB2.post(f"{API}/auth/login", json={"email": emailB, "password": "Test@1234"})

        subB = f"filtb-{uuid.uuid4().hex[:6]}"
        admin_session.post(f"{API}/admin/store-sites",
                           json={"dealer_id": idB, "subdomain": subB})
        rB = sB2.post(f"{API}/dealer/vehicles", json={
            "category": "carro", "brand": "Fiat", "model": "Palio",
            "year_made": 2019, "year_model": 2020, "km": 15000,
            "price": 39000, "city": "Campo Grande", "uf": "MS", "ad_type": "public",
        })
        vidB = rB.json()["id"]
        admin_session.put(f"{API}/admin/vehicles/{vidB}/status", json={"status": "active"})

        try:
            # 1) Filter brand=Fiat on A — must return only A's Fiats
            r = requests.get(f"{API}/public/store-site",
                             params={"brand": "Fiat"},
                             headers={"X-StockAuto-Subdomain": subA})
            assert r.status_code == 200
            body = r.json()
            assert "total" in body
            for v in body["vehicles"]:
                assert v["dealer_id"] == dealer["id"]
                assert v["brand"].lower() == "fiat"

            # 2) km_max=50000 on A — must only keep the low-km vehicle
            r = requests.get(f"{API}/public/store-site",
                             params={"km_max": 50000},
                             headers={"X-StockAuto-Subdomain": subA})
            assert r.status_code == 200
            vs = r.json()["vehicles"]
            assert all(v["dealer_id"] == dealer["id"] for v in vs)
            assert all(v.get("km", 0) <= 50000 for v in vs)

            # 3) sort=preco_asc must return prices ascending
            r = requests.get(f"{API}/public/store-site",
                             params={"sort": "preco_asc"},
                             headers={"X-StockAuto-Subdomain": subA})
            assert r.status_code == 200
            prices = [v["price"] for v in r.json()["vehicles"] if v.get("price") is not None]
            if len(prices) >= 2:
                assert prices == sorted(prices)

            # 4) Isolation: even with model=Palio (matches both dealers)
            # subA MUST NOT return B's Palio.
            r = requests.get(f"{API}/public/store-site",
                             params={"model": "Palio"},
                             headers={"X-StockAuto-Subdomain": subA})
            for v in r.json()["vehicles"]:
                assert v["dealer_id"] == dealer["id"], "dealer isolation violated"

            # 5) Unknown sort silently falls back to recentes
            r = requests.get(f"{API}/public/store-site",
                             params={"sort": "garbage"},
                             headers={"X-StockAuto-Subdomain": subA})
            assert r.status_code == 200
        finally:
            admin_session.delete(f"{API}/admin/users/{idB}")


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


class TestPublicVehicleEndpoint:
    """
    GET /public/store-site/vehicle/{slug}

    Ensures the tenant-scoped vehicle endpoint:
      - returns the vehicle when it belongs to the tenant's dealer;
      - returns 404 when the vehicle belongs to a different dealer;
      - returns 404 for inactive vehicles;
      - returns 404 for non-existent slugs;
      - never modifies data.
    Also verifies that the main portal endpoint (/vehicles/{slug}) keeps
    working exactly as before.
    """

    def _publish(self, admin_session, dealer, brand="Fiat", model="Uno"):
        r = dealer["session"].post(f"{API}/dealer/vehicles", json={
            "category": "carro", "brand": brand, "model": model,
            "year_made": 2021, "year_model": 2022, "km": 30000, "price": 55000,
            "city": "Campo Grande", "uf": "MS", "ad_type": "public",
        })
        assert r.status_code == 200
        payload = r.json()
        vid = payload["id"]
        # Approve so it becomes active + reachable publicly
        admin_session.put(f"{API}/admin/vehicles/{vid}/status", json={"status": "active"})
        # Re-read to get slug + latest status
        v = requests.get(f"{API}/vehicles/{vid}").json()
        return v

    def _create_site(self, admin_session, dealer_id, sub):
        r = admin_session.post(f"{API}/admin/store-sites", json={
            "dealer_id": dealer_id, "subdomain": sub
        })
        assert r.status_code == 200, r.text

    def test_returns_vehicle_when_owned_by_site_dealer(self, admin_session, dealer):
        sub = f"vsite-{uuid.uuid4().hex[:6]}"
        self._create_site(admin_session, dealer["id"], sub)
        v = self._publish(admin_session, dealer, brand="Honda", model="Civic")

        r = requests.get(
            f"{API}/public/store-site/vehicle/{v['slug']}",
            headers={"X-StockAuto-Subdomain": sub},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["site"]["subdomain"] == sub
        assert body["dealer"]["id"] == dealer["id"]
        assert body["vehicle"]["id"] == v["id"]
        assert body["vehicle"]["brand"] == "Honda"
        # Public shape — never leaks admin-only fields.
        assert "password_hash" not in str(body)

    def test_returns_404_when_vehicle_belongs_to_another_store(self, admin_session, dealer):
        """Vehicle from dealer A must NOT be reachable through dealer B's site."""
        # Site for dealer A
        subA = f"a-{uuid.uuid4().hex[:6]}"
        self._create_site(admin_session, dealer["id"], subA)
        vA = self._publish(admin_session, dealer, brand="Ford", model="Ka")

        # Different dealer B with its own site
        emailB = f"other-{uuid.uuid4().hex[:8]}@test.com"
        rB = requests.post(f"{API}/auth/register", json={
            "email": emailB, "password": "Test@1234",
            "store_name": "B Store", "phone": "(67) 3000-0000",
            "whatsapp": "(67) 99000-0000", "city": "Campo Grande", "uf": "MS",
            "plan_code": "loja",
        })
        idB = rB.json()["id"]
        admin_session.put(f"{API}/admin/users/{idB}", json={"status": "active"})
        subB = f"b-{uuid.uuid4().hex[:6]}"
        self._create_site(admin_session, idB, subB)

        try:
            # Requesting via B's subdomain must NOT return A's vehicle.
            r = requests.get(
                f"{API}/public/store-site/vehicle/{vA['slug']}",
                headers={"X-StockAuto-Subdomain": subB},
            )
            assert r.status_code == 404
        finally:
            admin_session.delete(f"{API}/admin/users/{idB}")

    def test_returns_404_for_inactive_vehicle(self, admin_session, dealer):
        sub = f"inactive-v-{uuid.uuid4().hex[:6]}"
        self._create_site(admin_session, dealer["id"], sub)
        v = self._publish(admin_session, dealer, brand="Toyota", model="Etios")

        # Flip status back to pending
        admin_session.put(f"{API}/admin/vehicles/{v['id']}/status", json={"status": "pending"})

        r = requests.get(
            f"{API}/public/store-site/vehicle/{v['slug']}",
            headers={"X-StockAuto-Subdomain": sub},
        )
        assert r.status_code == 404

    def test_returns_404_for_missing_slug(self, admin_session, dealer):
        sub = f"missing-{uuid.uuid4().hex[:6]}"
        self._create_site(admin_session, dealer["id"], sub)
        r = requests.get(
            f"{API}/public/store-site/vehicle/nao-existe-slug",
            headers={"X-StockAuto-Subdomain": sub},
        )
        assert r.status_code == 404

    def test_returns_404_when_site_inactive(self, admin_session, dealer):
        sub = f"si-{uuid.uuid4().hex[:6]}"
        self._create_site(admin_session, dealer["id"], sub)
        v = self._publish(admin_session, dealer, brand="VW", model="Gol")

        admin_session.patch(f"{API}/admin/store-sites/{dealer['id']}/status",
                            json={"site_active": False})

        r = requests.get(
            f"{API}/public/store-site/vehicle/{v['slug']}",
            headers={"X-StockAuto-Subdomain": sub},
        )
        assert r.status_code == 404

    def test_main_portal_endpoint_still_works(self, admin_session, dealer):
        """Regression guard: the existing public endpoint must NOT change."""
        v = self._publish(admin_session, dealer, brand="Chevrolet", model="Onix")
        r = requests.get(f"{API}/vehicles/{v['slug']}")
        assert r.status_code == 200
        body = r.json()
        assert body["id"] == v["id"]
        assert body["brand"] == "Chevrolet"
        assert body.get("dealer") is not None


class TestBrandingUploads:
    """
    POST /admin/store-sites/{dealer_id}/{logo|cover|favicon}

    Validates admin-only uploads for site identity assets and confirms the
    resulting paths are surfaced by the public tenant endpoint.
    """
    def _create_site(self, admin_session, dealer_id, sub):
        r = admin_session.post(f"{API}/admin/store-sites",
                               json={"dealer_id": dealer_id, "subdomain": sub})
        assert r.status_code == 200

    def _png_bytes(self):
        # Minimal 1x1 transparent PNG
        return (
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00"
            b"\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9c"
            b"c\xf8\x0f\x00\x00\x01\x01\x00\x01\x5c\xcd\xff\x69\x00\x00\x00"
            b"\x00IEND\xaeB`\x82"
        )

    def _ico_bytes(self):
        # Minimal valid ICO header + one 1x1 entry (fake content data — kept
        # short; the server only checks extension, size and non-empty).
        return b"\x00\x00\x01\x00\x01\x00\x01\x01\x00\x00\x01\x00\x18\x00\x1c\x00\x00\x00\x16\x00\x00\x00" + b"\x00" * 40

    def test_upload_requires_admin(self, dealer):
        r = dealer["session"].post(
            f"{API}/admin/store-sites/{dealer['id']}/logo",
            files={"file": ("l.png", self._png_bytes(), "image/png")},
        )
        assert r.status_code == 403

    def test_upload_requires_auth(self, dealer):
        r = requests.post(
            f"{API}/admin/store-sites/{dealer['id']}/logo",
            files={"file": ("l.png", self._png_bytes(), "image/png")},
        )
        assert r.status_code == 401

    def test_upload_404_for_missing_dealer(self, admin_session):
        r = admin_session.post(
            f"{API}/admin/store-sites/does-not-exist/logo",
            files={"file": ("l.png", self._png_bytes(), "image/png")},
        )
        assert r.status_code == 404

    def test_upload_404_when_site_missing(self, admin_session, dealer):
        # dealer exists but has no site yet
        r = admin_session.post(
            f"{API}/admin/store-sites/{dealer['id']}/logo",
            files={"file": ("l.png", self._png_bytes(), "image/png")},
        )
        assert r.status_code == 404

    def test_upload_rejects_invalid_extension(self, admin_session, dealer):
        sub = f"br-{uuid.uuid4().hex[:6]}"
        self._create_site(admin_session, dealer["id"], sub)
        for name, mime in (("evil.exe", "application/octet-stream"),
                           ("hack.php", "application/x-httpd-php"),
                           ("shell.sh", "application/x-sh")):
            r = admin_session.post(
                f"{API}/admin/store-sites/{dealer['id']}/logo",
                files={"file": (name, b"malicious", mime)},
            )
            assert r.status_code == 400, f"Expected 400 for {name}"

    def test_upload_rejects_empty_file(self, admin_session, dealer):
        sub = f"empty-{uuid.uuid4().hex[:6]}"
        self._create_site(admin_session, dealer["id"], sub)
        r = admin_session.post(
            f"{API}/admin/store-sites/{dealer['id']}/logo",
            files={"file": ("empty.png", b"", "image/png")},
        )
        assert r.status_code == 400

    def test_favicon_accepts_ico_but_logo_rejects_it(self, admin_session, dealer):
        sub = f"ico-{uuid.uuid4().hex[:6]}"
        self._create_site(admin_session, dealer["id"], sub)
        ico = self._ico_bytes()
        # Favicon endpoint accepts .ico
        r = admin_session.post(
            f"{API}/admin/store-sites/{dealer['id']}/favicon",
            files={"file": ("f.ico", ico, "image/x-icon")},
        )
        assert r.status_code == 200
        # Logo endpoint rejects .ico (branding uses raster only)
        r = admin_session.post(
            f"{API}/admin/store-sites/{dealer['id']}/logo",
            files={"file": ("l.ico", ico, "image/x-icon")},
        )
        assert r.status_code == 400

    def test_upload_updates_all_three_fields(self, admin_session, dealer):
        sub = f"all-{uuid.uuid4().hex[:6]}"
        self._create_site(admin_session, dealer["id"], sub)
        png = self._png_bytes()

        # Logo
        r = admin_session.post(
            f"{API}/admin/store-sites/{dealer['id']}/logo",
            files={"file": ("l.png", png, "image/png")},
        )
        assert r.status_code == 200
        assert r.json()["path"].startswith("stockauto/uploads/")
        assert "site-logo-" in r.json()["path"]
        assert r.json()["site"]["logo_path"] == r.json()["path"]

        # Cover
        r = admin_session.post(
            f"{API}/admin/store-sites/{dealer['id']}/cover",
            files={"file": ("c.png", png, "image/png")},
        )
        assert r.status_code == 200
        assert "site-cover-" in r.json()["path"]
        assert r.json()["site"]["cover_path"] == r.json()["path"]

        # Favicon
        r = admin_session.post(
            f"{API}/admin/store-sites/{dealer['id']}/favicon",
            files={"file": ("f.png", png, "image/png")},
        )
        assert r.status_code == 200
        assert "site-favicon-" in r.json()["path"]
        assert r.json()["site"]["favicon_path"] == r.json()["path"]

        # Public tenant endpoint MUST surface the three paths.
        r = requests.get(f"{API}/public/store-site",
                         headers={"X-StockAuto-Subdomain": sub})
        assert r.status_code == 200
        site = r.json()["site"]
        assert site["logo_path"] and "site-logo-" in site["logo_path"]
        assert site["cover_path"] and "site-cover-" in site["cover_path"]
        assert site["favicon_path"] and "site-favicon-" in site["favicon_path"]

    def test_public_endpoint_works_without_uploaded_assets(self, admin_session, dealer):
        """Sites without uploaded branding must keep working (fallback)."""
        sub = f"noassets-{uuid.uuid4().hex[:6]}"
        self._create_site(admin_session, dealer["id"], sub)
        r = requests.get(f"{API}/public/store-site",
                         headers={"X-StockAuto-Subdomain": sub})
        assert r.status_code == 200
        site = r.json()["site"]
        # None values are expected — the frontend renders the fallback UI.
        assert site["logo_path"] is None
        assert site["cover_path"] is None
        assert site["favicon_path"] is None
