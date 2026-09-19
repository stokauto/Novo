/**
 * White-label subdomain resolver (client-side helper).
 *
 * Decides whether the current page is being served for a tenant (dealer's
 * white-label site) or for the main portal, and — when in tenant mode —
 * gives back the subdomain string.
 *
 * SAFETY (2026-09-18 hotfix):
 * The primary portal hosts (`stockauto.com.br`, `www.stockauto.com.br`) are
 * ALWAYS returned as portal-mode, regardless of query params or a stale
 * `wl_dev_subdomain` left over in localStorage from a previous dev/preview
 * session. In addition, whenever we detect the primary host we proactively
 * clear the stale localStorage key so the same browser cannot be hijacked
 * again.
 *
 * Resolution order:
 *   1. If host is a KNOWN primary portal host → main portal (ignore overrides).
 *   2. Real host: `<sub>.stockauto.com.br` → tenant.
 *   3. In non-production hosts only, `?subdomain=<sub>` query and
 *      `wl_dev_subdomain` localStorage are honored as dev overrides.
 *
 * The backend accepts `X-StockAuto-Subdomain` for the same purpose.
 */
const RESERVED_HOST_SUBS = new Set([
  "www", "admin", "api", "app", "stockauto", "portal", "preview",
]);

// Hosts that MUST always render the main portal. Overrides are ignored here.
const PRIMARY_HOSTS = new Set([
  "stockauto.com.br",
  "www.stockauto.com.br",
]);

// Hosts where the dev overrides (?subdomain=, localStorage) are allowed.
// Any other host is treated conservatively as production and never honors overrides.
const DEV_OVERRIDE_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
]);
const DEV_OVERRIDE_SUFFIXES = [
  ".preview.emergentagent.com",  // Emergent preview environment
];

const TENANT_HOST_SUFFIX = ".stockauto.com.br";
const LS_KEY = "wl_dev_subdomain";

const SUBDOMAIN_RE = /^(?!-)[a-z0-9-]{2,40}(?<!-)$/;

function normalizeSub(value) {
  if (!value) return null;
  const v = String(value).trim().toLowerCase();
  if (!SUBDOMAIN_RE.test(v)) return null;
  if (RESERVED_HOST_SUBS.has(v)) return null;
  return v;
}

function safeRemoveLS() {
  try { localStorage.removeItem(LS_KEY); } catch (_) { /* noop */ }
}

function isDevHost(host) {
  if (DEV_OVERRIDE_HOSTS.has(host)) return true;
  return DEV_OVERRIDE_SUFFIXES.some((sfx) => host.endsWith(sfx));
}

/**
 * @returns {string|null} the resolved subdomain, or null when running on the
 *   primary portal / when no subdomain override is present.
 */
export function resolveSubdomain() {
  if (typeof window === "undefined") return null;

  const host = (window.location.hostname || "").toLowerCase();

  // 1) HARD GUARD: known primary hosts always render the portal.
  //    We also clear any leftover dev override so a poisoned browser
  //    self-heals on the next navigation.
  if (PRIMARY_HOSTS.has(host)) {
    safeRemoveLS();
    return null;
  }

  // 2) Real tenant host: <sub>.stockauto.com.br
  if (host.endsWith(TENANT_HOST_SUFFIX)) {
    const sub = host.slice(0, -TENANT_HOST_SUFFIX.length);
    if (sub && !sub.includes(".")) {
      const normalized = normalizeSub(sub);
      if (normalized) return normalized;
    }
    // Ends with the tenant suffix but the sub is reserved/invalid (e.g. "www"
    // reaching this branch on an unexpected apex proxy): treat as portal,
    // never as tenant, and never fall back to localStorage.
    safeRemoveLS();
    return null;
  }

  // 3) Dev overrides — only honored on explicit development hosts.
  //    Any other host is treated conservatively as production.
  if (!isDevHost(host)) {
    safeRemoveLS();
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const fromQuery = normalizeSub(params.get("subdomain"));
  if (fromQuery) {
    try { localStorage.setItem(LS_KEY, fromQuery); } catch (_) { /* noop */ }
    return fromQuery;
  }
  try {
    const stored = normalizeSub(localStorage.getItem(LS_KEY));
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
  safeRemoveLS();
}
