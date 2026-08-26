"""
Web Push helpers for the StockAuto admin panel.

Design goals
------------
- No 3rd-party paid service: uses only pywebpush + py_vapid.
- VAPID keys are read exclusively from environment variables.
- If not configured, the module reports `configured=False` and never blocks
  the rest of the app.
- Sending is best-effort: individual failures never propagate.
- 404/410 responses from the push service disable ONLY that subscription.
- Never logs private key or subscription secrets.
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Optional

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from pywebpush import WebPushException, webpush

logger = logging.getLogger("stockauto.push")

_VAPID_SUBJECT_DEFAULT = "mailto:admin@stockauto.com.br"


def _b64u_decode(value: str) -> bytes:
    value = value.strip().rstrip("=")
    pad = "=" * ((4 - len(value) % 4) % 4)
    return base64.urlsafe_b64decode(value + pad)


def _raw_scalar_to_pem(raw32: bytes) -> str:
    """Convert a 32-byte raw P-256 private scalar into a PEM (PKCS8) string."""
    priv_int = int.from_bytes(raw32, "big")
    pk = ec.derive_private_key(priv_int, ec.SECP256R1())
    pem = pk.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    return pem.decode("ascii")


def _load_private_pem() -> Optional[str]:
    """
    Load the VAPID private key from env.

    Accepts either a base64url-encoded raw 32-byte scalar (recommended,
    single-line) or a PEM string. Returns None if not configured or malformed.
    Never logs the value.
    """
    raw = os.environ.get("VAPID_PRIVATE_KEY", "").strip()
    if not raw:
        return None
    try:
        if raw.startswith("-----"):
            # Already PEM. Support literal \n in .env by unescaping.
            return raw.replace("\\n", "\n")
        scalar = _b64u_decode(raw)
        if len(scalar) != 32:
            logger.warning("VAPID_PRIVATE_KEY has invalid length (expected 32 raw bytes)")
            return None
        return _raw_scalar_to_pem(scalar)
    except Exception as e:
        # Log the class only — never the key content.
        logger.warning(f"VAPID_PRIVATE_KEY failed to load: {type(e).__name__}")
        return None


def is_configured() -> bool:
    return bool(_load_private_pem()) and bool(get_public_key())


def get_public_key() -> Optional[str]:
    """Public application server key (base64url) — safe to expose."""
    return (os.environ.get("VAPID_PUBLIC_KEY") or "").strip() or None


def get_subject() -> str:
    return (os.environ.get("VAPID_SUBJECT") or _VAPID_SUBJECT_DEFAULT).strip()


# ---------------------------------------------------------------------------
# Subscription CRUD helpers (persist to Mongo)
# ---------------------------------------------------------------------------
def _subscription_doc(admin_id: str, endpoint: str, keys: dict) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "admin_id": admin_id,
        "endpoint": endpoint,
        "keys": {"p256dh": keys.get("p256dh", ""), "auth": keys.get("auth", "")},
        "enabled": True,
        "created_at": now,
        "updated_at": now,
    }


async def upsert_subscription(db, admin_id: str, endpoint: str, keys: dict) -> dict:
    """Idempotent: unique by endpoint. Updates admin_id/keys/enabled/updated_at."""
    now = datetime.now(timezone.utc).isoformat()
    existing = await db.push_subscriptions.find_one({"endpoint": endpoint})
    if existing:
        await db.push_subscriptions.update_one(
            {"endpoint": endpoint},
            {"$set": {
                "admin_id": admin_id,
                "keys": {"p256dh": keys.get("p256dh", ""), "auth": keys.get("auth", "")},
                "enabled": True,
                "updated_at": now,
            }},
        )
        return {"created": False, "endpoint": endpoint}
    await db.push_subscriptions.insert_one(_subscription_doc(admin_id, endpoint, keys))
    return {"created": True, "endpoint": endpoint}


async def remove_subscription(db, admin_id: str, endpoint: str) -> int:
    res = await db.push_subscriptions.delete_one(
        {"endpoint": endpoint, "admin_id": admin_id}
    )
    return res.deleted_count


async def count_subscriptions(db, admin_id: Optional[str] = None) -> int:
    filt: dict = {"enabled": True}
    if admin_id:
        filt["admin_id"] = admin_id
    return await db.push_subscriptions.count_documents(filt)


# ---------------------------------------------------------------------------
# Sending
# ---------------------------------------------------------------------------
def _send_one_sync(subscription_info: dict, payload: dict, vapid_private_pem: str,
                   vapid_subject: str) -> int:
    """
    Sends a single push. Returns status code (200/201/204) on success, or the
    HTTP status returned by the push service on failure. Raises for network
    errors. Never logs the private key.
    """
    try:
        response = webpush(
            subscription_info=subscription_info,
            data=json.dumps(payload),
            vapid_private_key=vapid_private_pem,
            vapid_claims={"sub": vapid_subject},
            ttl=60,
        )
        return getattr(response, "status_code", 201)
    except WebPushException as e:
        resp = getattr(e, "response", None)
        status = getattr(resp, "status_code", 0) or -1
        # Log the provider response for diagnostics (never logs the private key
        # or subscription secrets — only status and short body prefix).
        body_snippet = ""
        try:
            body_snippet = (resp.text or "")[:200] if resp is not None else ""
        except Exception:
            body_snippet = ""
        logger.warning(
            "push send failed status=%s endpoint_prefix=%s body=%r",
            status,
            (subscription_info.get("endpoint") or "")[:40],
            body_snippet,
        )
        return status


async def send_push_to_admin(db, admin_id: str, payload: dict) -> dict:
    """
    Best-effort push targeting ONLY the subscriptions owned by a specific admin.

    Distinguishes:
      - `configured`: whether VAPID env is present at all
      - `registered`: number of enabled subs owned by this admin BEFORE send
      - `sent`: number of subs that accepted the push (2xx)
      - `removed`: number of dead subs (404/410) removed during this send
      - `reason`: short machine-friendly key ("ok", "no_subscription",
                  "not_configured", "provider_rejected"). Never carries secrets.
    """
    if not is_configured():
        return {"configured": False, "registered": 0, "sent": 0, "removed": 0,
                "reason": "not_configured"}

    pem = _load_private_pem()
    subject = get_subject()
    if not pem:
        return {"configured": False, "registered": 0, "sent": 0, "removed": 0,
                "reason": "not_configured"}

    subs = [s async for s in db.push_subscriptions.find({
        "admin_id": admin_id,
        "enabled": True,
    })]
    registered = len(subs)
    if registered == 0:
        return {"configured": True, "registered": 0, "sent": 0, "removed": 0,
                "reason": "no_subscription"}

    sent = 0
    removed = 0

    for sub in subs:
        info = {"endpoint": sub["endpoint"], "keys": sub.get("keys", {})}
        try:
            code = await asyncio.to_thread(_send_one_sync, info, payload, pem, subject)
        except Exception as e:
            logger.warning(
                "push send exception admin=%s err=%s",
                admin_id,
                type(e).__name__,
            )
            continue
        if code in (200, 201, 202, 204):
            sent += 1
        elif code in (404, 410):
            await db.push_subscriptions.delete_one({"endpoint": sub["endpoint"]})
            removed += 1
        else:
            logger.info(
                "push non-fatal status=%s admin=%s endpoint_prefix=%s",
                code, admin_id, sub["endpoint"][:40],
            )

    reason = "ok" if sent > 0 else "provider_rejected"
    return {"configured": True, "registered": registered, "sent": sent,
            "removed": removed, "reason": reason}


async def send_push_to_admins(db, payload: dict) -> dict:
    """
    Best-effort broadcast to all enabled admin subscriptions.

    - Never raises: internal failures only produce log messages (no secrets).
    - Removes subscriptions that respond 404 or 410 (endpoint dead).
    - Payload is expected to be small: type, notification_id, url, title, body.
    """
    if not is_configured():
        return {"sent": 0, "removed": 0, "configured": False}

    pem = _load_private_pem()
    subject = get_subject()
    if not pem:
        return {"sent": 0, "removed": 0, "configured": False}

    subs = [s async for s in db.push_subscriptions.find({"enabled": True})]
    sent = 0
    removed = 0

    for sub in subs:
        info = {
            "endpoint": sub["endpoint"],
            "keys": sub.get("keys", {}),
        }
        try:
            code = await asyncio.to_thread(_send_one_sync, info, payload, pem, subject)
        except Exception as e:
            logger.warning(
                "push send exception subs=%s err=%s",
                sub.get("_id"),
                type(e).__name__,
            )
            continue
        if code in (200, 201, 202, 204):
            sent += 1
        elif code in (404, 410):
            # Endpoint gone — remove only this subscription.
            await db.push_subscriptions.delete_one({"endpoint": sub["endpoint"]})
            removed += 1
        else:
            logger.info("push non-fatal status=%s endpoint=%s", code, sub["endpoint"][:60])

    return {"sent": sent, "removed": removed, "configured": True}


# Idempotency helper: keep a small in-memory set to avoid double-firing the
# same notification inside a single process. Notifications are created only
# once per event by upstream code, so this is defensive.
_recent_sent: set[str] = set()
_RECENT_MAX = 512


def _mark_sent(notification_id: str) -> bool:
    """Return True if this is the first time we see this id (should send)."""
    if not notification_id:
        return True
    if notification_id in _recent_sent:
        return False
    _recent_sent.add(notification_id)
    if len(_recent_sent) > _RECENT_MAX:
        # Trim oldest by re-creating a set with a slice — cheap and simple.
        _recent_sent.clear()
        _recent_sent.add(notification_id)
    return True


async def push_for_notification(db, notification_id: str, kind: str, title: str,
                                short_body: str, url: str = "/admin",
                                extra: Optional[dict] = None) -> dict:
    """
    Helper used at each notification insert point. Guarantees no duplicate
    push per notification_id inside this process lifetime.
    Payload intentionally minimal — never carries phones, emails or tokens.
    """
    if not _mark_sent(notification_id):
        return {"sent": 0, "removed": 0, "skipped": "duplicate"}
    payload = {
        "type": kind,
        "notification_id": notification_id,
        "title": title,
        "body": short_body,
        "url": url,
    }
    if extra:
        # Only allow small, safe keys.
        for k in ("tab",):
            if k in extra:
                payload[k] = extra[k]
    return await send_push_to_admins(db, payload)
