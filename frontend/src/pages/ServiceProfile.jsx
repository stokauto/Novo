import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api, { fileUrl } from "@/lib/api";
import WhatsAppButton from "@/components/WhatsAppButton";
import SEO, { SITE_URL } from "@/components/SEO";
import { SVC } from "@/constants/testIds";
import { MapPin, Phone, ArrowLeft, Wrench, Building2, Copy, Check } from "lucide-react";
import { digits } from "@/lib/format";

const ACCENT = "#0E7C86";

export default function ServiceProfile() {
  const { slug } = useParams();
  const [svc, setSvc] = useState(null);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    setSvc(null);
    setError(null);
    api
      .get(`/services/${slug}`)
      .then((r) => setSvc(r.data))
      .catch((e) => setError(e?.response?.data?.detail || "Empresa não encontrada."))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    api.get("/service-categories").then((r) => setCategories(r.data || [])).catch(() => {});
  }, []);

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API may not be available (older browsers / iframe); ignore silently.
    }
  };

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-32">
        <div className="text-xs uppercase tracking-[0.3em] font-bold text-zinc-500">Ops</div>
        <h1 className="mt-3 text-5xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>
          {error}
        </h1>
        <Link to="/servicos" className="mt-8 inline-flex items-center gap-2 text-sm font-bold uppercase border-b-2 border-black">
          <ArrowLeft size={16} /> Ver todos os serviços
        </Link>
      </div>
    );
  }

  if (loading || !svc) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 animate-pulse">
        <div className="h-48 bg-zinc-100" />
        <div className="h-10 w-1/2 bg-zinc-100 mt-8" />
      </div>
    );
  }

  const canonical = `/servicos/${svc.slug || slug}`;
  const categoryLabel = categories.find((c) => c.code === svc.category)?.label || svc.category;
  const seoTitle = `${svc.name} — ${categoryLabel} em ${svc.city}/${svc.uf}`;
  const seoDesc = (svc.description && svc.description.slice(0, 180)) ||
    `${svc.name} — ${categoryLabel} em ${svc.city}/${svc.uf}. Contato direto via WhatsApp pelo StockAuto.`;
  const seoImage = svc.cover_path
    ? fileUrl(svc.cover_path)
    : svc.logo_path
    ? fileUrl(svc.logo_path)
    : undefined;

  const businessJsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${SITE_URL}${canonical}`,
    name: svc.name,
    url: `${SITE_URL}${canonical}`,
    image: seoImage,
    description: svc.description || seoDesc,
    telephone: svc.phone || svc.whatsapp || undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: svc.address || undefined,
      addressLocality: svc.city,
      addressRegion: svc.uf,
      addressCountry: "BR",
    },
    areaServed: { "@type": "City", name: svc.city },
    knowsAbout: categoryLabel,
    sameAs: svc.whatsapp ? [`https://wa.me/${digits(svc.whatsapp)}`] : undefined,
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Serviços", item: `${SITE_URL}/servicos` },
      { "@type": "ListItem", position: 3, name: categoryLabel, item: `${SITE_URL}/servicos?category=${svc.category}` },
      { "@type": "ListItem", position: 4, name: svc.name, item: `${SITE_URL}${canonical}` },
    ],
  };

  const waMessage = `Olá ${svc.name}! Vim pelo StockAuto e gostaria de saber mais sobre os serviços.`;

  return (
    <div data-testid={SVC.profile}>
      <SEO
        title={seoTitle}
        description={seoDesc}
        canonical={canonical}
        image={seoImage}
        type="profile"
        jsonLd={[businessJsonLd, breadcrumbJsonLd]}
      />

      {/* COVER */}
      <div className="relative h-48 md:h-72 bg-black overflow-hidden">
        {svc.cover_path ? (
          <img src={fileUrl(svc.cover_path)} alt={`Capa ${svc.name}`} className="w-full h-full object-cover opacity-80" />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 20% 30%, ${ACCENT} 0%, transparent 45%), radial-gradient(circle at 80% 70%, #1a1a1a 0%, transparent 50%)`,
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
      </div>

      {/* HEADER CARD */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 md:-mt-20 relative">
        <div className="bg-white border border-zinc-200 p-6 md:p-8 flex flex-col md:flex-row gap-6 md:items-center shadow-[0_10px_40px_rgba(0,0,0,0.08)]">
          <div className="w-24 h-24 md:w-28 md:h-28 bg-zinc-100 flex-shrink-0 overflow-hidden border border-zinc-200">
            {svc.logo_path ? (
              <img src={fileUrl(svc.logo_path)} alt={svc.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-400">
                <Building2 size={36} />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div
              className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2 py-1 text-white"
              style={{ backgroundColor: ACCENT }}
            >
              <Wrench size={12} /> {categoryLabel}
            </div>
            <h1
              className="mt-3 text-3xl md:text-4xl font-black tracking-tighter leading-tight"
              style={{ fontFamily: "Cabinet Grotesk, Inter, sans-serif" }}
            >
              {svc.name}
            </h1>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600">
              {(svc.city || svc.uf) && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={14} /> {svc.city}/{svc.uf}
                </span>
              )}
              {svc.phone && (
                <a href={`tel:${digits(svc.phone)}`} className="inline-flex items-center gap-1 hover:text-black">
                  <Phone size={14} /> {svc.phone}
                </a>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            {svc.whatsapp && (
              <WhatsAppButton
                whatsapp={svc.whatsapp}
                message={waMessage}
                label="Chamar no WhatsApp"
                size="md"
                data-testid="service-whatsapp-cta"
              />
            )}
            <button
              onClick={doCopy}
              className="inline-flex items-center justify-center gap-2 border border-zinc-300 hover:border-black px-4 py-3 text-sm font-bold uppercase tracking-tight"
              data-testid="service-share-copy"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "Copiado!" : "Copiar link"}
            </button>
          </div>
        </div>

        {/* CONTENT */}
        <div className="mt-10 grid md:grid-cols-3 gap-10">
          <div className="md:col-span-2">
            {svc.description && (
              <>
                <div className="text-xs uppercase tracking-[0.3em] font-bold text-zinc-500 mb-3">Sobre a empresa</div>
                <p className="text-zinc-700 leading-relaxed whitespace-pre-line text-base">
                  {svc.description}
                </p>
              </>
            )}

            <div className="mt-10">
              <Link
                to="/servicos"
                className="inline-flex items-center gap-2 text-sm font-bold uppercase border-b-2 border-black pb-0.5"
              >
                <ArrowLeft size={16} /> Voltar para todos os serviços
              </Link>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="border border-zinc-200 p-5">
              <div className="text-xs uppercase tracking-[0.3em] font-bold text-zinc-500 mb-3">Localização</div>
              <div className="flex items-start gap-2 text-sm text-zinc-700">
                <MapPin size={16} className="text-zinc-400 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-bold">{svc.city}/{svc.uf}</div>
                  {svc.address && <div className="text-zinc-600 mt-0.5">{svc.address}</div>}
                </div>
              </div>
            </div>

            {(svc.phone || svc.whatsapp) && (
              <div className="border border-zinc-200 p-5">
                <div className="text-xs uppercase tracking-[0.3em] font-bold text-zinc-500 mb-3">Contato</div>
                <div className="space-y-2 text-sm">
                  {svc.phone && (
                    <a href={`tel:${digits(svc.phone)}`} className="flex items-center gap-2 hover:text-black">
                      <Phone size={14} className="text-zinc-400" /> {svc.phone}
                    </a>
                  )}
                  {svc.whatsapp && (
                    <div className="flex items-center gap-2 text-zinc-700">
                      <Phone size={14} className="text-zinc-400" /> {svc.whatsapp} (WhatsApp)
                    </div>
                  )}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      <div className="h-24" />
    </div>
  );
}
