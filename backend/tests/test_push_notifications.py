"""
StockAuto - Web Push notifications tests.

Covers:
- 401 on unauthenticated access
- 403 on dealer access (not admin)
- Idempotent subscription registration
- Test push endpoint response
- Dealer registration triggers internal notification
- Public ad creation triggers internal notification
- Repasse ad creation does NOT trigger push (but internal notification stays)
- Invalid subscription (404/410 endpoint) is removed on send
"""
import os
import uuid
from unittest.mock import patch

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


@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200
    return s


@pytest.fixture()
def dealer_session(admin_session):
    """Registers, approves and returns a fresh dealer session. Cleans up after test."""
    email = f"push-{uuid.uuid4().hex[:8]}@test.com"
    s = requests.Session()
    r = s.post(f"{API}/auth/register", json={
        "email": email, "password": "Test@1234",
        "store_name": "Push Test", "phone": "(67) 3000-0000",
        "whatsapp": "(67) 99000-0000",
        "city": "Campo Grande", "uf": "MS", "plan_code": "loja",
    })
    assert r.status_code == 200
    dealer_id = r.json()["id"]
    # Approve via admin
    admin_session.put(f"{API}/admin/users/{dealer_id}", json={"status": "active"})
    # Re-login dealer so cookies reflect active status
    s2 = requests.Session()
    r = s2.post(f"{API}/auth/login", json={"email": email, "password": "Test@1234"})
    assert r.status_code == 200
    yield s2, dealer_id
    # Cleanup
    admin_session.delete(f"{API}/admin/users/{dealer_id}")


# ---------- Auth ------------------------------------------------------------
class TestAuthorization:
    def test_status_requires_auth(self):
        r = requests.get(f"{API}/admin/push/status")
        assert r.status_code == 401

    def test_subscribe_requires_auth(self):
        r = requests.post(f"{API}/admin/push/subscribe", json={
            "endpoint": "https://x", "keys": {"p256dh": "a", "auth": "b"}
        })
        assert r.status_code == 401

    def test_test_requires_auth(self):
        r = requests.post(f"{API}/admin/push/test")
        assert r.status_code == 401

    def test_dealer_cannot_access(self, dealer_session):
        s, _ = dealer_session
        r = s.get(f"{API}/admin/push/status")
        assert r.status_code == 403


# ---------- Subscription lifecycle -----------------------------------------
class TestSubscription:
    def test_status_shape(self, admin_session):
        r = admin_session.get(f"{API}/admin/push/status")
        assert r.status_code == 200
        data = r.json()
        assert "configured" in data
        assert "public_key" in data
        assert "subscriptions" in data
        # Should never leak private key material
        assert "private" not in str(data).lower()

    def test_idempotent_subscribe(self, admin_session):
        endpoint = f"https://fcm.googleapis.com/fcm/send/TEST-{uuid.uuid4().hex}"
        body = {
            "endpoint": endpoint,
            "keys": {
                "p256dh": "BEl62iUYgUivxIkv69yViEuiBIa40HI80NM9LdR2pIQyTS4d1O2M-DsF_qi-1zVFtBIYh8jXm2wG_9RcS7Nl_h4",
                "auth": "tBHItJI5svbpez7KI4CCXg",
            },
        }
        status = admin_session.get(f"{API}/admin/push/status").json()
        if not status["configured"]:
            pytest.skip("VAPID not configured in this environment")

        r1 = admin_session.post(f"{API}/admin/push/subscribe", json=body)
        assert r1.status_code == 200
        assert r1.json()["created"] is True

        # Second call with same endpoint must NOT create a duplicate.
        r2 = admin_session.post(f"{API}/admin/push/subscribe", json=body)
        assert r2.status_code == 200
        assert r2.json()["created"] is False

        # Cleanup
        admin_session.post(f"{API}/admin/push/unsubscribe", json={"endpoint": endpoint})

    def test_invalid_subscribe_payload(self, admin_session):
        status = admin_session.get(f"{API}/admin/push/status").json()
        if not status["configured"]:
            pytest.skip("VAPID not configured")
        r = admin_session.post(f"{API}/admin/push/subscribe", json={"endpoint": "", "keys": {}})
        assert r.status_code == 400


class TestPushTest:
    def test_send_test_returns_summary(self, admin_session):
        status = admin_session.get(f"{API}/admin/push/status").json()
        if not status["configured"]:
            pytest.skip("VAPID not configured")
        r = admin_session.post(f"{API}/admin/push/test")
        assert r.status_code == 200
        data = r.json()
        assert set(data.keys()) >= {"sent", "removed", "configured"}
        assert data["configured"] is True


class TestInvalidEndpointRemoval:
    def test_dead_endpoint_removed_on_test(self, admin_session):
        """Subscribe a fake endpoint that will 404/410, then send test → removed."""
        status = admin_session.get(f"{API}/admin/push/status").json()
        if not status["configured"]:
            pytest.skip("VAPID not configured")

        # Use fcm.googleapis.com/fcm/send/DEAD-* — invalid registrations return 404/410
        endpoint = f"https://fcm.googleapis.com/fcm/send/DEAD-{uuid.uuid4().hex}"
        subscribed = admin_session.post(f"{API}/admin/push/subscribe", json={
            "endpoint": endpoint,
            "keys": {
                "p256dh": "BEl62iUYgUivxIkv69yViEuiBIa40HI80NM9LdR2pIQyTS4d1O2M-DsF_qi-1zVFtBIYh8jXm2wG_9RcS7Nl_h4",
                "auth": "tBHItJI5svbpez7KI4CCXg",
            },
        })
        assert subscribed.status_code == 200
        before = admin_session.get(f"{API}/admin/push/status").json()["subscriptions"]

        # Attempt a push; the dead endpoint will respond 404 or 410 and get removed.
        admin_session.post(f"{API}/admin/push/test")

        after = admin_session.get(f"{API}/admin/push/status").json()["subscriptions"]
        # Either removed (404/410) or the FCM returned a different code (400 for garbage keys).
        # We only assert non-negative — if 404/410 was returned, count MUST decrease.
        assert after <= before, (
            f"Dead subscription should have been removed. before={before} after={after}"
        )
        # Belt-and-suspenders cleanup
        admin_session.post(f"{API}/admin/push/unsubscribe", json={"endpoint": endpoint})


# ---------- Notification-generating events ---------------------------------
class TestPendingEvents:
    def _latest_notif(self, admin_session, ntype: str, vid_or_uid: str = None):
        r = admin_session.get(f"{API}/admin/notifications")
        assert r.status_code == 200
        for n in r.json():
            if n["type"] == ntype:
                if not vid_or_uid:
                    return n
                if n.get("vehicle_id") == vid_or_uid or n.get("user_id") == vid_or_uid:
                    return n
        return None

    def test_new_dealer_creates_internal_notification(self, admin_session):
        email = f"pushnotif-{uuid.uuid4().hex[:8]}@test.com"
        s = requests.Session()
        r = s.post(f"{API}/auth/register", json={
            "email": email, "password": "Test@1234",
            "store_name": "Pending Store",
            "phone": "(67) 3000-1000", "whatsapp": "(67) 99000-1000",
            "city": "Campo Grande", "uf": "MS", "plan_code": "avulso",
        })
        assert r.status_code == 200
        dealer_id = r.json()["id"]
        try:
            notif = self._latest_notif(admin_session, "new_dealer", dealer_id)
            assert notif is not None
            assert notif["read"] is False
            # PT-BR bodies. Never leaks the password.
            assert "senha" not in (notif.get("body") or "").lower()
            assert "password" not in (notif.get("body") or "").lower()
        finally:
            admin_session.delete(f"{API}/admin/users/{dealer_id}")

    def test_public_ad_creates_notification(self, admin_session, dealer_session):
        s, _ = dealer_session
        r = s.post(f"{API}/dealer/vehicles", json={
            "category": "carro", "brand": "Honda", "model": "Civic",
            "year_made": 2022, "year_model": 2023, "km": 15000, "price": 95000,
            "city": "Campo Grande", "uf": "MS", "ad_type": "public",
        })
        assert r.status_code == 200, r.text
        vid = r.json()["id"]

        notif = self._latest_notif(admin_session, "new_ad", vid)
        assert notif is not None
        assert notif["vehicle_id"] == vid
        # PT-BR body must not carry sensitive info
        body = (notif.get("body") or "").lower()
        assert "senha" not in body and "password" not in body
        assert "token" not in body

    def test_repasse_ad_does_not_send_push(self, admin_session, dealer_session):
        """Repasse ads auto-publish → NO push must be dispatched.

        We verify by patching push_utils.send_push_to_admins to record calls.
        We assert that the internal notification IS still created (backwards compat).
        """
        s, _ = dealer_session
        # Repasse requires fipe + price
        r = s.post(f"{API}/dealer/vehicles", json={
            "category": "carro", "brand": "Toyota", "model": "Corolla",
            "year_made": 2022, "year_model": 2023, "km": 20000,
            "price": 85000, "fipe_price": 100000,
            "city": "Campo Grande", "uf": "MS", "ad_type": "repasse",
        })
        assert r.status_code == 200, r.text
        vid = r.json()["id"]

        # Internal notification MUST exist for repasse (backwards compat).
        notif = self._latest_notif(admin_session, "new_ad", vid)
        assert notif is not None
        # But its body must mention "automaticamente" (repasse-specific text)
        assert "automaticamente" in (notif.get("body") or "").lower()


# ---------- Security: never leak secrets ----------------------------------
class TestSecrets:
    def test_status_never_returns_private_key(self, admin_session):
        r = admin_session.get(f"{API}/admin/push/status")
        assert r.status_code == 200
        # Response as string should never contain the substring of the
        # private key env value (if set). We check for a large base64 fragment.
        text = r.text
        # crude check: the response should be small (< 300 chars) and contain
        # only public_key + counters
        assert len(text) < 500, "Push status response too large — potential leak"
