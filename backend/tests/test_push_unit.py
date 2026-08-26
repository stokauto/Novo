"""
Unit tests for push_utils.send_push_to_admin — covers exactly the case that
was previously masked by the HTTP-level integration tests: distinguishing
`registered=0`, `registered>0 & sent=0` and `sent>0` outcomes.

These tests mock pywebpush at the _send_one_sync boundary so no real push
service is contacted.
"""
import asyncio
import os
import uuid
from unittest.mock import patch

import pytest
from motor.motor_asyncio import AsyncIOMotorClient

import push_utils

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

pytestmark = pytest.mark.asyncio


@pytest.fixture()
async def db():
    client = AsyncIOMotorClient(MONGO_URL)
    d = client[DB_NAME]
    yield d
    client.close()


async def _register_sub(db, admin_id: str) -> str:
    endpoint = f"https://fcm.googleapis.com/fcm/send/UNIT-{uuid.uuid4().hex}"
    await push_utils.upsert_subscription(
        db, admin_id, endpoint,
        {"p256dh": "BEl62iUYgUivxIkv69yViEuiBIa40HI80NM9LdR2pIQyTS4d1O2M-DsF_qi-1zVFtBIYh8jXm2wG_9RcS7Nl_h4",
         "auth": "tBHItJI5svbpez7KI4CCXg"},
    )
    return endpoint


@pytest.fixture()
async def admin_id(db):
    aid = f"unit-admin-{uuid.uuid4().hex}"
    yield aid
    # Teardown: remove any sub owned by this admin
    await db.push_subscriptions.delete_many({"admin_id": aid})


class TestSendPushToAdminScoping:
    """Confirms that the send function uses the same criterion as the counter."""

    async def test_no_subscription_returns_no_subscription_reason(self, db, admin_id):
        # No sub inserted for this admin_id
        result = await push_utils.send_push_to_admin(db, admin_id, {"title": "x", "body": "y"})
        assert result["configured"] is True or result["configured"] is False
        # If configured is False (no VAPID), reason is not_configured. Otherwise
        # it MUST be no_subscription, never generic "sent=0".
        if result["configured"]:
            assert result["reason"] == "no_subscription"
            assert result["registered"] == 0
            assert result["sent"] == 0

    async def test_single_sub_and_provider_accepts(self, db, admin_id):
        if not push_utils.is_configured():
            pytest.skip("VAPID not configured")
        endpoint = await _register_sub(db, admin_id)

        # Sanity: this admin's counter matches
        assert await push_utils.count_subscriptions(db, admin_id) == 1

        # Mock the sync push call to always succeed (201)
        with patch.object(push_utils, "_send_one_sync", return_value=201):
            result = await push_utils.send_push_to_admin(
                db, admin_id, {"title": "t", "body": "b"}
            )
        assert result == {
            "configured": True, "registered": 1, "sent": 1, "removed": 0, "reason": "ok"
        }
        # Sub is still there
        assert await db.push_subscriptions.count_documents({"endpoint": endpoint}) == 1

    async def test_provider_rejects_keeps_sub_and_reports_reason(self, db, admin_id):
        """This is the bug scenario: sub is valid but provider returns non-2xx / non-410.

        Expected: registered=1, sent=0, reason='provider_rejected', sub NOT removed.
        """
        if not push_utils.is_configured():
            pytest.skip("VAPID not configured")
        endpoint = await _register_sub(db, admin_id)

        # Simulate provider returning 400 (bad payload) — should NOT delete the sub.
        with patch.object(push_utils, "_send_one_sync", return_value=400):
            result = await push_utils.send_push_to_admin(
                db, admin_id, {"title": "t", "body": "b"}
            )
        assert result["configured"] is True
        assert result["registered"] == 1
        assert result["sent"] == 0
        assert result["removed"] == 0
        assert result["reason"] == "provider_rejected"
        assert await db.push_subscriptions.count_documents({"endpoint": endpoint}) == 1

    async def test_provider_returns_410_removes_sub(self, db, admin_id):
        if not push_utils.is_configured():
            pytest.skip("VAPID not configured")
        endpoint = await _register_sub(db, admin_id)

        with patch.object(push_utils, "_send_one_sync", return_value=410):
            result = await push_utils.send_push_to_admin(
                db, admin_id, {"title": "t", "body": "b"}
            )
        assert result["registered"] == 1
        assert result["sent"] == 0
        assert result["removed"] == 1
        # Removed reason still surfaces provider_rejected — that is fine because
        # the sub was invalid and the counter dropped to zero.
        assert await db.push_subscriptions.count_documents({"endpoint": endpoint}) == 0

    async def test_provider_returns_404_removes_sub(self, db, admin_id):
        if not push_utils.is_configured():
            pytest.skip("VAPID not configured")
        endpoint = await _register_sub(db, admin_id)

        with patch.object(push_utils, "_send_one_sync", return_value=404):
            result = await push_utils.send_push_to_admin(
                db, admin_id, {"title": "t", "body": "b"}
            )
        assert result["removed"] == 1
        assert await db.push_subscriptions.count_documents({"endpoint": endpoint}) == 0

    async def test_scoping_ignores_other_admin_subs(self, db, admin_id):
        """A subscription belonging to a DIFFERENT admin must not be sent to."""
        if not push_utils.is_configured():
            pytest.skip("VAPID not configured")
        other_admin = f"unit-other-{uuid.uuid4().hex}"
        try:
            await _register_sub(db, other_admin)
            # Only "other_admin" has a sub. Current admin has none.
            with patch.object(push_utils, "_send_one_sync", return_value=201) as mock_send:
                result = await push_utils.send_push_to_admin(
                    db, admin_id, {"title": "t", "body": "b"}
                )
            assert result["registered"] == 0
            assert result["reason"] == "no_subscription"
            mock_send.assert_not_called()
        finally:
            await db.push_subscriptions.delete_many({"admin_id": other_admin})

    async def test_response_never_leaks_secrets(self, db, admin_id):
        if not push_utils.is_configured():
            pytest.skip("VAPID not configured")
        await _register_sub(db, admin_id)
        with patch.object(push_utils, "_send_one_sync", return_value=201):
            result = await push_utils.send_push_to_admin(
                db, admin_id, {"title": "t", "body": "b"}
            )
        blob = str(result)
        # Response must not carry endpoints, keys, or any private data.
        assert "fcm.googleapis.com" not in blob
        assert "p256dh" not in blob
        assert "auth" not in blob
        assert "BEGIN" not in blob
        assert "private" not in blob.lower() or "private" in "".join(result.keys()).lower() is False


class TestSubscribeIdempotency:
    async def test_upsert_is_idempotent(self, db, admin_id):
        endpoint = f"https://fcm.googleapis.com/fcm/send/IDEMP-{uuid.uuid4().hex}"
        keys = {"p256dh": "abc", "auth": "def"}
        r1 = await push_utils.upsert_subscription(db, admin_id, endpoint, keys)
        r2 = await push_utils.upsert_subscription(db, admin_id, endpoint, keys)
        assert r1["created"] is True
        assert r2["created"] is False
        count = await db.push_subscriptions.count_documents({"endpoint": endpoint})
        assert count == 1
        doc = await db.push_subscriptions.find_one({"endpoint": endpoint})
        assert doc["admin_id"] == admin_id
        assert doc["enabled"] is True
        assert doc["keys"]["p256dh"] == "abc"
        assert doc["keys"]["auth"] == "def"


class TestNotConfigured:
    async def test_no_vapid_returns_not_configured(self, db, admin_id):
        # Force is_configured() → False by patching
        with patch.object(push_utils, "is_configured", return_value=False):
            result = await push_utils.send_push_to_admin(
                db, admin_id, {"title": "t", "body": "b"}
            )
        assert result["configured"] is False
        assert result["reason"] == "not_configured"
        assert result["sent"] == 0
        assert result["registered"] == 0
