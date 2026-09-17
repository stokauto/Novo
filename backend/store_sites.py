"""
StockAuto — Multi-tenant white-label store sites.

Isolated from the main portal:
- Own MongoDB collection (`store_sites`).
- Each doc bound 1:1 to a dealer (`dealer_id`).
- Subdomain is unique, restricted to [a-z0-9-], protected from reserved words.
- Public read via a dedicated endpoint, admin CRUD via `get_admin_user`.

This module holds only pure helpers (validation, resolution, serialization).
Routes/dependencies live in server.py.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

# Reserved subdomains — never allow these to be claimed by a dealer site.
RESERVED_SUBDOMAINS = {
    "www", "admin", "api", "app", "stockauto", "portal", "site", "auth",
    "static", "assets", "cdn", "mail", "email", "webmail", "mx",
    "root", "ns1", "ns2", "dns", "test", "staging", "preview", "dev",
    "docs", "help", "support", "blog", "news",
}

# Primary portal hostnames — requests to these are never treated as white-label.
PRIMARY_HOSTS = {
    "stockauto.com.br",
    "www.stockauto.com.br",
    "localhost",
    "127.0.0.1",
}

# Suffix that qualifies a request as a white-label subdomain request.
TENANT_HOST_SUFFIX = ".stockauto.com.br"

_SUBDOMAIN_RE = re.compile(r"^(?!-)[a-z0-9-]{2,40}(?<!-)$")


def validate_subdomain(value: Optional[str]) -> str:
    """Return a normalized subdomain or raise ValueError with a PT-BR message."""
    if not value:
        raise ValueError("O subdomínio é obrigatório.")
    v = value.strip().lower()
    if not _SUBDOMAIN_RE.match(v):
        raise ValueError(
            "Subdomínio inválido. Use apenas letras minúsculas, números e hífen (2 a 40 caracteres, sem hífen no início ou fim)."
        )
    if v in RESERVED_SUBDOMAINS:
        raise ValueError("Este subdomínio é reservado e não pode ser usado.")
    return v


def resolve_host(host_header: Optional[str], override_header: Optional[str] = None) -> dict:
    """
    Given a Host header value and an optional X-StockAuto-Subdomain header,
    decide whether the request targets the main portal or a tenant.

    Returns:
        {"kind": "primary"} — main portal.
        {"kind": "tenant", "subdomain": "..."} — a specific white-label site.
        {"kind": "unknown"} — Host didn't match any known pattern.
    """
    # Explicit override wins in any environment — it's server-scoped (only
    # trusted callers reach the API) and vastly simplifies local testing.
    if override_header:
        try:
            return {"kind": "tenant", "subdomain": validate_subdomain(override_header)}
        except ValueError:
            return {"kind": "unknown"}

    if not host_header:
        return {"kind": "primary"}

    # Strip port and normalize
    host = host_header.split(",")[0].strip().lower()
    host = host.split(":")[0]

    if host in PRIMARY_HOSTS:
        return {"kind": "primary"}

    if host.endswith(TENANT_HOST_SUFFIX):
        sub = host[: -len(TENANT_HOST_SUFFIX)]
        if sub and "." not in sub:
            try:
                return {"kind": "tenant", "subdomain": validate_subdomain(sub)}
            except ValueError:
                return {"kind": "unknown"}

    return {"kind": "unknown"}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def public_site(doc: dict) -> dict:
    """Strip internal fields before exposing the site config."""
    if not doc:
        return {}
    return {
        "id": doc.get("id"),
        "dealer_id": doc.get("dealer_id"),
        "subdomain": doc.get("subdomain"),
        "site_active": bool(doc.get("site_active", False)),
        "logo_path": doc.get("logo_path"),
        "cover_path": doc.get("cover_path"),
        "favicon_path": doc.get("favicon_path"),
        "primary_color": doc.get("primary_color") or "#111111",
        "secondary_color": doc.get("secondary_color") or "#FF3B30",
        "button_color": doc.get("button_color") or "#111111",
        "about_text": doc.get("about_text") or "",
        "facebook_url": doc.get("facebook_url") or "",
        "instagram_url": doc.get("instagram_url") or "",
    }


def admin_site(doc: dict) -> dict:
    """Full document (admin-facing). Same shape as public but includes timestamps."""
    if not doc:
        return {}
    base = public_site(doc)
    base["created_at"] = doc.get("created_at")
    base["updated_at"] = doc.get("updated_at")
    return base
