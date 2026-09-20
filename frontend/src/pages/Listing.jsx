/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import VehicleCard from "@/components/VehicleCard";
import SEO from "@/components/SEO";
import { LISTING } from "@/constants/testIds";
import { UF_STATES } from "@/lib/format";
import { Search, SlidersHorizontal, X } from "lucide-react";

/**
 * FIELDS — all filter query params that the /veiculos page recognizes.
 * They round-trip through the URL so any combination is link-shareable
 * (e.g. `?brand=Toyota&price_max=150000&km_max=80000&sort=preco_asc`).
 *
 * The backend accepts each of these independently or combined; missing
 * params fall back to the historical defaults (no filter + recentes).
 */
const FIELDS = [
  "q", "category", "brand", "model",
  "city", "uf",
  "year_min", "year_max",
  "price_min", "price_max",
  "km_min", "km_max",
  "transmission", "fuel",
  "sort",
];

// Sort options exposed in the UI (backend also accepts `ano_asc`/`km_desc`
// but the product spec limits the picker to these five for now).
const SORT_OPTIONS = [
  { code: "recentes", label: "Mais recentes" },
  { code: "preco_asc", label: "Menor preço" },
  { code: "preco_desc", label: "Maior preço" },
  { code: "ano_desc", label: "Ano mais novo" },
  { code: "km_asc", label: "Menor quilometragem" },
];

const TRANSMISSION_LABEL = {
  manual: "Manual",
  automatico: "Automático",
  automatizado: "Automatizado",
  cvt: "CVT",
};

const FUEL_LABEL = {
  flex: "Flex",
  gasolina: "Gasolina",
  alcool: "Álcool",
  diesel: "Diesel",
  gnv: "GNV",
  eletrico: "Elétrico",
  hibrido: "Híbrido",
};

const fmtMoney = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
};

const fmtKm = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  return `${n.toLocaleString("pt-BR")} km`;
};

function emptyForm(sp) {
  return FIELDS.reduce((acc, k) => ({ ...acc, [k]: sp.get(k) || "" }), {});
}

/**
 * Build the labelled chips for filters currently applied in the URL.
 * `q` and `sort` are intentionally NOT rendered as chips:
 *   - `q` already has its own visible input in the sidebar/drawer
 *   - `sort` has a dedicated select and is always present (default = recentes)
 * The `oferta=true` deep-link also gets a chip so users can drop it easily.
 */
function buildChips(sp, categories) {
  const chips = [];
  const push = (key, label, onRemove) => chips.push({ key, label, onRemove });

  const cat = sp.get("category");
  if (cat) {
    const l = categories.find((c) => c.code === cat)?.label || cat;
    push("category", `Categoria: ${l}`, (n) => n.delete("category"));
  }
  const brand = sp.get("brand");
  if (brand) push("brand", `Marca: ${brand}`, (n) => n.delete("brand"));
  const model = sp.get("model");
  if (model) push("model", `Modelo: ${model}`, (n) => n.delete("model"));
  const uf = sp.get("uf");
  if (uf) push("uf", `UF: ${uf.toUpperCase()}`, (n) => n.delete("uf"));
  const city = sp.get("city");
  if (city) push("city", `Cidade: ${city}`, (n) => n.delete("city"));

  const yMin = sp.get("year_min");
  const yMax = sp.get("year_max");
  if (yMin || yMax) {
    const label = yMin && yMax ? `Ano: ${yMin}–${yMax}` : yMin ? `Ano ≥ ${yMin}` : `Ano ≤ ${yMax}`;
    push("year", label, (n) => { n.delete("year_min"); n.delete("year_max"); });
  }
  const pMin = sp.get("price_min");
  const pMax = sp.get("price_max");
  if (pMin || pMax) {
    const label = pMin && pMax
      ? `Preço: ${fmtMoney(pMin)} – ${fmtMoney(pMax)}`
      : pMin ? `Preço ≥ ${fmtMoney(pMin)}` : `Preço ≤ ${fmtMoney(pMax)}`;
    push("price", label, (n) => { n.delete("price_min"); n.delete("price_max"); });
  }
  const kMin = sp.get("km_min");
  const kMax = sp.get("km_max");
  if (kMin || kMax) {
    const label = kMin && kMax
      ? `KM: ${fmtKm(kMin)} – ${fmtKm(kMax)}`
      : kMin ? `KM ≥ ${fmtKm(kMin)}` : `KM ≤ ${fmtKm(kMax)}`;
    push("km", label, (n) => { n.delete("km_min"); n.delete("km_max"); });
  }
  const trans = sp.get("transmission");
  if (trans) push("transmission", `Câmbio: ${TRANSMISSION_LABEL[trans] || trans}`, (n) => n.delete("transmission"));
  const fuel = sp.get("fuel");
  if (fuel) push("fuel", `Combustível: ${FUEL_LABEL[fuel] || fuel}`, (n) => n.delete("fuel"));

  if (sp.get("oferta") === "true") {
    push("oferta", "Somente ofertas", (n) => n.delete("oferta"));
  }
  return chips;
}

/** Count of chip-worthy filters — mirrors buildChips() to keep the mobile
 *  counter honest without duplicating the label logic.
 */
function countActive(sp) {
  const keys = ["category", "brand", "model", "uf", "city", "transmission", "fuel"];
  let n = keys.reduce((acc, k) => acc + (sp.get(k) ? 1 : 0), 0);
  if (sp.get("year_min") || sp.get("year_max")) n++;
  if (sp.get("price_min") || sp.get("price_max")) n++;
  if (sp.get("km_min") || sp.get("km_max")) n++;
  if (sp.get("oferta") === "true") n++;
  return n;
}

export default function Listing() {
  const [sp, setSp] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(() => emptyForm(sp));
  const [mobileOpen, setMobileOpen] = useState(false);

  // Load categories once (title is now managed by react-helmet-async via <SEO />)
  useEffect(() => {
    api.get("/categories").then((r) => setCategories(r.data)).catch(() => {});
  }, []);

  // Re-fetch whenever URL params change
  useEffect(() => {
    setLoading(true);
    // Default UF filter = MS (site focado em Mato Grosso do Sul).
    // Explicit `uf` in the URL overrides this default (uf may be empty string).
    const params = { uf: "MS" };
    FIELDS.forEach((k) => {
      const v = sp.get(k);
      if (v) params[k] = v;
    });
    // Map "?oferta=true" → "has_offer=true" filter (used by the OFERTAS nav link)
    if (sp.get("oferta") === "true") {
      params.has_offer = true;
    }
    params.limit = 60;
    api
      .get("/vehicles", { params })
      .then((r) => {
        setItems(r.data.items || []);
        setTotal(r.data.total || 0);
      })
      .catch(() => {
        setItems([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
    setForm(emptyForm(sp));
  }, [sp]);

  const apply = (e) => {
    e?.preventDefault();
    const next = new URLSearchParams();
    // Preserve non-filter deep-link flags (e.g. ?oferta=true) so the
    // "Aplicar filtros" click never silently drops them.
    if (sp.get("oferta") === "true") next.set("oferta", "true");
    FIELDS.forEach((k) => {
      if (form[k]) next.set(k, form[k]);
    });
    setSp(next);
    setMobileOpen(false);
  };

  const reset = () => {
    setForm(FIELDS.reduce((acc, k) => ({ ...acc, [k]: "" }), {}));
    setSp(new URLSearchParams());
    setMobileOpen(false);
  };

  const onChange = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  /** Immediate URL-level updates for chip removals and the sort selector.
   *  These don't need the sidebar "Aplicar" round-trip.
   */
  const patchParams = (patcher) => {
    const next = new URLSearchParams(sp);
    patcher(next);
    setSp(next);
  };

  const onSortChange = (e) => {
    patchParams((n) => {
      const v = e.target.value;
      if (!v || v === "recentes") n.delete("sort");
      else n.set("sort", v);
    });
  };

  const chips = useMemo(() => buildChips(sp, categories), [sp, categories]);
  const activeCount = useMemo(() => countActive(sp), [sp]);
  const currentSort = sp.get("sort") || "recentes";

  const activeCategory = useMemo(
    () => categories.find((c) => c.code === form.category)?.label || null,
    [categories, form.category]
  );

  const isOfertasView = sp.get("oferta") === "true";

  const seoTitle = isOfertasView
    ? "Veículos em Oferta e Promoção em Campo Grande - MS"
    : activeCategory
    ? `${activeCategory} à venda em Campo Grande - MS`
    : "Veículos à venda em Campo Grande - MS";
  const seoDesc = isOfertasView
    ? "Ofertas e promoções de carros, motos e camionetes em Campo Grande/MS. Os melhores descontos selecionados pelos revendedores StockAuto. Contato direto via WhatsApp."
    : activeCategory
    ? `${activeCategory} usados e seminovos em Campo Grande/MS. Compare preços, fotos e fale direto com os revendedores via WhatsApp pelo StockAuto.`
    : "Carros, motos, camionetes, caminhões e mais à venda em Campo Grande/MS. Catálogo completo com contato direto via WhatsApp pelo StockAuto.";

  return (
    <div data-testid={LISTING.page}>
      <SEO
        title={seoTitle}
        description={seoDesc}
        canonical={
          isOfertasView
            ? "/veiculos?oferta=true"
            : `/veiculos${form.category ? `?category=${form.category}` : ""}`
        }
        keywords={
          isOfertasView
            ? "ofertas de carros Campo Grande, promoções de veículos MS, descontos seminovos Campo Grande, carros em promoção MS, StockAuto"
            : `${activeCategory || "veículos"} Campo Grande, ${activeCategory || "carros"} usados MS, comprar ${activeCategory || "veículo"} Campo Grande, StockAuto`
        }
      />
      {/* PAGE HEADER */}
      <section className="bg-black text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-20 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] font-bold text-zinc-400">
              Catálogo {activeCategory ? `· ${activeCategory}` : ""}
            </div>
            <h1
              className="mt-3 text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-[0.95]"
              style={{ fontFamily: "Cabinet Grotesk, Inter, sans-serif" }}
            >
              {loading ? "Buscando…" : `${total} ${total === 1 ? "veículo" : "veículos"}`}
            </h1>
          </div>
          <button
            data-testid={LISTING.filterMobileToggle}
            onClick={() => setMobileOpen(true)}
            className="md:hidden inline-flex items-center gap-2 self-start bg-white text-black px-5 py-3 text-sm font-bold uppercase tracking-tight"
          >
            <SlidersHorizontal size={16} />
            Filtros
            {activeCount > 0 && (
              <span
                data-testid={LISTING.filterMobileCount}
                className="ml-1 inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-[#FF3B30] text-white text-[11px] font-black"
              >
                {activeCount}
              </span>
            )}
          </button>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-12 gap-10">
        {/* FILTERS SIDEBAR */}
        <aside
          className={`md:col-span-3 ${
            mobileOpen
              ? "fixed inset-0 z-50 bg-white p-6 overflow-y-auto"
              : "hidden md:block"
          }`}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="text-xs uppercase tracking-[0.3em] font-bold text-zinc-500">Filtros</div>
            {mobileOpen && (
              <button onClick={() => setMobileOpen(false)} className="p-1" aria-label="Fechar filtros">
                <X size={20} />
              </button>
            )}
          </div>
          <form onSubmit={apply} className="space-y-5">
            <Field label="Busca">
              <div className="flex items-center border border-zinc-300 px-3 h-11 focus-within:border-black">
                <Search size={16} className="text-zinc-500" />
                <input
                  data-testid={LISTING.filterQ}
                  value={form.q}
                  onChange={onChange("q")}
                  placeholder="Marca, modelo, cidade…"
                  className="flex-1 ml-2 outline-none bg-transparent text-sm"
                />
              </div>
            </Field>

            <Field label="Categoria">
              <select
                data-testid={LISTING.filterCategory}
                value={form.category}
                onChange={onChange("category")}
                className="w-full border border-zinc-300 h-11 px-3 text-sm bg-white focus:border-black outline-none"
              >
                <option value="">Todas</option>
                {categories.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Marca">
              <input
                data-testid={LISTING.filterBrand}
                value={form.brand}
                onChange={onChange("brand")}
                placeholder="Ex.: Honda"
                className="w-full border border-zinc-300 h-11 px-3 text-sm focus:border-black outline-none"
              />
            </Field>

            <Field label="Modelo">
              <input
                value={form.model}
                onChange={onChange("model")}
                placeholder="Ex.: Civic"
                className="w-full border border-zinc-300 h-11 px-3 text-sm focus:border-black outline-none"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="UF">
                <select
                  data-testid={LISTING.filterUf}
                  value={form.uf}
                  onChange={onChange("uf")}
                  className="w-full border border-zinc-300 h-11 px-2 text-sm bg-white focus:border-black outline-none"
                >
                  <option value="">Todos os estados</option>
                  {UF_STATES.map((u) => (
                    <option key={u.code} value={u.code}>
                      {u.code} - {u.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Cidade">
                <input
                  data-testid={LISTING.filterCity}
                  value={form.city}
                  onChange={onChange("city")}
                  placeholder="Cidade"
                  className="w-full border border-zinc-300 h-11 px-3 text-sm focus:border-black outline-none"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Ano mín.">
                <input
                  data-testid={LISTING.filterYearMin}
                  type="number"
                  inputMode="numeric"
                  value={form.year_min}
                  onChange={onChange("year_min")}
                  placeholder="2010"
                  className="w-full border border-zinc-300 h-11 px-3 text-sm focus:border-black outline-none"
                />
              </Field>
              <Field label="Ano máx.">
                <input
                  data-testid={LISTING.filterYearMax}
                  type="number"
                  inputMode="numeric"
                  value={form.year_max}
                  onChange={onChange("year_max")}
                  placeholder="2025"
                  className="w-full border border-zinc-300 h-11 px-3 text-sm focus:border-black outline-none"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Preço mín.">
                <input
                  data-testid={LISTING.filterPriceMin}
                  type="number"
                  inputMode="numeric"
                  value={form.price_min}
                  onChange={onChange("price_min")}
                  placeholder="R$"
                  className="w-full border border-zinc-300 h-11 px-3 text-sm focus:border-black outline-none"
                />
              </Field>
              <Field label="Preço máx.">
                <input
                  data-testid={LISTING.filterPriceMax}
                  type="number"
                  inputMode="numeric"
                  value={form.price_max}
                  onChange={onChange("price_max")}
                  placeholder="R$"
                  className="w-full border border-zinc-300 h-11 px-3 text-sm focus:border-black outline-none"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="KM mín.">
                <input
                  data-testid={LISTING.filterKmMin}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={form.km_min}
                  onChange={onChange("km_min")}
                  placeholder="0"
                  className="w-full border border-zinc-300 h-11 px-3 text-sm focus:border-black outline-none"
                />
              </Field>
              <Field label="KM máx.">
                <input
                  data-testid={LISTING.filterKmMax}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={form.km_max}
                  onChange={onChange("km_max")}
                  placeholder="150000"
                  className="w-full border border-zinc-300 h-11 px-3 text-sm focus:border-black outline-none"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Câmbio">
                <select
                  data-testid="listing-filter-transmission"
                  value={form.transmission}
                  onChange={onChange("transmission")}
                  className="w-full border border-zinc-300 h-11 px-2 text-sm bg-white focus:border-black outline-none"
                >
                  <option value="">Todos</option>
                  <option value="manual">Manual</option>
                  <option value="automatico">Automático</option>
                  <option value="automatizado">Automatizado</option>
                  <option value="cvt">CVT</option>
                </select>
              </Field>
              <Field label="Combustível">
                <select
                  data-testid="listing-filter-fuel"
                  value={form.fuel}
                  onChange={onChange("fuel")}
                  className="w-full border border-zinc-300 h-11 px-2 text-sm bg-white focus:border-black outline-none"
                >
                  <option value="">Todos</option>
                  <option value="flex">Flex</option>
                  <option value="gasolina">Gasolina</option>
                  <option value="alcool">Álcool</option>
                  <option value="diesel">Diesel</option>
                  <option value="gnv">GNV</option>
                  <option value="eletrico">Elétrico</option>
                  <option value="hibrido">Híbrido</option>
                </select>
              </Field>
            </div>

            <div className="pt-4 space-y-2">
              <button
                data-testid={LISTING.filterApply}
                type="submit"
                className="w-full bg-black text-white h-12 text-sm font-bold uppercase tracking-tight hover:bg-zinc-800"
              >
                Aplicar filtros
              </button>
              <button
                type="button"
                data-testid={LISTING.filterReset}
                onClick={reset}
                className="w-full border border-zinc-300 h-12 text-sm font-bold uppercase tracking-tight hover:border-black"
              >
                Limpar
              </button>
            </div>
          </form>
        </aside>

        {/* RESULTS */}
        <section className="md:col-span-9" data-testid={LISTING.results}>
          {/* Sort + active chips bar */}
          <div className="mb-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs uppercase tracking-[0.3em] font-bold text-zinc-500">
                {loading ? "Carregando…" : `${total} resultado${total === 1 ? "" : "s"}`}
              </div>
              <label className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-zinc-600">
                Ordenar
                <select
                  data-testid={LISTING.sortSelect}
                  value={currentSort}
                  onChange={onSortChange}
                  className="border border-zinc-300 h-10 px-2 text-sm font-bold uppercase tracking-tight bg-white focus:border-black outline-none normal-case"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.code} value={o.code}>{o.label}</option>
                  ))}
                </select>
              </label>
            </div>

            {chips.length > 0 && (
              <div
                data-testid={LISTING.activeChips}
                className="flex flex-wrap items-center gap-2"
              >
                {chips.map((c) => (
                  <span
                    key={c.key}
                    data-testid={LISTING.activeChip(c.key)}
                    className="inline-flex items-center gap-1.5 border border-zinc-300 bg-white px-3 h-8 text-xs font-bold uppercase tracking-tight"
                  >
                    {c.label}
                    <button
                      type="button"
                      data-testid={LISTING.activeChipRemove(c.key)}
                      onClick={() => patchParams(c.onRemove)}
                      className="ml-1 -mr-1 p-0.5 hover:text-[#FF3B30]"
                      aria-label={`Remover filtro ${c.label}`}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  data-testid={LISTING.clearAllChips}
                  onClick={reset}
                  className="text-xs font-bold uppercase tracking-tight underline underline-offset-4 hover:text-[#FF3B30]"
                >
                  Limpar tudo
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Fixed-length skeleton placeholders — index key is intentional */}
              {Array.from({ length: 6 }).map((_, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <div key={`skeleton-${i}`} className="border border-zinc-200 animate-pulse">
                  <div className="aspect-[4/3] bg-zinc-100" />
                  <div className="p-5 space-y-3">
                    <div className="h-3 w-1/3 bg-zinc-100" />
                    <div className="h-5 w-2/3 bg-zinc-100" />
                    <div className="h-3 w-1/2 bg-zinc-100" />
                    <div className="h-6 w-1/3 bg-zinc-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="border border-dashed border-zinc-300 py-24 text-center">
              <div className="text-xs uppercase tracking-[0.3em] font-bold text-zinc-400">Sem resultados</div>
              <h3 className="mt-3 text-2xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>
                Nada encontrado com esses filtros.
              </h3>
              <button
                onClick={reset}
                className="mt-6 text-sm font-bold uppercase tracking-tight border-b-2 border-black pb-1 hover:text-[#FF3B30] hover:border-[#FF3B30]"
              >
                Limpar filtros
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {items.map((v) => (
                <VehicleCard key={v.id} v={v} testIdBuilder={LISTING.vehicleCard} />
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="bg-zinc-50 border-t border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <h2 className="text-xs uppercase tracking-[0.3em] font-bold text-zinc-500">Sobre o catálogo</h2>
          <p className="mt-3 text-sm text-zinc-600 max-w-3xl leading-relaxed">
            Encontre as melhores ofertas de veículos em Campo Grande, MS. O StockAuto conecta
            você diretamente às revendas mais confiáveis da capital — sem intermediação, com
            contato direto via WhatsApp.
          </p>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">{label}</div>
      {children}
    </div>
  );
}
