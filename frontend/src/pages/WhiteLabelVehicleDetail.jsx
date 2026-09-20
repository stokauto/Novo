import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import axios from "axios";
import { API_BASE, fileUrl } from "@/lib/api";
import { resolveSubdomain } from "@/lib/whiteLabel";
import WhatsAppButton from "@/components/WhatsAppButton";
import ShareControls from "@/components/ShareControls";
import {
  ArrowLeft, MapPin, Phone, Calendar, Gauge, Fuel, Settings, Palette,
  ChevronLeft, ChevronRight, X, ZoomIn, Play, Loader2, AlertTriangle,
} from "lucide-react";
import { brl, km as kmFmt, txLabel, fuelLabel, vehiclePrice } from "@/lib/format";

/**
 * Vehicle detail page for the tenant white-label site.
 *
 * Loads through /public/store-site/vehicle/{slug} which enforces:
 *   - the vehicle belongs to the tenant's dealer,
 *   - the vehicle is active and non-repasse,
 *   - the site is active.
 *
 * Renders WITHOUT the main StockAuto chrome (no header/menu/logo of the
 * portal, no "voltar ao StockAuto" link). The only "back" affordance points
 * to the tenant's own home ("/").
 */
export default function WhiteLabelVehicleDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const subdomain = useMemo(() => resolveSubdomain(), []);
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!subdomain) {
        setState({ loading: false, data: null, error: "not_a_tenant" });
        return;
      }
      try {
        const res = await axios.get(
          `${API_BASE}/public/store-site/vehicle/${encodeURIComponent(slug)}`,
          {
            headers: { "X-StockAuto-Subdomain": subdomain },
            withCredentials: false,
          },
        );
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
  }, [slug, subdomain]);

  if (state.loading) return <FullPageLoader />;
  if (state.error) return <ErrorPage error={state.error} />;

  const { site, dealer, vehicle: v } = state.data;
  const primary = site.primary_color || "#111111";
  const secondary = site.secondary_color || "#FF3B30";
  const button = site.button_color || primary;

  const photos = (v.photos && v.photos.length ? v.photos : v.main_photo ? [v.main_photo] : []).filter(Boolean);
  const photo = photos[active];
  const videoPath = v.video || null;

  const title = `${v.brand} ${v.model}${v.version ? " " + v.version : ""} ${v.year_model}`;
  const desc = (v.description || `${title} disponível em ${dealer.store_name}, ${v.city}/${v.uf}.`).slice(0, 180);

  const waMessage = `Olá ${dealer.store_name}! Vi o ${title} no site de vocês e gostaria de mais informações.`;

  return (
    <div
      data-testid="wl-vehicle-page"
      className="min-h-screen bg-white"
      style={{ ["--wl-primary"]: primary, ["--wl-secondary"]: secondary, ["--wl-button"]: button }}
    >
      <Helmet>
        <title>{`${title} — ${dealer.store_name}`}</title>
        <meta name="description" content={desc} />
        {site.favicon_path && <link rel="icon" href={fileUrl(site.favicon_path)} />}
      </Helmet>

      {/* Tenant-only compact header (no StockAuto branding) */}
      <header className="border-b sticky top-0 z-40 bg-white/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate("/")}
            data-testid="wl-vehicle-back"
            className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-tight border-b-2 pb-0.5 hover:opacity-80"
            style={{ borderColor: primary, color: primary }}
          >
            <ArrowLeft size={14} /> Voltar ao estoque
          </button>
          <div className="flex-1" />
          {dealer.whatsapp && (
            <WhatsAppButton
              whatsapp={dealer.whatsapp}
              message={waMessage}
              label="WhatsApp"
              size="md"
              data-testid="wl-vehicle-header-wa"
            />
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 md:py-10">
        <div className="text-xs uppercase tracking-[0.3em] font-bold" style={{ color: secondary }}>
          {dealer.store_name}
        </div>
        <h1
          className="mt-3 text-3xl md:text-5xl font-black tracking-tighter leading-[0.95]"
          style={{ color: primary, fontFamily: "Cabinet Grotesk, Inter, sans-serif" }}
        >
          {title}
        </h1>
        <div className="mt-2 text-sm text-zinc-500 flex items-center gap-1">
          <MapPin size={14} /> {v.city}/{v.uf}
        </div>

        <div className="mt-8 grid md:grid-cols-12 gap-10">
          {/* Gallery + description */}
          <div className="md:col-span-8">
            <div className="relative bg-zinc-100 aspect-[4/3] overflow-hidden group cursor-zoom-in"
                 onClick={() => photo && setLightbox(true)}
                 data-testid="wl-vehicle-gallery">
              {photo ? (
                <>
                  <img src={fileUrl(photo)} alt={title} className="w-full h-full object-cover" />
                  <div className="absolute top-3 right-3 bg-white/85 backdrop-blur-sm p-2">
                    <ZoomIn size={16} />
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-400 text-sm">Sem foto</div>
              )}
            </div>
            {(photos.length > 1 || videoPath) && (
              <div className="mt-3 grid grid-cols-4 sm:grid-cols-6 gap-2">
                {photos.map((p, i) => (
                  <button
                    key={p || `p-${i}`}
                    onClick={() => setActive(i)}
                    className={`aspect-square overflow-hidden border-2 ${i === active ? "border-black" : "border-transparent hover:border-zinc-400"}`}
                  >
                    <img src={fileUrl(p)} alt={`foto ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
                {videoPath && (
                  <button
                    type="button"
                    onClick={() => setVideoOpen(true)}
                    data-testid="wl-vehicle-video-tile"
                    className="relative aspect-square bg-black overflow-hidden border-2 border-transparent hover:border-current group"
                    style={{ color: secondary }}
                    aria-label="Assistir vídeo"
                  >
                    <video src={fileUrl(videoPath)} preload="metadata" muted playsInline
                           className="w-full h-full object-cover opacity-70" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg" style={{ backgroundColor: secondary }}>
                        <Play size={18} className="text-white ml-0.5" fill="white" />
                      </div>
                    </div>
                  </button>
                )}
              </div>
            )}

            {v.description && (
              <>
                <div className="text-xs uppercase tracking-[0.3em] font-bold text-zinc-500 mt-10 mb-3">
                  Descrição
                </div>
                <p className="text-zinc-700 leading-relaxed whitespace-pre-line">
                  {v.description}
                </p>
              </>
            )}
          </div>

          {/* Sticky sidebar */}
          <aside className="md:col-span-4">
            <div className="border border-zinc-200 p-6 sticky top-24">
              <div className="text-xs uppercase tracking-[0.3em] font-bold text-zinc-500">Valor</div>
              <div
                className={`mt-2 text-4xl font-black tracking-tighter ${Number(v.price) > 0 ? "" : "text-zinc-500"}`}
                style={{
                  color: Number(v.price) > 0 ? secondary : undefined,
                  fontFamily: "Cabinet Grotesk",
                }}
                data-testid="wl-vehicle-price"
              >
                {vehiclePrice(v.price)}
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                <Spec icon={Calendar} label="Ano" value={`${v.year_made}/${v.year_model}`} />
                <Spec icon={Gauge} label="Km" value={kmFmt(v.km)} />
                <Spec icon={Settings} label="Câmbio" value={txLabel(v.transmission) || "—"} />
                <Spec icon={Fuel} label="Combustível" value={fuelLabel(v.fuel) || "—"} />
                <Spec icon={Palette} label="Cor" value={v.color || "—"} />
                <Spec icon={MapPin} label="Cidade" value={`${v.city}/${v.uf}`} />
              </div>

              <div className="mt-6 space-y-2">
                {dealer.whatsapp && (
                  <WhatsAppButton
                    whatsapp={dealer.whatsapp}
                    message={waMessage}
                    label="Chamar no WhatsApp"
                    size="md"
                    data-testid="wl-vehicle-cta-wa"
                  />
                )}
                {dealer.phone && (
                  <a
                    href={`tel:${(dealer.phone || "").replace(/\D/g, "")}`}
                    className="w-full inline-flex items-center justify-center gap-2 border border-zinc-300 hover:border-black px-4 h-12 font-bold uppercase tracking-tight text-sm"
                  >
                    <Phone size={16} /> {dealer.phone}
                  </a>
                )}
              </div>

              <div className="mt-3 pt-4 border-t border-zinc-100">
                <ShareControls
                  title={`${title} — ${dealer.store_name}`}
                  text={`Confira este ${v.brand} ${v.model} na ${dealer.store_name}`}
                  testid="wl-vehicle-share"
                />
              </div>
            </div>
          </aside>
        </div>

        <div className="mt-12">
          <Link
            to="/"
            data-testid="wl-vehicle-back-bottom"
            className="inline-flex items-center gap-2 text-sm font-bold uppercase border-b-2 pb-0.5"
            style={{ borderColor: primary, color: primary }}
          >
            <ArrowLeft size={16} /> Voltar ao estoque
          </Link>
        </div>
      </main>

      {/* Photo lightbox */}
      {lightbox && photo && (
        <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center px-4"
             onClick={() => setLightbox(false)}>
          <button onClick={() => setLightbox(false)}
                  className="absolute top-5 right-5 text-white/80 hover:text-white p-2"
                  aria-label="Fechar">
            <X size={28} />
          </button>
          {photos.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setActive((active - 1 + photos.length) % photos.length); }}
                className="absolute left-4 md:left-10 text-white/80 hover:text-white p-2"
                aria-label="Anterior">
                <ChevronLeft size={32} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActive((active + 1) % photos.length); }}
                className="absolute right-4 md:right-10 text-white/80 hover:text-white p-2"
                aria-label="Próxima">
                <ChevronRight size={32} />
              </button>
            </>
          )}
          <img
            src={fileUrl(photo)}
            alt={title}
            className="max-h-[90vh] max-w-[95vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Video lightbox */}
      {videoOpen && videoPath && (
        <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center px-4"
             onClick={() => setVideoOpen(false)}>
          <button onClick={() => setVideoOpen(false)}
                  className="absolute top-5 right-5 text-white/80 hover:text-white p-2"
                  aria-label="Fechar vídeo">
            <X size={28} />
          </button>
          <video
            src={fileUrl(videoPath)}
            controls autoPlay playsInline
            className="max-h-[85vh] max-w-[95vw] w-auto bg-black"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

function Spec({ icon: Icon, label, value }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 inline-flex items-center gap-1">
        <Icon size={11} /> {label}
      </div>
      <div className="mt-0.5 font-bold tracking-tight text-sm">{value}</div>
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

function ErrorPage({ error }) {
  const messages = {
    not_a_tenant: {
      title: "Página do site da loja",
      desc: "Não foi possível identificar a loja neste endereço.",
    },
    not_found: {
      title: "Veículo não encontrado",
      desc: "Este veículo não está disponível nesta loja ou já foi vendido.",
    },
    network: {
      title: "Falha ao carregar",
      desc: "Não conseguimos conectar ao servidor. Tente novamente em instantes.",
    },
  };
  const m = messages[error] || messages.network;
  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-6" data-testid="wl-vehicle-error">
      <div className="max-w-md text-center">
        <AlertTriangle className="mx-auto text-amber-500" size={40} />
        <h1 className="mt-4 text-3xl font-black tracking-tight" style={{ fontFamily: "Cabinet Grotesk" }}>
          {m.title}
        </h1>
        <p className="mt-3 text-zinc-600">{m.desc}</p>
        <Link
          to="/"
          className="mt-8 inline-flex items-center gap-2 text-sm font-bold uppercase border-b-2 border-black pb-0.5"
        >
          <ArrowLeft size={16} /> Voltar ao estoque
        </Link>
      </div>
    </div>
  );
}
