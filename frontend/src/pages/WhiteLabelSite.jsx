import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import axios from "axios";
import { API_BASE, fileUrl } from "@/lib/api";
import { resolveSubdomain } from "@/lib/whiteLabel";
import VehicleCard from "@/components/VehicleCard";
import WhatsAppButton from "@/components/WhatsAppButton";
import ShareControls from "@/components/ShareControls";
import { MapPin, Phone, Instagram, Facebook, Store, Loader2, AlertTriangle } from "lucide-react";

/**
 * White-label store site page.
 *
 * Renders a self-contained storefront for a single dealer, addressed via
 * `<subdomain>.stockauto.com.br` (production) or `?subdomain=<sub>` /
 * localStorage (development). The main StockAuto chrome (header, footer,
 * menu) is intentionally NOT rendered here — the App wrapper decides that
 * based on `isWhiteLabelMode()`.
 */
export default function WhiteLabelSite() {
  const subdomain = useMemo(() => resolveSubdomain(), []);
  const [state, setState] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!subdomain) {
        setState({ loading: false, data: null, error: "not_a_tenant" });
        return;
      }
      try {
        const res = await axios.get(`${API_BASE}/public/store-site`, {
          headers: { "X-StockAuto-Subdomain": subdomain },
          withCredentials: false,
        });
        if (!cancelled) setState({ loading: false, data: res.data, error: null });
      } catch (e) {
        const status = e?.response?.status;
        if (!cancelled) {
          setState({
            loading: false,
            data: null,
            error: status === 404 ? "not_found" : "network",
          });
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [subdomain]);

  if (state.loading) return <FullPageLoader />;
  if (state.error) return <ErrorPage error={state.error} subdomain={subdomain} />;

  const { site, dealer, vehicles } = state.data;
  const primary = site.primary_color || "#111111";
  const secondary = site.secondary_color || "#FF3B30";
  const button = site.button_color || primary;

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

      {/* Inventory grid */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-14">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="text-2xl md:text-3xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>
            Estoque disponível
          </h2>
          <span className="text-xs uppercase tracking-widest font-bold text-zinc-500">
            {vehicles.length} veículo(s)
          </span>
        </div>
        {vehicles.length === 0 ? (
          <div className="border-2 border-dashed border-zinc-300 py-20 text-center">
            <Store size={40} className="mx-auto text-zinc-300" />
            <p className="mt-3 text-zinc-500 text-sm">Nenhum veículo publicado no momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {vehicles.map((v) => (
              <VehicleCard key={v.id} v={v} testIdBuilder={(id) => `wl-vehicle-${id}`} />
            ))}
          </div>
        )}
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
