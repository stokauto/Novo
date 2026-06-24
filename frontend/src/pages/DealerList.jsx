/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api, { fileUrl } from "@/lib/api";
import SEO from "@/components/SEO";
import { MapPin, Star, Search, Building2 } from "lucide-react";
import { UF_STATES } from "@/lib/format";

export default function DealerList() {
  const [dealers, setDealers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [uf, setUf] = useState("");

  useEffect(() => {
    setLoading(true);
    api
      .get("/dealers", { params: { limit: 100 } })
      .then((r) => setDealers(r.data || []))
      .catch(() => setDealers([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return dealers.filter((d) => {
      if (uf && d.uf !== uf) return false;
      if (!term) return true;
      return (
        (d.store_name || "").toLowerCase().includes(term) ||
        (d.city || "").toLowerCase().includes(term)
      );
    });
  }, [dealers, q, uf]);

  return (
    <div>
      <SEO
        title="Revendedores de veículos em Campo Grande - MS"
        description="Encontre revendedores verificados em Campo Grande/MS e região. Compare lojas, veja estoque atualizado e fale direto via WhatsApp pelo StockAuto."
        canonical="/revendedores"
        keywords="revendedores Campo Grande, lojas de carros Campo Grande MS, concessionárias Campo Grande, seminovos lojas MS"
      />
      {/* HEADER */}
      <section className="bg-black text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="text-xs uppercase tracking-[0.3em] font-bold text-zinc-400">Revendedores</div>
          <h1
            className="mt-3 text-5xl sm:text-6xl lg:text-7xl font-black tracking-tighter leading-[0.95]"
            style={{ fontFamily: "Cabinet Grotesk, Inter, sans-serif" }}
          >
            Lojas <span className="text-[#FF3B30]">parceiras</span>
          </h1>
          <p className="mt-6 text-zinc-300 max-w-xl leading-relaxed">
            Encontre revendedores verificados e fale direto com a loja pelo WhatsApp.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-3 max-w-2xl">
            <div className="flex-1 flex items-center bg-white text-black px-4 h-12">
              <Search size={18} className="text-zinc-500" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nome da loja ou cidade…"
                className="flex-1 ml-3 outline-none bg-transparent text-sm"
              />
            </div>
            <select
              value={uf}
              onChange={(e) => setUf(e.target.value)}
              className="bg-white text-black h-12 px-4 text-sm font-bold uppercase tracking-tight"
            >
              <option value="">Todos os estados</option>
              {UF_STATES.map((u) => (
                <option key={u.code} value={u.code}>
                  {u.code} - {u.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* GRID */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-sm text-zinc-500 mb-6">
          {loading ? "Carregando…" : `${filtered.length} ${filtered.length === 1 ? "revendedor encontrado" : "revendedores encontrados"}`}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Fixed-length skeleton placeholders — index key is intentional */}
            {Array.from({ length: 6 }).map((_, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={`skeleton-${i}`} className="border border-zinc-200 p-6 animate-pulse h-32" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="border border-dashed border-zinc-300 py-24 text-center text-zinc-500">
            Nenhuma loja encontrada com esse filtro.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((d) => (
              <Link
                key={d.id}
                to={`/revendedor/${d.slug || d.id}`}
                className="bg-white border border-zinc-200 p-6 hover:-translate-y-1 hover:shadow-[0_10px_40px_rgb(0,0,0,0.12)] transition-all flex gap-5"
              >
                <div className="w-20 h-20 bg-zinc-100 flex-shrink-0 overflow-hidden">
                  {d.logo_path ? (
                    <img src={fileUrl(d.logo_path)} alt={d.store_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-400">
                      <Building2 size={28} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="font-bold tracking-tight text-lg truncate"
                    style={{ fontFamily: "Cabinet Grotesk" }}
                  >
                    {d.store_name}
                  </div>
                  <div className="mt-1 text-sm text-zinc-600 flex items-center gap-1">
                    <MapPin size={14} /> {d.city}/{d.uf}
                  </div>
                  <div className="mt-2 text-xs text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                    <Star size={12} className="text-[#FF3B30]" fill="#FF3B30" /> {d.active_ads || 0} anúncios ativos
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
