/**
 * Emergency regression test for the white-label host resolver.
 *
 * Simulates window.location / localStorage / URLSearchParams for a set of
 * critical scenarios and asserts the correct portal-vs-tenant decision.
 *
 * Run with:
 *   node frontend/scripts/test_whitelabel_resolver.mjs
 *
 * Exit code 0 = all passed, 1 = at least one failure.
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Set up a minimal DOM mock BEFORE loading the module under test.
function setEnv({ hostname, search = "", storage = null }) {
  const store = new Map();
  if (storage) Object.entries(storage).forEach(([k, v]) => store.set(k, v));
  globalThis.window = {
    location: { hostname, search },
  };
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    _dump: () => Object.fromEntries(store),
  };
  return globalThis.localStorage;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const modPath = resolve(__dirname, "..", "src", "lib", "whiteLabel.js");
// Rewrite the module source to be import-able as an ES module (strips JSX-free file).
// Since it IS pure JS already, we can just import it dynamically with a fresh URL each time.
async function freshImport() {
  // busts module cache by appending a query string to the file URL
  const url = pathToFileURL(modPath).href + `?t=${Date.now()}${Math.random()}`;
  return await import(url);
}

const cases = [
  // 1) Portal principal — never tenant, mesmo com localStorage sujo
  {
    name: "stockauto.com.br is always portal even with stale localStorage",
    env: { hostname: "stockauto.com.br", storage: { wl_dev_subdomain: "dfimplementos" } },
    expected: null,
    assertLSClearedAfter: true,
  },
  {
    name: "www.stockauto.com.br is always portal even with stale localStorage",
    env: { hostname: "www.stockauto.com.br", storage: { wl_dev_subdomain: "dfimplementos" } },
    expected: null,
    assertLSClearedAfter: true,
  },
  {
    name: "www.stockauto.com.br ignores ?subdomain= in production",
    env: { hostname: "www.stockauto.com.br", search: "?subdomain=dfimplementos" },
    expected: null,
  },

  // 2) Subdomínios reais
  {
    name: "dfimplementos.stockauto.com.br resolves as tenant",
    env: { hostname: "dfimplementos.stockauto.com.br" },
    expected: "dfimplementos",
  },
  {
    name: "auto-silva.stockauto.com.br resolves as tenant",
    env: { hostname: "auto-silva.stockauto.com.br" },
    expected: "auto-silva",
  },

  // 3) localhost — dev
  {
    name: "localhost honors ?subdomain= (dev)",
    env: { hostname: "localhost", search: "?subdomain=autosilva" },
    expected: "autosilva",
  },
  {
    name: "localhost honors localStorage (dev)",
    env: { hostname: "localhost", storage: { wl_dev_subdomain: "autosilva" } },
    expected: "autosilva",
  },

  // 4) Emergent preview — dev
  {
    name: "preview.emergentagent.com honors ?subdomain= (dev)",
    env: {
      hostname: "local-seo-campo.preview.emergentagent.com",
      search: "?subdomain=autosilva",
    },
    expected: "autosilva",
  },

  // 5) Hosts desconhecidos — production-safe (no overrides)
  {
    name: "unknown production host DOES NOT honor stale localStorage",
    env: { hostname: "randomdomain.com", storage: { wl_dev_subdomain: "hijacker" } },
    expected: null,
    assertLSClearedAfter: true,
  },
  {
    name: "unknown production host DOES NOT honor ?subdomain= query",
    env: { hostname: "randomdomain.com", search: "?subdomain=hijacker" },
    expected: null,
  },

  // 6) Reserved sub reaching resolver (defensive)
  {
    name: "www.stockauto.com.br (endsWith) never becomes tenant",
    env: { hostname: "www.stockauto.com.br" },
    expected: null,
  },
];

let failed = 0;
for (const c of cases) {
  const ls = setEnv(c.env);
  const { resolveSubdomain } = await freshImport();
  const got = resolveSubdomain();
  const ok = got === c.expected;
  let extraOk = true;
  if (c.assertLSClearedAfter) {
    const stored = ls.getItem("wl_dev_subdomain");
    if (stored !== null) {
      extraOk = false;
    }
  }
  if (ok && extraOk) {
    console.log(`  ✓ ${c.name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${c.name}`);
    console.log(`      expected=${JSON.stringify(c.expected)} got=${JSON.stringify(got)}`);
    if (!extraOk) console.log(`      wl_dev_subdomain in LS after call: ${ls.getItem("wl_dev_subdomain")}`);
  }
}

console.log(`\n${cases.length - failed}/${cases.length} passed`);
if (failed > 0) process.exit(1);
