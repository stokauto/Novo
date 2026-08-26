import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { fileUrl } from "@/lib/api";
import { brl, vehiclePrice, km, waLink, digits, txLabel, fuelLabel } from "@/lib/format";
import WhatsAppButton, { WhatsAppIcon } from "@/components/WhatsAppButton";
import SEO, { SITE_URL } from "@/components/SEO";
import { DETAIL } from "@/constants/testIds";
import { MapPin, Phone, Share2, Copy, ArrowLeft, Check, Calendar, Gauge, Fuel, Settings, Palette, ChevronLeft, ChevronRight, X, ZoomIn, Play } from "lucide-react";

export default function VehicleDetail() {
  const { slug } = useParams();
  const [v, setV] = useState(null);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);

  useEffect(() => {
    setV(null);
    setError(null);
    api
      .get(`/vehicles/${slug}`)
      .then((r) => setV(r.data))
      .catch((e) => setError(e?.response?.data?.detail || "Anúncio não encontrado."));
  }, [slug]);

  // Set SEO title + meta description (kept for non-Helmet fallback / older bots)
  useEffect(() => {
    if (!v) return;
    const title = `${v.brand} ${v.model} ${v.year_model} em ${v.city} - ${v.uf} | StockAuto`;
    document.title = title;
  }, [v]);

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-32">
        <div className="text-xs uppercase tracking-[0.3em] font-bold text-zinc-500">Ops</div>
        <h1 className="mt-3 text-5xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>
          {error}
        </h1>
        <Link to="/veiculos" className="mt-8 inline-flex items-center gap-2 text-sm font-bold uppercase border-b-2 border-black">
          <ArrowLeft size={16} /> Voltar para a listagem
        </Link>
      </div>
    );
  }

  if (!v) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 animate-pulse">
        <div className="h-4 w-40 bg-zinc-100 mb-4" />
        <div className="h-10 w-2/3 bg-zinc-100 mb-10" />
        <div className="grid md:grid-cols-12 gap-8">
          <div className="md:col-span-8 aspect-[4/3] bg-zinc-100" />
          <div className="md:col-span-4 h-96 bg-zinc-100" />
        </div>
      </div>
    );
  }

  const photos = (v.photos && v.photos.length ? v.photos : v.main_photo ? [v.main_photo] : []).filter(Boolean);
  const photo = photos[active];
  const videoPath = v.video || null;
  const dealer = v.dealer || {};
  const title = `${v.brand} ${v.model}${v.version ? " " + v.version : ""}`;
  const waMessage = `Olá! Tenho interesse no ${title} ${v.year_made}/${v.year_model} anunciado no StockAuto. Ainda está disponível?`;
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareMsg = `Olha esse ${title} ${v.year_model} por ${brl(v.price)} no StockAuto: ${shareUrl}`;

  // SEO data
  const seoTitle = `${v.brand} ${v.model} ${v.year_model} em ${v.city} - ${v.uf}`;
  const seoDesc = `${v.brand} ${v.model}${v.version ? " " + v.version : ""} ${v.year_made}/${v.year_model}${
    v.km ? `, ${km(v.km)}` : ""
  }${v.color ? `, cor ${v.color}` : ""}, em ${v.city}/${v.uf}. ${
    v.price ? brl(v.price) : "Consulte valor"
  }. Fale direto no WhatsApp com ${dealer.store_name || "o revendedor"}.`;
  const seoImage = photo ? fileUrl(photo) : undefined;
  const canonical = `/veiculo/${v.slug || ""}`;

  const vehicleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Vehicle",
    name: `${v.brand} ${v.model}${v.version ? " " + v.version : ""} ${v.year_model}`,
    description: v.description || seoDesc,
    brand: { "@type": "Brand", name: v.brand },
    model: v.model,
    vehicleModelDate: String(v.year_model),
    productionDate: String(v.year_made),
    mileageFromOdometer: v.km ? { "@type": "QuantitativeValue", value: v.km, unitCode: "KMT" } : undefined,
    fuelType: fuelLabel(v.fuel),
    vehicleTransmission: txLabel(v.transmission),
    color: v.color || undefined,
    image: photos.map((p) => fileUrl(p)),
    url: `${SITE_URL}${canonical}`,
    offers: {
      "@type": "Offer",
      priceCurrency: "BRL",
      price: v.price || undefined,
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/UsedCondition",
      areaServed: { "@type": "City", name: v.city },
      seller: dealer.store_name
        ? {
            "@type": "AutoDealer",
            name: dealer.store_name,
            telephone: dealer.phone || undefined,
            address: {
              "@type": "PostalAddress",
              addressLocality: dealer.city || v.city,
              addressRegion: dealer.uf || v.uf,
              addressCountry: "BR",
            },
          }
        : undefined,
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Veículos", item: `${SITE_URL}/veiculos` },
      {
        "@type": "ListItem",
        position: 3,
        name: v.category,
        item: `${SITE_URL}/veiculos?category=${v.category}`,
      },
      { "@type": "ListItem", position: 4, name: title, item: `${SITE_URL}${canonical}` },
    ],
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      // Clipboard API indisponível (HTTP, permission denied, etc.)
      console.warn("[share.copyLink] clipboard unavailable", err?.message || err);
    }
  };

  return (
    <div data-testid={DETAIL.page} className="pb-32 md:pb-16">
      <SEO
        title={seoTitle}
        description={seoDesc}
        canonical={canonical}
        image={seoImage}
        type="product"
        jsonLd={[vehicleJsonLd, breadcrumbJsonLd]}
      />
      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 text-xs uppercase tracking-widest text-zinc-500 flex items-center gap-2">
        <Link to="/" className="hover:text-black">Início</Link>
        <span>/</span>
        <Link to="/veiculos" className="hover:text-black">Veículos</Link>
        <span>/</span>
        <Link to={`/veiculos?category=${v.category}`} className="hover:text-black">{v.category}</Link>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* GALLERY */}
        <div className="lg:col-span-8" data-testid={DETAIL.gallery}>
          <button
            type="button"
            onClick={() => photo && setLightbox(true)}
            className="group relative w-full aspect-[4/3] bg-zinc-100 overflow-hidden border border-zinc-200 cursor-zoom-in"
          >
            {photo ? (
              <>
                <img
                  src={fileUrl(photo)}
                  alt={`${title} ${v.year_model} em ${v.city} - ${v.uf}${dealer.store_name ? ` - Revenda ${dealer.store_name}` : ""}`}
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 bg-black/70 text-white text-xs font-bold uppercase tracking-tight px-3 py-1.5 opacity-90 group-hover:opacity-100">
                  <ZoomIn size={14} /> Ampliar
                </span>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-400">sem foto</div>
            )}
          </button>
          {(photos.length > 1 || videoPath) && (
            <div className="mt-3 grid grid-cols-4 sm:grid-cols-6 gap-2">
              {photos.map((p, i) => (
                <button
                  key={p || `photo-${i}`}
                  onClick={() => setActive(i)}
                  className={`aspect-square overflow-hidden border-2 ${
                    i === active ? "border-black" : "border-transparent hover:border-zinc-400"
                  }`}
                >
                  <img src={fileUrl(p)} alt={`foto ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
              {videoPath && (
                <button
                  type="button"
                  onClick={() => setVideoOpen(true)}
                  data-testid="detail-video-tile"
                  className="relative aspect-square bg-black overflow-hidden border-2 border-transparent hover:border-[#FF3B30] group"
                  aria-label="Assistir vídeo do veículo"
                >
                  <video
                    src={fileUrl(videoPath)}
                    preload="metadata"
                    muted
                    playsInline
                    className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-11 h-11 bg-[#FF3B30] rounded-full flex items-center justify-center shadow-lg">
                      <Play size={20} className="text-white ml-0.5" fill="white" />
                    </div>
                  </div>
                  <span className="absolute bottom-1 left-1 bg-black/80 text-white text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5">
                    Vídeo
                  </span>
                </button>
              )}
            </div>
          )}

          {/* SPECS */}
          <div className="mt-10" data-testid={DETAIL.specs}>
            <div className="text-xs uppercase tracking-[0.3em] font-bold text-zinc-500 mb-4">Ficha técnica</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-zinc-200 border border-zinc-200">
              <Spec icon={<Calendar size={16} />} label="Ano" value={`${v.year_made}/${v.year_model}`} />
              <Spec icon={<Gauge size={16} />} label="KM" value={km(v.km)} />
              <Spec icon={<Settings size={16} />} label="Câmbio" value={txLabel(v.transmission)} />
              <Spec icon={<Fuel size={16} />} label="Combustível" value={fuelLabel(v.fuel)} />
              <Spec icon={<Palette size={16} />} label="Cor" value={v.color || "—"} />
              <Spec icon={<MapPin size={16} />} label="Local" value={`${v.city}/${v.uf}`} />
            </div>
          </div>

          {/* DESCRIPTION */}
          <div className="mt-10" data-testid={DETAIL.description}>
            <div className="text-xs uppercase tracking-[0.3em] font-bold text-zinc-500 mb-4">Descrição</div>
            <p className="text-zinc-700 leading-relaxed whitespace-pre-line">
              {v.description || "Sem descrição informada pelo revendedor."}
            </p>
          </div>
        </div>

        {/* SIDE: TITLE + CTA + DEALER */}
        <aside className="lg:col-span-4 lg:sticky lg:top-24 self-start">
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500">
            {v.brand} • {v.year_made}/{v.year_model}
          </div>
          <h1
            data-testid={DETAIL.title}
            className="mt-2 text-3xl sm:text-4xl font-black tracking-tighter leading-[1.05]"
            style={{ fontFamily: "Cabinet Grotesk, Inter, sans-serif" }}
          >
            {title}
          </h1>
          <div className="mt-3 text-sm text-zinc-600 flex items-center gap-2">
            <MapPin size={14} /> {v.city}/{v.uf}
          </div>

          <div
            data-testid={DETAIL.price}
            className={`mt-6 text-4xl font-black tracking-tighter ${Number(v.price) > 0 ? "text-[#FF3B30]" : "text-zinc-500"}`}
            style={{ fontFamily: "Cabinet Grotesk" }}
          >
            {vehiclePrice(v.price)}
          </div>

          {dealer.whatsapp && (
            <div className="mt-6">
              <WhatsAppButton
                whatsapp={dealer.whatsapp}
                message={waMessage}
                label="Chamar no WhatsApp"
                className="w-full"
                data-testid={DETAIL.whatsappCta}
              />
            </div>
          )}

          {dealer.phone && (
            <a
              href={`tel:${digits(dealer.phone)}`}
              data-testid={DETAIL.callDealer}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 border border-zinc-300 px-6 py-4 text-sm font-bold uppercase tracking-tight hover:border-black"
            >
              <Phone size={16} /> {dealer.phone}
            </a>
          )}

          {/* DEALER CARD */}
          <div
            data-testid={DETAIL.dealerCard}
            className="mt-6 border border-zinc-200 p-5 flex gap-4 items-center"
          >
            <div className="w-14 h-14 bg-zinc-100 flex-shrink-0 overflow-hidden">
              {dealer.logo_path ? (
                <img src={fileUrl(dealer.logo_path)} alt={dealer.store_name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-400 text-[10px] uppercase">Loja</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">Anunciante</div>
              <Link
                to={`/revendedor/${dealer.slug || dealer.id}`}
                data-testid={DETAIL.dealerLink}
                className="font-bold tracking-tight truncate block hover:text-[#FF3B30]"
                style={{ fontFamily: "Cabinet Grotesk" }}
              >
                {dealer.store_name || "Revendedor"}
              </Link>
              {dealer.city && (
                <div className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                  <MapPin size={12} /> {dealer.city}/{dealer.uf}
                </div>
              )}
            </div>
          </div>

          {/* SHARE */}
          <div className="mt-6 flex items-center gap-2">
            <a
              href={waLink("", shareMsg)}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={DETAIL.shareWhatsapp}
              className="flex-1 inline-flex items-center justify-center gap-2 border border-zinc-300 h-11 text-xs font-bold uppercase tracking-tight hover:border-black"
            >
              <Share2 size={14} /> Compartilhar
            </a>
            <button
              onClick={copyLink}
              data-testid={DETAIL.shareCopy}
              className="flex-1 inline-flex items-center justify-center gap-2 border border-zinc-300 h-11 text-xs font-bold uppercase tracking-tight hover:border-black"
            >
              {copied ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar link</>}
            </button>
          </div>
        </aside>
      </div>

      {/* STICKY MOBILE CTA */}
      {(dealer.whatsapp || dealer.phone) && (
        <div className="fixed md:hidden bottom-0 left-0 right-0 z-40 bg-white border-t border-zinc-200 p-3 flex items-center gap-2 shadow-[0_-10px_30px_rgba(0,0,0,0.08)]">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-zinc-500">Preço</div>
            <div className={`text-base font-black tracking-tighter truncate ${Number(v.price) > 0 ? "text-[#FF3B30]" : "text-zinc-500"}`} style={{ fontFamily: "Cabinet Grotesk" }}>
              {vehiclePrice(v.price)}
            </div>
          </div>
          {dealer.phone && (
            <a
              href={`tel:${digits(dealer.phone)}`}
              data-testid="detail-call-dealer-mobile"
              className="inline-flex items-center justify-center border border-zinc-300 h-12 px-4 text-sm font-bold uppercase tracking-tight hover:border-black"
              aria-label="Ligar para o vendedor"
            >
              <Phone size={18} />
            </a>
          )}
          {dealer.whatsapp && (
            <a
              href={waLink(dealer.whatsapp, waMessage)}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={DETAIL.whatsappStickyMobile}
              className="inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1DA851] text-white px-5 h-12 text-sm font-bold uppercase tracking-tight"
            >
              <WhatsAppIcon size={18} /> WhatsApp
            </a>
          )}
        </div>
      )}

      {/* LIGHTBOX */}
      {lightbox && photos.length > 0 && (
        <div
          className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center"
          data-testid="detail-lightbox"
          onClick={() => setLightbox(false)}
        >
          <button
            onClick={() => setLightbox(false)}
            data-testid="detail-lightbox-close"
            className="absolute top-5 right-5 text-white/80 hover:text-white p-2"
            aria-label="Fechar"
          >
            <X size={28} />
          </button>
          {photos.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setActive((a) => (a - 1 + photos.length) % photos.length); }}
              data-testid="detail-lightbox-prev"
              className="absolute left-3 sm:left-6 text-white/80 hover:text-white p-2"
              aria-label="Anterior"
            >
              <ChevronLeft size={40} />
            </button>
          )}
          <img
            src={fileUrl(photos[active])}
            alt={`${title} ${active + 1}`}
            className="max-h-[85vh] max-w-[90vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {photos.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setActive((a) => (a + 1) % photos.length); }}
              data-testid="detail-lightbox-next"
              className="absolute right-3 sm:right-6 text-white/80 hover:text-white p-2"
              aria-label="Próxima"
            >
              <ChevronRight size={40} />
            </button>
          )}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white/80 text-sm font-bold">
            {active + 1} / {photos.length}
          </div>
        </div>
      )}

      {/* VIDEO LIGHTBOX */}
      {videoOpen && videoPath && (
        <div
          className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center px-4"
          data-testid="detail-video-lightbox"
          onClick={() => setVideoOpen(false)}
        >
          <button
            onClick={() => setVideoOpen(false)}
            data-testid="detail-video-close"
            className="absolute top-5 right-5 text-white/80 hover:text-white p-2"
            aria-label="Fechar vídeo"
          >
            <X size={28} />
          </button>
          <video
            src={fileUrl(videoPath)}
            controls
            autoPlay
            playsInline
            className="max-h-[85vh] max-w-[95vw] w-auto bg-black"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

function Spec({ icon, label, value }) {
  return (
    <div className="bg-white p-4">
      <div className="text-zinc-400 mb-2">{icon}</div>
      <div className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
      <div className="font-bold tracking-tight mt-0.5">{value}</div>
    </div>
  );
}
