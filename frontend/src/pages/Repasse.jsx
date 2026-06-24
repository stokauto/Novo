/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "@/lib/api";
import RepasseCard from "@/components/RepasseCard";
import SEO from "@/components/SEO";
import { UF_LIST } from "@/lib/format";
import { Search, X, Lock, Sparkles } from "lucide-react";

const FIELDS = ["q", "category", "brand", "uf", "city"];

function emptyForm(sp) {
  return {
    q: sp.get("q") || "",
    category: sp.get("category") || "",
    brand: sp.get("brand") || "",
    uf: sp.get("uf") || "",
    city: sp.get("city") || "",
  };
}

export default function Repasse() {
  const [sp, setSp] = useSearchParams();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(() => emptyForm(sp));
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    api.get("/categories").then((r) => setCategories(r.data)).catch(() => {});
    // Feed of latest ads in the past 24h (max 5)
    api
      .get("/repasse/vehicles", { params: { since_hours: 24, limit: 5 } })
      .then((r) => setRecent(r.data.items || []))
      .catch(() => setRecent([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = {};
    FIELDS.forEach((k) => {
      const v = sp.get(k);
      if (v) params[k] = v;
    });
    params.limit = 60;
    api
      .get("/repasse/vehicles", { params })
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

  const onSubmit = (e) => {
    e.preventDefault();
    const next = new URLSearchParams();
    FIELDS.forEach((k) => {
      const v = (form[k] || "").trim();
      if (v) next.set(k, v);
    });
    setSp(next);
  };

  const clearFilters = () => setSp(new URLSearchParams());
  const activeFilters = useMemo(
    () => FIELDS.filter((k) => (sp.get(k) || "").trim() !== ""),
    [sp]
  );
  const hasFilters = activeFilters.length > 0;

  return (
    <div data-testid="repasse-page">
      <SEO
        title="Hub de Repasse B2B — StockAuto"
        description="Hub de Repasse exclusivo para revendedores StockAuto. Compre e venda direto entre lojistas com valores FIPE de referência e oferta destacada."
        canonical="/repasse"
        noindex
      />

      {/* HERO */}
      <section className="bg-black text-white border-b-4 border-[#F5A623]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <div className="inline-flex items-center gap-2 bg-[#F5A623] text-black text-[10px] font-black uppercase tracking-[0.3em] px-3 py-1.5 mb-5">
            <Lock size={12} /> Área restrita — Revendedores
          </div>
          <h1
            className="text-4xl sm:text-6xl font-black tracking-tighter"
            style={{ fontFamily: "Cabinet Grotesk, Inter, sans-serif" }}
          >
            Hub de Repasse <span className="text-[#F5A623]">B2B</span>
          </h1>
          <p className="mt-4 max-w-2xl text-zinc-300 text-base sm:text-lg leading-relaxed">
            Catálogo de parcerias entre lojistas. Compare FIPE e ofertas, identifique
            margens e feche negócio direto pelo WhatsApp — sem aparecer no classificado público.
          </p>
        </div>
      </section>

      {/* FILTERS */}
      <section className="border-b border-zinc-200 bg-zinc-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <form onSubmit={onSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
            <div className="lg:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Busca</label>
              <div className="mt-1 relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  data-testid="repasse-filter-q"
                  value={form.q}
                  onChange={(e) => setForm({ ...form, q: e.target.value })}
                  placeholder="Marca, modelo, versão…"
                  className="w-full h-11 pl-9 pr-3 border border-zinc-300 focus:border-black outline-none bg-white"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Categoria</label>
              <select
                data-testid="repasse-filter-category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="mt-1 w-full h-11 px-3 border border-zinc-300 focus:border-black outline-none bg-white"
              >
                <option value="">Todas</option>
                {categories.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">UF</label>
              <select
                data-testid="repasse-filter-uf"
                value={form.uf}
                onChange={(e) => setForm({ ...form, uf: e.target.value })}
                className="mt-1 w-full h-11 px-3 border border-zinc-300 focus:border-black outline-none bg-white"
              >
                <option value="">Todas</option>
                {UF_LIST.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Cidade</label>
              <input
                data-testid="repasse-filter-city"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="Campo Grande…"
                className="mt-1 w-full h-11 px-3 border border-zinc-300 focus:border-black outline-none bg-white"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                data-testid="repasse-filter-apply"
                className="flex-1 h-11 bg-black hover:bg-zinc-800 text-white text-sm font-bold uppercase tracking-tight"
              >
                Filtrar
              </button>
              {activeFilters.length > 0 && (
                <button
                  type="button"
                  data-testid="repasse-filter-clear"
                  onClick={clearFilters}
                  className="h-11 w-11 border border-zinc-300 hover:border-black grid place-items-center"
                  aria-label="Limpar filtros"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </form>
        </div>
      </section>

      {/* RECENT FEED (last 24h) — só aparece se houver itens recentes e sem filtros */}
      {recent.length > 0 && !hasFilters && (
        <section className="border-b border-zinc-200 bg-gradient-to-b from-[#FFF8EC] to-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center gap-2 mb-5">
              <Sparkles size={18} className="text-[#F5A623]" />
              <div className="text-xs uppercase tracking-[0.3em] font-black text-zinc-700">
                Novidades — últimas 24h
              </div>
              <span className="text-xs font-bold uppercase tracking-tight bg-[#F5A623] text-black px-2 py-0.5">
                {recent.length}
              </span>
            </div>
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}
              data-testid="repasse-recent-feed"
            >
              {recent.map((v) => (
                <RepasseCard key={v.id} v={v} testid={`repasse-recent-${v.id}`} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* LISTING */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-baseline justify-between mb-6">
          <div className="text-xs uppercase tracking-[0.3em] font-bold text-zinc-500">
            {loading ? "Carregando…" : `${total} ${total === 1 ? "oferta" : "ofertas"} no hub`}
          </div>
          {hasFilters && (
            <div className="text-xs text-zinc-500">
              {activeFilters.length} filtro{activeFilters.length > 1 ? "s" : ""} aplicado{activeFilters.length > 1 ? "s" : ""}
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Fixed-length skeleton placeholders — index key is intentional */}
            {[...Array(6)].map((_, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={`skeleton-${i}`} className="h-[420px] bg-zinc-100 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="border-2 border-dashed border-zinc-300 p-16 text-center">
            <div className="inline-flex w-14 h-14 bg-[#F5A623] text-black items-center justify-center mb-4">
              <Lock size={22} />
            </div>
            <div className="text-2xl font-black tracking-tight" style={{ fontFamily: "Cabinet Grotesk" }}>
              Nenhuma oferta de repasse no momento
            </div>
            <div className="mt-3 text-sm text-zinc-500 max-w-md mx-auto">
              {hasFilters
                ? "Ajuste os filtros ou limpe-os para ver todas as ofertas disponíveis."
                : "Volte em breve. Você também pode anunciar um repasse pelo seu painel."}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((v) => (
              <RepasseCard key={v.id} v={v} testid={`repasse-card-${v.id}`} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
