import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import SEO, { SITE_URL } from "@/components/SEO";
import { brl } from "@/lib/format";
import {
  ArrowRight, Check, Shield, TrendingUp, Zap, Award, MessageCircle,
  Store, Sparkles, Clock,
} from "lucide-react";

const ACCENT = "#FF3B30"; // Ofertas red — traffic-page energy
const HERO_BG = "#0A0A0A";

const BENEFITS = [
  { icon: Zap, title: "Publicação em minutos", desc: "Anuncie via painel, sem intermediário. Aprovação rápida da equipe." },
  { icon: Shield, title: "Contato 100% direto", desc: "Compradores falam com você via WhatsApp — sem taxas por lead." },
  { icon: TrendingUp, title: "SEO local otimizado", desc: "Google, Bing e mapas — Campo Grande e todo Mato Grosso do Sul." },
  { icon: Award, title: "Marca d'água automática", desc: "Todas as fotos protegidas contra roubo." },
  { icon: Store, title: "Mini-site da loja", desc: "Sua vitrine própria: /revendedor/sua-loja com estoque completo." },
  { icon: Sparkles, title: "Hub de Repasse B2B", desc: "Exclusivo para plano Loja: negocie com outras lojas." },
];

const FAQ = [
  {
    q: "Como funciona o pagamento?",
    a: "PIX à vista, trimestral. Você paga na hora do cadastro e libera o anúncio assim que a equipe confirma o recebimento (normalmente em minutos).",
  },
  {
    q: "Posso trocar de plano depois?",
    a: "Sim. Comece com o Avulso para testar e faça upgrade para Loja quando quiser expandir o estoque e destravar o Hub de Repasse.",
  },
  {
    q: "O que é o Hub de Repasse?",
    a: "Uma seção B2B exclusiva do plano Loja: você negocia veículos com outras lojas com preços de repasse (abaixo da FIPE), sem exposição ao público final.",
  },
  {
    q: "Preciso pagar por lead ou por venda?",
    a: "Não. Você paga apenas o plano trimestral. Todo lead vai direto pro seu WhatsApp — não cobramos comissão nem taxa por conversa.",
  },
];

export default function LandingPlans() {
  const [plans, setPlans] = useState([]);

  useEffect(() => {
    api.get("/settings/public").then((r) => setPlans(r.data.plans || [])).catch(() => setPlans([]));
  }, []);

  const offerJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "StockAuto — Planos de Anúncio para Lojistas",
    description: "Planos trimestrais para anunciar veículos em Campo Grande/MS com contato direto via WhatsApp.",
    brand: { "@type": "Brand", name: "StockAuto" },
    offers: plans.map((p) => ({
      "@type": "Offer",
      name: p.name,
      price: p.price,
      priceCurrency: "BRL",
      availability: "https://schema.org/InStock",
      url: `${SITE_URL}/cadastro`,
    })),
  };

  return (
    <div>
      <SEO
        title="Anuncie no StockAuto — Planos para Lojistas em Campo Grande/MS"
        description="Publique seus veículos no marketplace #1 de Campo Grande - MS. Planos trimestrais a partir do valor mais competitivo da região. Contato direto via WhatsApp, sem taxas por lead."
        canonical="/comece-agora"
        jsonLd={offerJsonLd}
      />

      {/* HERO */}
      <section style={{ backgroundColor: HERO_BG }} className="text-white relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: `radial-gradient(circle at 15% 20%, ${ACCENT} 0%, transparent 40%), radial-gradient(circle at 85% 80%, #F5A623 0%, transparent 45%)`,
          }}
          aria-hidden
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] font-bold" style={{ color: ACCENT }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: ACCENT }} />
              Vagas limitadas — Campo Grande, MS
            </div>
            <h1
              className="mt-5 text-5xl sm:text-6xl lg:text-7xl font-black tracking-tighter leading-[0.9]"
              style={{ fontFamily: "Cabinet Grotesk, Inter, sans-serif" }}
            >
              Sua loja no maior marketplace de <span style={{ color: ACCENT }}>Campo Grande</span>
            </h1>
            <p className="mt-6 text-lg md:text-xl text-zinc-300 max-w-2xl leading-relaxed">
              Lead direto no WhatsApp. Sem taxa por venda. Sem comissão. Sem burocracia.
              Publique seu estoque em minutos e apareça no Google para compradores da sua região.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-3">
              <Link
                to="/cadastro"
                data-testid="landing-cta-primary"
                className="inline-flex items-center justify-center gap-2 text-white px-8 h-14 font-bold uppercase tracking-tight text-base hover:opacity-90 transition-opacity"
                style={{ backgroundColor: ACCENT }}
              >
                Cadastrar minha loja agora <ArrowRight size={18} />
              </Link>
              <a
                href="#planos"
                className="inline-flex items-center justify-center gap-2 border-2 border-white/30 hover:border-white text-white px-8 h-14 font-bold uppercase tracking-tight text-sm transition-colors"
              >
                Ver planos e preços
              </a>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-400">
              <span className="inline-flex items-center gap-2"><Check size={14} className="text-emerald-400" /> Ativação em minutos</span>
              <span className="inline-flex items-center gap-2"><Check size={14} className="text-emerald-400" /> Pague por PIX</span>
              <span className="inline-flex items-center gap-2"><Check size={14} className="text-emerald-400" /> Cancele quando quiser</span>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST STRIP — factual claims only, no unverified stats */}
      <section className="bg-white border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { n: "MS", l: "Foco regional total" },
            { n: "PIX", l: "Pagamento à vista" },
            { n: "24/7", l: "Contato via WhatsApp" },
            { n: "0%", l: "Comissão por venda" },
          ].map((s) => (
            <div key={s.l}>
              <div className="text-4xl md:text-5xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>{s.n}</div>
              <div className="mt-1 text-xs uppercase tracking-wider text-zinc-500 font-bold">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* BENEFITS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-24">
        <div className="text-xs uppercase tracking-[0.3em] font-bold text-zinc-500">Por que StockAuto</div>
        <h2
          className="mt-3 text-4xl md:text-5xl font-black tracking-tighter leading-tight max-w-3xl"
          style={{ fontFamily: "Cabinet Grotesk" }}
        >
          Ferramentas de venda pensadas pra <span style={{ color: ACCENT }}>lojista de bairro</span>.
        </h2>
        <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {BENEFITS.map((b) => {
            const Icon = b.icon;
            return (
              <div key={b.title} className="p-6 border border-zinc-200 hover:border-black transition-colors">
                <div className="w-11 h-11 flex items-center justify-center bg-black text-white">
                  <Icon size={20} />
                </div>
                <div className="mt-4 text-lg font-black tracking-tight" style={{ fontFamily: "Cabinet Grotesk" }}>
                  {b.title}
                </div>
                <p className="mt-2 text-sm text-zinc-600 leading-relaxed">{b.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* PLANS */}
      <section id="planos" className="bg-zinc-50 border-y border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-24">
          <div className="max-w-2xl">
            <div className="text-xs uppercase tracking-[0.3em] font-bold text-zinc-500">Planos trimestrais</div>
            <h2
              className="mt-3 text-4xl md:text-5xl font-black tracking-tighter leading-tight"
              style={{ fontFamily: "Cabinet Grotesk" }}
            >
              Escolha depois. Comece agora.
            </h2>
            <p className="mt-4 text-zinc-600 leading-relaxed">
              O plano é escolhido durante o cadastro. Você pode começar no Avulso pra testar e migrar pro Loja quando quiser destravar o estoque completo e o Hub de Repasse B2B.
            </p>
          </div>

          <div className="mt-14 grid md:grid-cols-2 gap-6 max-w-5xl">
            {plans.map((p) => {
              const isLoja = p.code === "loja";
              return (
                <div
                  key={p.code}
                  data-testid={`landing-plan-${p.code}`}
                  className={`relative p-8 border-2 ${isLoja ? "border-black bg-black text-white" : "border-zinc-300 bg-white"}`}
                >
                  {isLoja && (
                    <span
                      className="absolute -top-3 left-8 text-[10px] font-black uppercase tracking-widest px-3 py-1 text-white"
                      style={{ backgroundColor: ACCENT }}
                    >
                      Mais escolhido
                    </span>
                  )}
                  <div className="text-xs uppercase tracking-[0.3em] font-bold opacity-60">{p.name}</div>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-6xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>
                      {brl(p.price)}
                    </span>
                    <span className="text-sm opacity-60">/ trimestre</span>
                  </div>

                  <ul className="mt-8 space-y-3 text-sm">
                    <PlanFeature dark={isLoja}>
                      <strong>{p.ad_limit}</strong> {p.ad_limit === 1 ? "anúncio ativo" : "anúncios ativos"}
                    </PlanFeature>
                    <PlanFeature dark={isLoja}>
                      <strong>{p.offer_limit || 0}</strong> ofertas em destaque
                    </PlanFeature>
                    <PlanFeature dark={isLoja}>Contato direto via WhatsApp</PlanFeature>
                    <PlanFeature dark={isLoja}>Marca d&apos;água automática nas fotos</PlanFeature>
                    <PlanFeature dark={isLoja}>Mini-site da loja com estoque completo</PlanFeature>
                    {isLoja && (
                      <>
                        <PlanFeature dark>Hub de Repasse B2B exclusivo</PlanFeature>
                        <PlanFeature dark>Prioridade na moderação</PlanFeature>
                        <PlanFeature dark>Selo &ldquo;Loja verificada&rdquo;</PlanFeature>
                      </>
                    )}
                    <PlanFeature dark={isLoja}>
                      <Clock size={14} className={isLoja ? "text-zinc-400" : "text-zinc-500"} />
                      <span>Validade de {p.period_days || 90} dias</span>
                    </PlanFeature>
                  </ul>

                  <Link
                    to="/cadastro"
                    data-testid={`landing-cta-${p.code}`}
                    className={`mt-10 w-full inline-flex items-center justify-center gap-2 h-14 font-bold uppercase tracking-tight text-sm transition-opacity hover:opacity-90 ${
                      isLoja ? "text-black" : "text-white"
                    }`}
                    style={{ backgroundColor: isLoja ? "#F5A623" : ACCENT }}
                  >
                    Cadastrar e escolher {p.name} <ArrowRight size={16} />
                  </Link>
                </div>
              );
            })}
          </div>

          <p className="mt-10 text-sm text-zinc-500 max-w-2xl">
            <MessageCircle size={14} className="inline -mt-0.5 mr-1" />
            Após o cadastro você recebe as instruções de pagamento via PIX e o link do WhatsApp da equipe. Ativação em minutos.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-24">
        <div className="text-xs uppercase tracking-[0.3em] font-bold text-zinc-500">Perguntas frequentes</div>
        <h2
          className="mt-3 text-4xl md:text-5xl font-black tracking-tighter leading-tight"
          style={{ fontFamily: "Cabinet Grotesk" }}
        >
          Tudo o que você precisa saber
        </h2>
        <div className="mt-12 divide-y divide-zinc-200 border-y border-zinc-200">
          {FAQ.map((f, i) => (
            <details key={i} className="group py-6">
              <summary className="flex justify-between items-center cursor-pointer list-none">
                <span className="text-lg font-bold tracking-tight pr-4">{f.q}</span>
                <span
                  className="w-8 h-8 flex items-center justify-center border border-zinc-300 group-open:bg-black group-open:text-white group-open:border-black transition-colors flex-shrink-0"
                  aria-hidden
                >
                  <span className="group-open:hidden">+</span>
                  <span className="hidden group-open:inline">−</span>
                </span>
              </summary>
              <p className="mt-4 text-zinc-600 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{ backgroundColor: HERO_BG }} className="text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          <div className="text-xs uppercase tracking-[0.3em] font-bold" style={{ color: ACCENT }}>
            Últimos passos
          </div>
          <h2
            className="mt-5 text-5xl md:text-6xl font-black tracking-tighter leading-[0.95]"
            style={{ fontFamily: "Cabinet Grotesk" }}
          >
            Pronto para vender mais em <br className="hidden sm:block" />Campo Grande?
          </h2>
          <p className="mt-6 text-zinc-300 text-lg max-w-xl mx-auto leading-relaxed">
            Cadastre sua loja agora e comece a receber leads no WhatsApp ainda hoje.
          </p>
          <Link
            to="/cadastro"
            data-testid="landing-cta-final"
            className="mt-10 inline-flex items-center gap-2 text-white px-10 h-16 font-bold uppercase tracking-tight text-base hover:opacity-90 transition-opacity"
            style={{ backgroundColor: ACCENT }}
          >
            Quero começar agora <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </div>
  );
}

function PlanFeature({ dark, children }) {
  return (
    <li className="flex items-start gap-2.5">
      <Check size={16} className={`flex-shrink-0 mt-0.5 ${dark ? "text-emerald-400" : "text-emerald-600"}`} />
      <span className={dark ? "text-zinc-200" : "text-zinc-700"}>{children}</span>
    </li>
  );
}
