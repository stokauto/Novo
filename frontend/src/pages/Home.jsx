import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import VehicleCard from "@/components/VehicleCard";
import BannerCarousel from "@/components/BannerCarousel";
import SEO, { SITE_URL } from "@/components/SEO";
import { HOMEPAGE } from "@/constants/testIds";
import { ArrowRight, Search, MapPin, Star } from "lucide-react";
import { fileUrl } from "@/lib/api";

const CATEGORY_META = {
  carro: { label: "Carros", emoji: "—" },
  moto: { label: "Motos", emoji: "—" },
  camionete: { label: "Camionetes", emoji: "—" },
  caminhao: { label: "Caminhões", emoji: "—" },
  onibus: { label: "Ônibus", emoji: "—" },
  nautico: { label: "Náuticos", emoji: "—" },
  utilitario: { label: "Utilitários", emoji: "—" },
  implementos: { label: "Implementos", emoji: "—" },
  tratores: { label: "Tratores", emoji: "—" },
  outros: { label: "Outros", emoji: "—" },
};

export default function Home() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [categories, setCategories] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [dealers, setDealers] = useState([]);
  const [banners, setBanners] = useState([]);
  const [offers, setOffers] = useState([]);

  useEffect(() => {
    document.title = "StockAuto — As melhores ofertas de Campo Grande, MS";
    api.get("/categories").then((r) => setCategories(r.data)).catch(() => {});
    api.get("/vehicles?limit=8").then((r) => setVehicles(r.data.items || [])).catch(() => {});
    api.get("/dealers?limit=6").then((r) => setDealers(r.data || [])).catch(() => {});
    api.get("/banners").then((r) => setBanners(r.data || [])).catch(() => {});
    // Fetch top 4 discounted vehicles (sorted by absolute discount, then % discount)
    api
      .get("/vehicles?has_offer=true&limit=24")
      .then((r) => {
        const items = (r.data.items || [])
          .filter((v) => Number(v.offer_price) > 0 && Number(v.price) > Number(v.offer_price))
          .map((v) => ({ ...v, _discount: Number(v.price) - Number(v.offer_price) }))
          .sort((a, b) => b._discount - a._discount)
          .slice(0, 4);
        setOffers(items);
      })
      .catch(() => setOffers([]));
  }, []);

  const onSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    navigate(`/veiculos${params.toString() ? `?${params.toString()}` : ""}`);
  };

  const homeJsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "StockAuto",
      url: SITE_URL,
      potentialAction: {
        "@type": "SearchAction",
        target: `${SITE_URL}/veiculos?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "AutoDealer",
      name: "StockAuto",
      url: SITE_URL,
      logo: `${SITE_URL}/logo-stockauto-dark.png`,
      description:
        "Marketplace de veículos em Campo Grande, MS — carros, motos, camionetes e caminhões direto com o revendedor.",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Campo Grande",
        addressRegion: "MS",
        addressCountry: "BR",
      },
      geo: { "@type": "GeoCoordinates", latitude: -20.4697, longitude: -54.6201 },
      areaServed: {
        "@type": "City",
        name: "Campo Grande",
        containedInPlace: { "@type": "State", name: "Mato Grosso do Sul" },
      },
    },
  ];

  return (
    <div data-testid={HOMEPAGE.hero}>
      <SEO
        title="StockAuto — Comprar carros, motos e camionetes em Campo Grande, MS"
        description="Marketplace de veículos em Campo Grande, MS. Compre direto do revendedor: carros, motos, camionetes e caminhões. Contato rápido via WhatsApp, sem comissão."
        canonical="/"
        keywords="carros usados Campo Grande, comprar carro Campo Grande MS, seminovos Campo Grande, motos Campo Grande, camionetes Campo Grande, revendedores Campo Grande, StockAuto"
        jsonLd={homeJsonLd}
      />
      {/* SEO H1 — visually hidden but read by Google & screen readers */}
      <h1 className="sr-only">
        StockAuto — Marketplace de veículos em Campo Grande, MS. Compre direto do revendedor:
        carros, motos, camionetes, caminhões e mais, sem intermediação.
      </h1>

      {/* BANNER ROTATIVO (gerenciado pelo admin) */}
      {banners.length > 0 ? (
        <BannerCarousel items={banners} />
      ) : (
        /* Fallback hero quando ainda não há banners cadastrados */
        <section className="relative bg-black text-white overflow-hidden">
          <div className="absolute inset-0 opacity-30 mix-blend-screen" style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, #FF3B30 0%, transparent 40%), radial-gradient(circle at 80% 70%, #1a1a1a 0%, transparent 50%)",
          }} />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 text-center">
            <div className="text-xs font-bold uppercase tracking-[0.3em] text-zinc-400 mb-4">
              Campo Grande · MS · Marketplace de veículos
            </div>
            <div className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-[0.95]"
                 style={{ fontFamily: "Cabinet Grotesk, Inter, sans-serif" }}>
              Compre <span className="text-[#FF3B30]">direto</span> do revendedor.
            </div>
            <p className="mt-5 text-base sm:text-lg text-zinc-300 max-w-2xl mx-auto">
              As melhores ofertas de Campo Grande, MS em um só lugar. Chame no WhatsApp
              e feche negócio direto com a revenda.
            </p>
          </div>
        </section>
      )}

      {/* BUSCADOR — abaixo do banner */}
      <section className="bg-white border-b border-zinc-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14">
          <div className="text-center sm:text-left">
            <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-zinc-500">
              Campo Grande · MS · Marketplace
            </div>
            <div className="mt-2 text-3xl md:text-4xl lg:text-5xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>
              Encontre seu próximo veículo.
            </div>
          </div>
          <form onSubmit={onSearch} className="mt-6 md:mt-8 flex flex-col sm:flex-row gap-3">
            <div className="flex-1 flex items-center bg-zinc-100 px-5 sm:px-6 h-[72px] sm:h-[68px] border border-zinc-200 focus-within:border-black transition-colors">
              <Search size={24} className="text-zinc-500 flex-shrink-0 sm:w-[22px] sm:h-[22px]" />
              <input
                data-testid={HOMEPAGE.searchInput}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Marca, modelo ou cidade…"
                className="flex-1 ml-3 outline-none bg-transparent text-lg sm:text-lg placeholder:text-zinc-500"
              />
            </div>
            <button
              data-testid={HOMEPAGE.searchSubmit}
              type="submit"
              className="bg-[#FF3B30] hover:bg-[#E13128] text-white px-8 sm:px-10 h-[72px] sm:h-[68px] font-bold uppercase tracking-tight text-lg inline-flex items-center justify-center gap-2"
            >
              Buscar <ArrowRight size={20} />
            </button>
          </form>
          <div className="mt-5 flex flex-wrap justify-center sm:justify-start gap-x-6 gap-y-2 text-sm text-zinc-500">
            <Link to="/planos" data-testid={HOMEPAGE.heroCta} className="hover:text-black font-semibold">Anuncie agora →</Link>
            <Link to="/revendedores" className="hover:text-black font-semibold">Revendedores →</Link>
            <Link to="/veiculos" className="hover:text-black font-semibold">Ver todos os veículos →</Link>
          </div>
        </div>
      </section>

      {/* OFERTAS IMPERDÍVEIS — só aparece se houver veículos com offer_price */}
      {offers.length > 0 && (
        <section
          data-testid="home-offers-section"
          className="border-t-4 border-[#FF3B30] bg-gradient-to-b from-red-50/60 to-white"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
            <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] font-black text-[#FF3B30] flex items-center gap-2">
                  <span aria-hidden>🔥</span> Promoções da semana
                </div>
                <h2
                  className="mt-2 text-3xl md:text-4xl font-black tracking-tighter"
                  style={{ fontFamily: "Cabinet Grotesk" }}
                >
                  Ofertas Imperdíveis
                </h2>
                <p className="text-sm text-zinc-600 mt-1">
                  Maiores descontos selecionados pelos revendedores de Campo Grande/MS.
                </p>
              </div>
              <Link
                to="/veiculos?oferta=true"
                data-testid="home-offers-see-all"
                className="text-xs font-bold uppercase tracking-tight border-b-2 border-[#FF3B30] text-[#FF3B30] hover:text-black hover:border-black inline-flex items-center gap-1"
              >
                Ver todas as ofertas <ArrowRight size={14} />
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {offers.map((v) => (
                <VehicleCard
                  key={v.id}
                  v={v}
                  testIdBuilder={(id) => `home-offer-${id}`}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CATEGORIES */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] font-bold text-zinc-500">Categorias</div>
            <h2 className="mt-2 text-3xl md:text-4xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>
              O que você procura?
            </h2>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {categories.map((c) => (
            <Link
              key={c.code}
              to={`/veiculos?category=${c.code}`}
              data-testid={HOMEPAGE.categoryCard(c.code)}
              className="border border-zinc-200 p-6 hover:border-black hover:bg-black hover:text-white transition-all group"
            >
              <div className="text-2xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>
                {c.label}
              </div>
              <div className="mt-3 text-xs uppercase tracking-widest text-zinc-500 group-hover:text-zinc-300 flex items-center gap-1">
                Ver <ArrowRight size={12} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* FEATURED VEHICLES */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] font-bold text-zinc-500">Em destaque</div>
            <h2 className="mt-2 text-3xl md:text-4xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>
              Recém anunciados
            </h2>
          </div>
          <Link to="/veiculos" className="text-sm font-bold uppercase tracking-tight border-b-2 border-black hover:text-[#FF3B30] hover:border-[#FF3B30]">
            Ver todos
          </Link>
        </div>
        <div data-testid={HOMEPAGE.featuredGrid} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {vehicles.map((v) => (
            <VehicleCard key={v.id} v={v} testIdBuilder={HOMEPAGE.vehicleCard} />
          ))}
          {vehicles.length === 0 && (
            <div className="col-span-full text-zinc-500 py-12 text-center">Nenhum anúncio disponível ainda.</div>
          )}
        </div>
      </section>

      {/* DEALERS */}
      <section data-testid={HOMEPAGE.dealersSection} className="bg-zinc-50 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="flex items-end justify-between mb-10">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] font-bold text-zinc-500">Revendedores</div>
              <h2 className="mt-2 text-3xl md:text-4xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>
                Lojas parceiras
              </h2>
            </div>
            <Link to="/revendedores" className="text-sm font-bold uppercase tracking-tight border-b-2 border-black hover:text-[#FF3B30] hover:border-[#FF3B30]">
              Ver todas
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {dealers.map((d) => (
              <Link
                key={d.id}
                to={`/revendedor/${d.slug || d.id}`}
                className="bg-white border border-zinc-200 p-6 hover:-translate-y-1 hover:shadow-[0_10px_40px_rgb(0,0,0,0.12)] transition-all flex gap-5"
              >
                <div className="w-20 h-20 bg-zinc-100 flex-shrink-0 overflow-hidden">
                  {d.logo_path ? (
                    <img src={fileUrl(d.logo_path)} alt={d.store_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-400 text-xs uppercase">Loja</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold tracking-tight text-lg truncate" style={{ fontFamily: "Cabinet Grotesk" }}>
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
            {dealers.length === 0 && (
              <div className="col-span-full text-zinc-500 py-12 text-center">Nenhum revendedor ativo ainda.</div>
            )}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-black text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] font-bold text-zinc-400 mb-4">Para revendedores</div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>
              Venda mais.<br />
              <span className="text-[#FF3B30]">Sem comissões.</span>
            </h2>
            <p className="mt-6 text-zinc-300 max-w-md">
              Comece com o plano Avulso ou destaque seu estoque inteiro com o plano Loja.
              Pagamento simples via Pix.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/planos"
              data-testid={HOMEPAGE.heroCtaPainel}
              className="bg-[#FF3B30] hover:bg-[#E13128] px-8 py-5 text-base font-bold uppercase tracking-tight inline-flex items-center justify-center gap-2"
            >
              Ver planos <ArrowRight size={18} />
            </Link>
            <Link
              to="/cadastro"
              className="border border-white px-8 py-5 text-base font-bold uppercase tracking-tight inline-flex items-center justify-center gap-2 hover:bg-white hover:text-black transition-colors"
            >
              Cadastrar loja
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
