/**
 * White-label subdomain resolver (client-side helper).
 *
 * Decides whether the current page is being served for a tenant (dealer's
 * white-label site) or for the main portal, and — when in tenant mode —
 * gives back the subdomain string.
 *
 * Resolution order:
 *   1. Real host: `<sub>.stockauto.com.br`
 *   2. Query param `?subdomain=<sub>` (dev/testing only)
 *   3. localStorage key `wl_dev_subdomain` (dev/testing only)
 *
 * The backend accepts `X-StockAuto-Subdomain` for the same purpose.
 */
const RESERVED_HOST_SUBS = new Set([
  "www", "admin", "api", "app", "stockauto", "portal", "preview",
]);

const PRIMARY_HOSTS = new Set([
  "stockauto.com.br",
  "www.stockauto.com.br",
  "localhost",
  "127.0.0.1",
]);

const TENANT_HOST_SUFFIX = ".stockauto.com.br";

const SUBDOMAIN_RE = /^(?!-)[a-z0-9-]{2,40}(?<!-)$/;

function normalizeSub(value) {
  if (!value) return null;
  const v = String(value).trim().toLowerCase();
  if (!SUBDOMAIN_RE.test(v)) return null;
  if (RESERVED_HOST_SUBS.has(v)) return null;
  return v;
}

/**
 * @returns {string|null} the resolved subdomain, or null when running on the
 *   primary portal / when no subdomain override is present.
 */
export function resolveSubdomain() {
  if (typeof window === "undefined") return null;

  const host = (window.location.hostname || "").toLowerCase();

  // Real tenant host: <sub>.stockauto.com.br
  if (host.endsWith(TENANT_HOST_SUFFIX)) {
    const sub = host.slice(0, -TENANT_HOST_SUFFIX.length);
    if (sub && !sub.includes(".")) return normalizeSub(sub);
  }

  // Any other host (main portal, preview URLs, localhost, etc.):
  // fall back to dev overrides so the site can be tested outside DNS.
  const params = new URLSearchParams(window.location.search);
  const fromQuery = normalizeSub(params.get("subdomain"));
  if (fromQuery) {
    try { localStorage.setItem("wl_dev_subdomain", fromQuery); } catch (_) { /* noop */ }
    return fromQuery;
  }
  try {
    const stored = normalizeSub(localStorage.getItem("wl_dev_subdomain"));
    if (stored) return stored;
  } catch (_) { /* noop */ }

  return null;
}

export function isWhiteLabelMode() {
  return resolveSubdomain() !== null;
}

/**
 * Clears the dev override — useful for the "sair do modo teste" affordance
 * we might expose in the admin. Not called automatically.
 */
export function clearDevSubdomain() {
  try { localStorage.removeItem("wl_dev_subdomain"); } catch (_) { /* noop */ }
}
