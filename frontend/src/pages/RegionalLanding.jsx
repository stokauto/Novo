/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import VehicleCard from "@/components/VehicleCard";
import SEO from "@/components/SEO";
import { MapPin, ArrowRight, Tag } from "lucide-react";

/**
 * Landing regional para SEO local — mostra veículos públicos da cidade/UF
 * e indica que também há um Hub de Repasse B2B disponível para parceiros.
 */
export default function RegionalLanding({ city, uf, citySlug, ufFull, h1, seoTitle, seoDesc }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get("/vehicles", { params: { city, uf, limit: 24 } })
      .then((r) => {
        setItems(r.data.items || []);
        setTotal(r.data.total || 0);
      })
      .catch(() => {
        setItems([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [city, uf]);

  const landingJsonLd = {
    "@context": "https://schema.org",
    "@type": "AutoDealer",
    name: `StockAuto — ${city}`,
    url: `https://stockauto.com.br/seminovos-${citySlug}`,
    areaServed: { "@type": "City", name: city },
    address: {
      "@type": "PostalAddress",
      addressLocality: city,
      addressRegion: uf,
      addressCountry: "BR",
    },
    description: seoDesc,
  };

  return (
    <div data-testid={`regional-${citySlug}`}>
      <SEO
        title={seoTitle}
        description={seoDesc}
        canonical={`/seminovos-${citySlug}`}
        keywords={`seminovos ${city}, carros usados ${city}, comprar veículo ${city} ${uf}, revendedores ${city}, repasse ${city}, StockAuto ${uf}`}
        jsonLd={landingJsonLd}
      />

      {/* HERO */}
      <section className="bg-black text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <div className="inline-flex items-center gap-2 bg-[#FF3B30] text-white text-[10px] font-black uppercase tracking-[0.3em] px-3 py-1.5 mb-5">
            <MapPin size={12} /> {city} · {ufFull}
          </div>
          <h1
            className="text-4xl sm:text-6xl font-black tracking-tighter leading-[0.95]"
            style={{ fontFamily: "Cabinet Grotesk, Inter, sans-serif" }}
          >
            {h1}
          </h1>
          <p className="mt-5 max-w-2xl text-zinc-300 text-base sm:text-lg leading-relaxed">
            Encontre carros, motos, camionetes e caminhões em <strong>{city}/{uf}</strong>.
            Contato direto com revendedores pelo WhatsApp. Lojistas: aproveite o{" "}
            <span className="text-[#F5A623] font-bold">Hub de Repasse B2B</span> exclusivo.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              to={`/veiculos?city=${encodeURIComponent(city)}&uf=${uf}`}
              className="bg-white text-black px-6 h-12 font-bold uppercase tracking-tight text-sm inline-flex items-center gap-2"
            >
              Ver veículos disponíveis <ArrowRight size={14} />
            </Link>
            <Link
              to="/repasse"
              className="border-2 border-[#F5A623] text-[#F5A623] hover:bg-[#F5A623] hover:text-black px-6 h-12 font-bold uppercase tracking-tight text-sm inline-flex items-center gap-2 transition-colors"
            >
              <Tag size={14} /> Acessar Repasses
            </Link>
          </div>
        </div>
      </section>

      {/* GRID */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="flex items-end justify-between mb-8 flex-wrap gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] font-bold text-zinc-500">Catálogo regional</div>
            <h2 className="mt-2 text-2xl md:text-3xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>
              {loading ? "Carregando…" : `${total} ${total === 1 ? "veículo disponível" : "veículos disponíveis"} em ${city}`}
            </h2>
          </div>
          <Link
            to={`/veiculos?city=${encodeURIComponent(city)}&uf=${uf}`}
            className="text-xs font-bold uppercase tracking-tight border-b-2 border-black hover:text-[#FF3B30] hover:border-[#FF3B30]"
          >
            Ver tudo →
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={`skeleton-${i}`} className="h-80 bg-zinc-100 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="border-2 border-dashed border-zinc-300 p-14 text-center">
            <div className="text-xl font-black tracking-tight" style={{ fontFamily: "Cabinet Grotesk" }}>
              Nenhum anúncio ativo em {city} no momento
            </div>
            <p className="mt-3 text-sm text-zinc-500 max-w-md mx-auto">
              Mas estamos crescendo! Cadastre sua loja ou volte em breve para ver as novidades.
            </p>
            <Link
              to="/cadastro"
              className="mt-5 inline-flex bg-black text-white px-5 h-11 items-center font-bold uppercase tracking-tight text-sm"
            >
              Cadastrar loja
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.slice(0, 24).map((v) => (
              <VehicleCard key={v.id} v={v} testIdBuilder={(id) => `regional-${citySlug}-${id}`} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
