import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api, { fileUrl } from "@/lib/api";
import SEO, { SITE_URL } from "@/components/SEO";
import { SVC } from "@/constants/testIds";
import { Search, MapPin, Phone, Wrench, Building2, ArrowRight } from "lucide-react";

const ACCENT = "#0E7C86";

export default function Services() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(searchParams.get("q") || "");

  const activeCategory = searchParams.get("category") || "all";

  useEffect(() => {
    api.get("/service-categories").then((r) => setCategories(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = { limit: 120 };
    if (activeCategory !== "all") params.category = activeCategory;
    if (searchParams.get("q")) params.q = searchParams.get("q");
    api
      .get("/services", { params })
      .then((r) => setItems(r.data || []))
      .finally(() => setLoading(false));
  }, [activeCategory, searchParams]);

  const setCategory = (code) => {
    const next = new URLSearchParams(searchParams);
    if (code === "all") next.delete("category");
    else next.set("category", code);
    setSearchParams(next, { replace: true });
  };

  const onSearch = (e) => {
    e.preventDefault();
    const next = new URLSearchParams(searchParams);
    if (q.trim()) next.set("q", q.trim());
    else next.delete("q");
    setSearchParams(next, { replace: true });
  };

  const seoDesc = useMemo(() => {
    if (activeCategory === "all") {
      return "Encontre empresas de serviços automotivos em Campo Grande - MS: mecânica, funilaria, elétrica, seguros, financiamento e mais. Contato direto via WhatsApp pelo StockAuto.";
    }
    const cat = categories.find((c) => c.code === activeCategory);
    return `Empresas de ${cat?.label || "serviços"} em Campo Grande - MS. Contato direto via WhatsApp. Guia local do StockAuto.`;
  }, [activeCategory, categories]);

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.slice(0, 20).map((s, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      url: `${SITE_URL}/servicos/${s.slug}`,
      name: s.name,
    })),
  };

  return (
    <div data-testid={SVC.page}>
      <SEO
        title="Serviços Automotivos em Campo Grande - MS | StockAuto"
        description={seoDesc}
        canonical={`/servicos${activeCategory !== "all" ? `?category=${activeCategory}` : ""}`}
        jsonLd={itemListJsonLd}
      />

      {/* HERO */}
      <section className="bg-black text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="text-xs uppercase tracking-[0.3em] font-bold" style={{ color: ACCENT }}>
            Guia StockAuto
          </div>
          <h1
            className="mt-4 text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-[0.95]"
            style={{ fontFamily: "Cabinet Grotesk, Inter, sans-serif" }}
          >
            Serviços automotivos<br />em Campo Grande — MS
          </h1>
          <p className="mt-5 max-w-2xl text-zinc-300 text-base md:text-lg leading-relaxed">
            Encontre empresas verificadas de mecânica, funilaria, elétrica, seguros, financiamento e mais.
            Contato direto via WhatsApp — sem intermediário.
          </p>

          <form
            onSubmit={onSearch}
            className="mt-8 max-w-2xl flex flex-col sm:flex-row gap-2"
          >
            <div className="relative flex-1">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                data-testid={SVC.searchInput}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nome ou descrição..."
                className="w-full h-14 pl-12 pr-4 bg-white text-black placeholder-zinc-400 outline-none"
              />
            </div>
            <button
              data-testid={SVC.searchSubmit}
              type="submit"
              className="h-14 px-8 font-bold uppercase tracking-tight text-sm text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: ACCENT }}
            >
              Buscar
            </button>
          </form>
        </div>
      </section>

      {/* CATEGORY FILTER PILLS */}
      <section className="border-b border-zinc-200 sticky top-16 z-30 bg-white/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div data-testid={SVC.categoryFilter} className="flex flex-wrap gap-2">
            <CategoryPill code="all" label="Todas" active={activeCategory === "all"} onClick={setCategory} />
            {categories.map((c) => (
              <CategoryPill
                key={c.code}
                code={c.code}
                label={c.label}
                active={activeCategory === c.code}
                onClick={setCategory}
              />
            ))}
          </div>
        </div>
      </section>

      {/* RESULTS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-64 bg-zinc-100 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="border-2 border-dashed border-zinc-300 py-24 text-center">
            <Wrench size={40} className="mx-auto text-zinc-300" />
            <div className="mt-4 text-lg font-bold tracking-tight">Nenhuma empresa cadastrada neste filtro</div>
            <p className="mt-2 text-sm text-zinc-500">Novos parceiros são cadastrados regularmente pela equipe StockAuto.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map((s) => (
              <ServiceCard key={s.id} s={s} categoryLabel={categories.find((c) => c.code === s.category)?.label} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CategoryPill({ code, label, active, onClick }) {
  return (
    <button
      onClick={() => onClick(code)}
      data-testid={`services-category-${code}`}
      data-active={active ? "true" : "false"}
      className={`px-4 h-9 text-xs font-bold uppercase tracking-tight border transition-colors ${
        active
          ? "text-white border-transparent"
          : "border-zinc-300 hover:border-black"
      }`}
      style={active ? { backgroundColor: ACCENT } : {}}
    >
      {label}
    </button>
  );
}

function ServiceCard({ s, categoryLabel }) {
  return (
    <Link
      to={`/servicos/${s.slug}`}
      data-testid={SVC.card(s.id)}
      className="group bg-white border border-zinc-200 hover:border-black transition-colors flex flex-col"
    >
      <div className="relative h-40 bg-zinc-100 overflow-hidden">
        {s.cover_path ? (
          <img
            src={fileUrl(s.cover_path)}
            alt={`Capa ${s.name}`}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 20% 30%, ${ACCENT} 0%, transparent 45%), radial-gradient(circle at 80% 70%, #1a1a1a 0%, transparent 50%)`,
            }}
          />
        )}
        <span
          className="absolute top-3 left-3 text-[10px] font-black uppercase tracking-widest px-2 py-1 text-white"
          style={{ backgroundColor: ACCENT }}
        >
          {categoryLabel || s.category}
        </span>
      </div>
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-zinc-100 flex items-center justify-center overflow-hidden flex-shrink-0 border border-zinc-200">
            {s.logo_path ? (
              <img src={fileUrl(s.logo_path)} alt={s.name} className="w-full h-full object-cover" />
            ) : (
              <Building2 size={18} className="text-zinc-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-black tracking-tight truncate" style={{ fontFamily: "Cabinet Grotesk, Inter, sans-serif" }}>
              {s.name}
            </div>
            <div className="text-xs text-zinc-500 inline-flex items-center gap-1 mt-0.5">
              <MapPin size={12} /> {s.city}/{s.uf}
            </div>
          </div>
        </div>
        {s.description && (
          <p className="mt-3 text-sm text-zinc-600 line-clamp-2 leading-relaxed">{s.description}</p>
        )}
        <div className="mt-4 pt-4 border-t border-zinc-100 flex items-center justify-between">
          {s.phone ? (
            <span className="text-xs text-zinc-500 inline-flex items-center gap-1">
              <Phone size={12} /> {s.phone}
            </span>
          ) : <span />}
          <span
            className="text-xs font-bold uppercase tracking-tight inline-flex items-center gap-1 group-hover:gap-2 transition-all"
            style={{ color: ACCENT }}
          >
            Ver empresa <ArrowRight size={12} />
          </span>
        </div>
      </div>
    </Link>
  );
}
