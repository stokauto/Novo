import { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import axios from "axios";
import { API_BASE, fileUrl } from "@/lib/api";
import { resolveSubdomain } from "@/lib/whiteLabel";
import VehicleCard from "@/components/VehicleCard";
import WhatsAppButton from "@/components/WhatsAppButton";
import ShareControls from "@/components/ShareControls";
import { MapPin, Phone, Instagram, Facebook, Store, Loader2, AlertTriangle, SlidersHorizontal, X, Search } from "lucide-react";

/**
 * White-label store site page.
 *
 * Renders a self-contained storefront for a single dealer, addressed via
 * `<subdomain>.stockauto.com.br` (production) or `?subdomain=<sub>` /
 * localStorage (development). The main StockAuto chrome (header, footer,
 * menu) is intentionally NOT rendered here — the App wrapper decides that
 * based on `isWhiteLabelMode()`.
 *
 * Filtering: the client sends optional query params to
 * `/api/public/store-site`. The BACKEND enforces `dealer_id` isolation —
 * even if a user hand-crafts params, they can never see another store's
 * stock. We intentionally do NOT expose UF/City filters here because a
 * white-label store's inventory is inherently scoped to that dealer.
 */
const FIELDS = [
  "q", "category", "brand", "model",
  "year_min", "year_max",
  "price_min", "price_max",
  "km_min", "km_max",
  "transmission", "fuel",
  "sort",
];

const SORT_OPTIONS = [
  { code: "recentes", label: "Mais recentes" },
  { code: "preco_asc", label: "Menor preço" },
  { code: "preco_desc", label: "Maior preço" },
  { code: "ano_desc", label: "Ano mais novo" },
  { code: "km_asc", label: "Menor quilometragem" },
];

const emptyForm = () => FIELDS.reduce((acc, k) => ({ ...acc, [k]: "" }), {});

function countActive(f) {
  const single = ["q", "category", "brand", "model", "transmission", "fuel"];
  let n = single.reduce((acc, k) => acc + (f[k] ? 1 : 0), 0);
  if (f.year_min || f.year_max) n++;
  if (f.price_min || f.price_max) n++;
  if (f.km_min || f.km_max) n++;
  return n;
}

export default function WhiteLabelSite() {
  const subdomain = useMemo(() => resolveSubdomain(), []);
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [form, setForm] = useState(emptyForm);
  // `applied` is the last committed form snapshot that drives the fetch.
  // Separating draft (form) from applied lets us keep the sidebar/drawer
  // UX of "Aplicar" without triggering a fetch on every keystroke.
  const [applied, setApplied] = useState(emptyForm);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [fetching, setFetching] = useState(false);

  const load = useCallback(async (filters) => {
    if (!subdomain) {
      setState({ loading: false, data: null, error: "not_a_tenant" });
      return;
    }
    setFetching(true);
    try {
      const params = {};
      FIELDS.forEach((k) => { if (filters[k]) params[k] = filters[k]; });
      const res = await axios.get(`${API_BASE}/public/store-site`, {
        headers: { "X-StockAuto-Subdomain": subdomain },
        params,
        withCredentials: false,
      });
      setState({ loading: false, data: res.data, error: null });
    } catch (e) {
      const status = e?.response?.status;
      setState({
        loading: false,
        data: null,
        error: status === 404 ? "not_found" : "network",
      });
    } finally {
      setFetching(false);
    }
  }, [subdomain]);

  useEffect(() => {
    load(emptyForm());
  }, [load]);

  const onChange = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const apply = (e) => {
    e?.preventDefault();
    setApplied(form);
    load(form);
    setMobileOpen(false);
  };

  const reset = () => {
    const cleared = emptyForm();
    setForm(cleared);
    setApplied(cleared);
    load(cleared);
    setMobileOpen(false);
  };

  const onSortChange = (e) => {
    // Sort applies immediately — no round-trip through "Aplicar".
    const nextSort = e.target.value === "recentes" ? "" : e.target.value;
    const next = { ...applied, sort: nextSort };
    setForm((f) => ({ ...f, sort: nextSort }));
    setApplied(next);
    load(next);
  };

  const removeChip = (patcher) => {
    const next = { ...applied };
    patcher(next);
    setForm(next);
    setApplied(next);
    load(next);
  };

  if (state.loading) return <FullPageLoader />;
  if (state.error) return <ErrorPage error={state.error} subdomain={subdomain} />;

  const { site, dealer, vehicles, total } = state.data;
  const primary = site.primary_color || "#111111";
  const secondary = site.secondary_color || "#FF3B30";
  const button = site.button_color || primary;
  const currentSort = applied.sort || "recentes";
  const activeCount = countActive(applied);
  const chips = buildChips(applied);
  const shownTotal = typeof total === "number" ? total : vehicles.length;

  return (
    <div
      data-testid="wl-page"
      className="min-h-screen bg-white"
      style={{ ["--wl-primary"]: primary, ["--wl-secondary"]: secondary, ["--wl-button"]: button }}
    >
      <Helmet>
        <title>{`${dealer.store_name} — ${dealer.city}/${dealer.uf}`}</title>
        <meta name="description" content={(site.about_text || "").slice(0, 160) || `${dealer.store_name} em ${dealer.city}/${dealer.uf}.`} />
        {site.favicon_path && (
          <link rel="icon" href={fileUrl(site.favicon_path)} />
        )}
      </Helmet>

      {/* Tenant header (no StockAuto chrome) */}
      <header
        data-testid="wl-header"
        className="border-b sticky top-0 z-40 bg-white/95 backdrop-blur"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <div className="w-11 h-11 flex-shrink-0 flex items-center justify-center overflow-hidden bg-zinc-100">
            {site.logo_path ? (
              <img src={fileUrl(site.logo_path)} alt={dealer.store_name} className="w-full h-full object-cover" />
            ) : (
              <Store size={18} className="text-zinc-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div
              className="font-black tracking-tight text-lg truncate"
              style={{ color: primary, fontFamily: "Cabinet Grotesk, Inter, sans-serif" }}
            >
              {dealer.store_name}
            </div>
            <div className="text-xs text-zinc-500 flex items-center gap-1">
              <MapPin size={12} /> {dealer.city}/{dealer.uf}
            </div>
          </div>
          {dealer.whatsapp && (
            <WhatsAppButton
              whatsapp={dealer.whatsapp}
              message={`Olá ${dealer.store_name}, vi o site de vocês.`}
              label="WhatsApp"
              size="md"
              data-testid="wl-header-wa"
            />
          )}
        </div>
      </header>

      {/* Hero / cover */}
      <section className="relative overflow-hidden" data-testid="wl-hero">
        {site.cover_path ? (
          <div className="relative h-56 md:h-72">
            <img src={fileUrl(site.cover_path)} alt="Capa" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>
        ) : (
          <div className="h-48 md:h-64" style={{ backgroundColor: primary }} />
        )}
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-10">
          <div className="text-xs uppercase tracking-[0.3em] font-bold" style={{ color: secondary }}>
            Vitrine oficial
          </div>
          <h1
            className="mt-3 text-3xl md:text-5xl font-black tracking-tighter leading-[0.95]"
            style={{ color: primary, fontFamily: "Cabinet Grotesk, Inter, sans-serif" }}
          >
            Confira o estoque
          </h1>
          {site.about_text && (
            <p className="mt-4 max-w-2xl text-zinc-700 leading-relaxed">
              {site.about_text}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-3 items-center">
            {dealer.whatsapp && (
              <WhatsAppButton
                whatsapp={dealer.whatsapp}
                message={`Olá ${dealer.store_name}, vi o site de vocês.`}
                label="Falar no WhatsApp"
                size="md"
                data-testid="wl-hero-wa"
              />
            )}
            {dealer.phone && (
              <a
                href={`tel:${(dealer.phone || "").replace(/\D/g, "")}`}
                className="inline-flex items-center gap-2 border border-zinc-300 hover:border-black px-5 h-12 font-bold uppercase tracking-tight text-sm"
              >
                <Phone size={16} /> {dealer.phone}
              </a>
            )}
            <ShareControls
              title={`${dealer.store_name} — ${dealer.city}/${dealer.uf}`}
              text="Confira a vitrine da loja"
              testid="wl-hero-share"
              compact
            />
          </div>
        </div>
      </section>

      {/* Inventory + Filters */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-14 grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Sidebar filters */}
        <aside
          data-testid="wl-filters"
          className={`md:col-span-3 ${
            mobileOpen
              ? "fixed inset-0 z-50 bg-white p-6 overflow-y-auto"
              : "hidden md:block"
          }`}
        >
          <div className="flex items-center justify-between mb-5">
            <div className="text-xs uppercase tracking-[0.3em] font-bold text-zinc-500">Filtros</div>
            {mobileOpen && (
              <button onClick={() => setMobileOpen(false)} className="p-1" aria-label="Fechar filtros">
                <X size={20} />
              </button>
            )}
          </div>

          <form onSubmit={apply} className="space-y-4">
            <WLField label="Busca">
              <div className="flex items-center border border-zinc-300 px-3 h-11 focus-within:border-black">
                <Search size={16} className="text-zinc-500" />
                <input
                  data-testid="wl-filter-q"
                  value={form.q}
                  onChange={onChange("q")}
                  placeholder="Marca, modelo…"
                  className="flex-1 ml-2 outline-none bg-transparent text-sm"
                />
              </div>
            </WLField>

            <WLField label="Marca">
              <input
                data-testid="wl-filter-brand"
                value={form.brand}
                onChange={onChange("brand")}
                placeholder="Ex.: Honda"
                className="w-full border border-zinc-300 h-11 px-3 text-sm focus:border-black outline-none"
              />
            </WLField>

            <WLField label="Modelo">
              <input
                data-testid="wl-filter-model"
                value={form.model}
                onChange={onChange("model")}
                placeholder="Ex.: Civic"
                className="w-full border border-zinc-300 h-11 px-3 text-sm focus:border-black outline-none"
              />
            </WLField>

            <div className="grid grid-cols-2 gap-3">
              <WLField label="Ano mín.">
                <input data-testid="wl-filter-year-min" type="number" inputMode="numeric" value={form.year_min}
                  onChange={onChange("year_min")} placeholder="2015"
                  className="w-full border border-zinc-300 h-11 px-3 text-sm focus:border-black outline-none" />
              </WLField>
              <WLField label="Ano máx.">
                <input data-testid="wl-filter-year-max" type="number" inputMode="numeric" value={form.year_max}
                  onChange={onChange("year_max")} placeholder="2025"
                  className="w-full border border-zinc-300 h-11 px-3 text-sm focus:border-black outline-none" />
              </WLField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <WLField label="Preço mín.">
                <input data-testid="wl-filter-price-min" type="number" inputMode="numeric" value={form.price_min}
                  onChange={onChange("price_min")} placeholder="R$"
                  className="w-full border border-zinc-300 h-11 px-3 text-sm focus:border-black outline-none" />
              </WLField>
              <WLField label="Preço máx.">
                <input data-testid="wl-filter-price-max" type="number" inputMode="numeric" value={form.price_max}
                  onChange={onChange("price_max")} placeholder="R$"
                  className="w-full border border-zinc-300 h-11 px-3 text-sm focus:border-black outline-none" />
              </WLField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <WLField label="KM mín.">
                <input data-testid="wl-filter-km-min" type="number" inputMode="numeric" min={0} value={form.km_min}
                  onChange={onChange("km_min")} placeholder="0"
                  className="w-full border border-zinc-300 h-11 px-3 text-sm focus:border-black outline-none" />
              </WLField>
              <WLField label="KM máx.">
                <input data-testid="wl-filter-km-max" type="number" inputMode="numeric" min={0} value={form.km_max}
                  onChange={onChange("km_max")} placeholder="150000"
                  className="w-full border border-zinc-300 h-11 px-3 text-sm focus:border-black outline-none" />
              </WLField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <WLField label="Câmbio">
                <select data-testid="wl-filter-transmission" value={form.transmission}
                  onChange={onChange("transmission")}
                  className="w-full border border-zinc-300 h-11 px-2 text-sm bg-white focus:border-black outline-none">
                  <option value="">Todos</option>
                  <option value="manual">Manual</option>
                  <option value="automatico">Automático</option>
                  <option value="automatizado">Automatizado</option>
                  <option value="cvt">CVT</option>
                </select>
              </WLField>
              <WLField label="Combustível">
                <select data-testid="wl-filter-fuel" value={form.fuel}
                  onChange={onChange("fuel")}
                  className="w-full border border-zinc-300 h-11 px-2 text-sm bg-white focus:border-black outline-none">
                  <option value="">Todos</option>
                  <option value="flex">Flex</option>
                  <option value="gasolina">Gasolina</option>
                  <option value="alcool">Álcool</option>
                  <option value="diesel">Diesel</option>
                  <option value="gnv">GNV</option>
                  <option value="eletrico">Elétrico</option>
                  <option value="hibrido">Híbrido</option>
                </select>
              </WLField>
            </div>

            <div className="pt-3 space-y-2">
              <button
                data-testid="wl-filter-apply"
                type="submit"
                className="w-full h-11 text-sm font-bold uppercase tracking-tight text-white"
                style={{ backgroundColor: button }}
              >
                Aplicar filtros
              </button>
              <button
                type="button"
                data-testid="wl-filter-reset"
                onClick={reset}
                className="w-full border border-zinc-300 h-11 text-sm font-bold uppercase tracking-tight hover:border-black"
              >
                Limpar
              </button>
            </div>
          </form>
        </aside>

        <div className="md:col-span-9">
          <div className="flex items-baseline justify-between mb-4 gap-3">
            <h2 className="text-2xl md:text-3xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>
              Estoque disponível
            </h2>
            <div className="flex items-center gap-3">
              <button
                type="button"
                data-testid="wl-filter-mobile-toggle"
                onClick={() => setMobileOpen(true)}
                className="md:hidden inline-flex items-center gap-2 border border-zinc-300 hover:border-black px-3 h-9 text-xs font-bold uppercase tracking-tight"
              >
                <SlidersHorizontal size={14} />
                Filtros
                {activeCount > 0 && (
                  <span
                    data-testid="wl-filter-mobile-count"
                    className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 rounded-full text-white text-[10px] font-black"
                    style={{ backgroundColor: secondary }}
                  >
                    {activeCount}
                  </span>
                )}
              </button>
              <span className="text-xs uppercase tracking-widest font-bold text-zinc-500">
                {shownTotal} veículo(s)
              </span>
            </div>
          </div>

          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2" data-testid="wl-active-chips">
              {chips.length === 0 && (
                <span className="text-xs uppercase tracking-widest font-bold text-zinc-400">
                  Nenhum filtro aplicado
                </span>
              )}
              {chips.map((c) => (
                <span
                  key={c.key}
                  data-testid={`wl-active-chip-${c.key}`}
                  className="inline-flex items-center gap-1.5 border border-zinc-300 bg-white px-3 h-8 text-xs font-bold uppercase tracking-tight"
                >
                  {c.label}
                  <button
                    type="button"
                    data-testid={`wl-active-chip-remove-${c.key}`}
                    onClick={() => removeChip(c.onRemove)}
                    className="ml-1 -mr-1 p-0.5 hover:text-[#FF3B30]"
                    aria-label={`Remover filtro ${c.label}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              {chips.length > 0 && (
                <button
                  type="button"
                  data-testid="wl-clear-all-chips"
                  onClick={reset}
                  className="text-xs font-bold uppercase tracking-tight underline underline-offset-4 hover:text-[#FF3B30]"
                >
                  Limpar tudo
                </button>
              )}
            </div>
            <label className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-zinc-600">
              Ordenar
              <select
                data-testid="wl-sort-select"
                value={currentSort}
                onChange={onSortChange}
                className="border border-zinc-300 h-9 px-2 text-sm font-bold uppercase tracking-tight bg-white focus:border-black outline-none normal-case"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.code} value={o.code}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>

          {fetching ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <div key={`wl-skel-${i}`} className="border border-zinc-200 animate-pulse">
                  <div className="aspect-[4/3] bg-zinc-100" />
                  <div className="p-5 space-y-3">
                    <div className="h-3 w-1/3 bg-zinc-100" />
                    <div className="h-5 w-2/3 bg-zinc-100" />
                    <div className="h-6 w-1/3 bg-zinc-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : vehicles.length === 0 ? (
            <div className="border-2 border-dashed border-zinc-300 py-16 text-center" data-testid="wl-empty">
              <Store size={40} className="mx-auto text-zinc-300" />
              <p className="mt-3 text-zinc-500 text-sm">
                {activeCount > 0
                  ? "Nenhum veículo desta loja corresponde aos filtros."
                  : "Nenhum veículo publicado no momento."}
              </p>
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={reset}
                  className="mt-4 text-xs font-bold uppercase tracking-tight underline underline-offset-4 hover:text-[#FF3B30]"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {vehicles.map((v) => (
                <VehicleCard key={v.id} v={v} testIdBuilder={(id) => `wl-vehicle-${id}`} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Tenant footer */}
      <footer className="border-t bg-zinc-50" data-testid="wl-footer" style={{ borderColor: primary }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="font-black tracking-tight text-lg" style={{ color: primary, fontFamily: "Cabinet Grotesk" }}>
              {dealer.store_name}
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              {dealer.address ? `${dealer.address} · ` : ""}{dealer.city}/{dealer.uf}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {site.instagram_url && (
              <a href={site.instagram_url} target="_blank" rel="noopener noreferrer"
                 aria-label="Instagram" className="p-2 border border-zinc-300 hover:border-black">
                <Instagram size={16} />
              </a>
            )}
            {site.facebook_url && (
              <a href={site.facebook_url} target="_blank" rel="noopener noreferrer"
                 aria-label="Facebook" className="p-2 border border-zinc-300 hover:border-black">
                <Facebook size={16} />
              </a>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}

function WLField({ label, children }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">{label}</div>
      {children}
    </div>
  );
}

const TRANSMISSION_LABEL_WL = { manual: "Manual", automatico: "Automático", automatizado: "Automatizado", cvt: "CVT" };
const FUEL_LABEL_WL = { flex: "Flex", gasolina: "Gasolina", alcool: "Álcool", diesel: "Diesel", gnv: "GNV", eletrico: "Elétrico", hibrido: "Híbrido" };

const fmtMoneyWL = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : v;
};
const fmtKmWL = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toLocaleString("pt-BR")} km` : v;
};

/** Build chips for the applied filter state. Each chip has a `patcher`
 *  that mutates a form clone by clearing the relevant key(s). */
function buildChips(f) {
  const chips = [];
  const push = (key, label, onRemove) => chips.push({ key, label, onRemove });
  if (f.q) push("q", `Busca: ${f.q}`, (n) => { n.q = ""; });
  if (f.brand) push("brand", `Marca: ${f.brand}`, (n) => { n.brand = ""; });
  if (f.model) push("model", `Modelo: ${f.model}`, (n) => { n.model = ""; });
  if (f.year_min || f.year_max) {
    const label = f.year_min && f.year_max ? `Ano: ${f.year_min}–${f.year_max}`
      : f.year_min ? `Ano ≥ ${f.year_min}` : `Ano ≤ ${f.year_max}`;
    push("year", label, (n) => { n.year_min = ""; n.year_max = ""; });
  }
  if (f.price_min || f.price_max) {
    const label = f.price_min && f.price_max ? `Preço: ${fmtMoneyWL(f.price_min)} – ${fmtMoneyWL(f.price_max)}`
      : f.price_min ? `Preço ≥ ${fmtMoneyWL(f.price_min)}` : `Preço ≤ ${fmtMoneyWL(f.price_max)}`;
    push("price", label, (n) => { n.price_min = ""; n.price_max = ""; });
  }
  if (f.km_min || f.km_max) {
    const label = f.km_min && f.km_max ? `KM: ${fmtKmWL(f.km_min)} – ${fmtKmWL(f.km_max)}`
      : f.km_min ? `KM ≥ ${fmtKmWL(f.km_min)}` : `KM ≤ ${fmtKmWL(f.km_max)}`;
    push("km", label, (n) => { n.km_min = ""; n.km_max = ""; });
  }
  if (f.transmission) push("transmission", `Câmbio: ${TRANSMISSION_LABEL_WL[f.transmission] || f.transmission}`, (n) => { n.transmission = ""; });
  if (f.fuel) push("fuel", `Combustível: ${FUEL_LABEL_WL[f.fuel] || f.fuel}`, (n) => { n.fuel = ""; });
  return chips;
}

function FullPageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <Loader2 className="animate-spin text-zinc-400" size={32} />
    </div>
  );
}

function ErrorPage({ error, subdomain }) {
  const messages = {
    not_a_tenant: {
      title: "Página do site da loja",
      desc: "Não foi possível identificar a loja neste endereço. Confira o subdomínio.",
    },
    not_found: {
      title: "Site indisponível",
      desc: `O site "${subdomain}" não existe ou está desativado no momento.`,
    },
    network: {
      title: "Falha ao carregar",
      desc: "Não conseguimos conectar ao servidor. Tente novamente em instantes.",
    },
  };
  const m = messages[error] || messages.network;
  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-6" data-testid="wl-error">
      <div className="max-w-md text-center">
        <AlertTriangle className="mx-auto text-amber-500" size={40} />
        <h1 className="mt-4 text-3xl font-black tracking-tight" style={{ fontFamily: "Cabinet Grotesk" }}>
          {m.title}
        </h1>
        <p className="mt-3 text-zinc-600">{m.desc}</p>
      </div>
    </div>
  );
}
