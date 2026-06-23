/* eslint-disable react-hooks/set-state-in-effect */
import { useState } from "react";
import { RefreshCw, LogOut, Clock, MessageCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { brl } from "@/lib/format";
import { AUTH } from "@/constants/testIds";
import { WhatsAppIcon } from "@/components/WhatsAppButton";

const SUPPORT_WA_NUMBER = "5567982132978";

export default function PendingApproval() {
  const { user, refresh, logout } = useAuth();
  const [checking, setChecking] = useState(false);

  const planPrice = user?.plan_price;
  const planName = user?.plan_name || user?.plan_code || "—";

  const onCheck = async () => {
    setChecking(true);
    await refresh();
    setChecking(false);
  };

  const waMessage =
    `Olá! Acabei de me cadastrar no StockAuto e quero ativar minha loja.\n\n` +
    `*Loja:* ${user?.store_name || "—"}\n` +
    `*E-mail:* ${user?.email || "—"}\n` +
    `*Plano:* ${planName}\n` +
    (planPrice ? `*Valor:* ${brl(planPrice)}\n` : "") +
    `*Cidade:* ${user?.city || "—"}/${user?.uf || "—"}\n\n` +
    `Por favor, me passem os dados para o pagamento.`;
  const waUrl = `https://wa.me/${SUPPORT_WA_NUMBER}?text=${encodeURIComponent(waMessage)}`;

  return (
    <div data-testid={AUTH.pixScreen} className="min-h-[calc(100vh-4rem)] bg-zinc-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-xs uppercase tracking-[0.3em] font-bold text-zinc-500 inline-flex items-center gap-2">
          <Clock size={14} /> Aguardando ativação
        </div>
        <h1
          className="mt-3 text-4xl lg:text-5xl font-black tracking-tighter leading-[0.95]"
          style={{ fontFamily: "Cabinet Grotesk, Inter, sans-serif" }}
        >
          Falta só <span className="text-[#25D366]">um passo</span>.
        </h1>
        <p className="mt-6 text-zinc-600 leading-relaxed max-w-2xl">
          Sua conta foi criada com sucesso! Para liberar a publicação dos anúncios,
          fale com nossa equipe direto no WhatsApp — vamos combinar a forma de
          pagamento e liberar seu plano <span className="font-bold text-black">{planName}</span>
          {planPrice ? <> (<span className="font-bold">{brl(planPrice)}</span>)</> : null}.
          Atendimento humano, rápido e sem complicação.
        </p>

        {/* WhatsApp CTA */}
        <a
          data-testid="pending-whatsapp-cta"
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-flex items-center gap-3 bg-[#25D366] hover:bg-[#1DA851] text-white px-7 h-14 font-bold uppercase tracking-tight"
        >
          <WhatsAppIcon size={22} />
          Falar com a equipe no WhatsApp
        </a>

        {/* Info secundária */}
        <div className="mt-10 bg-white border border-zinc-200 p-6 space-y-4">
          <div className="flex items-start gap-3">
            <MessageCircle size={20} className="text-[#25D366] flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-xs uppercase tracking-[0.2em] font-bold text-zinc-500 mb-1.5">
                Como funciona
              </div>
              <ul className="text-sm text-zinc-700 space-y-2 leading-relaxed">
                <li>1. Toque no botão acima — abre o WhatsApp da nossa equipe (já com sua mensagem pronta).</li>
                <li>2. Combine o pagamento (Pix, cartão ou transferência).</li>
                <li>3. Assim que confirmarmos, sua conta é ativada e você pode publicar.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            data-testid={AUTH.pixGoPainel}
            onClick={onCheck}
            disabled={checking}
            className="inline-flex items-center gap-2 border-2 border-black hover:bg-black hover:text-white px-5 h-11 font-bold uppercase tracking-tight text-sm disabled:opacity-60"
          >
            <RefreshCw size={16} className={checking ? "animate-spin" : ""} />
            {checking ? "Verificando…" : "Já paguei — verificar status"}
          </button>
          <button
            onClick={logout}
            className="inline-flex items-center gap-2 text-zinc-600 hover:text-black px-3 h-11 text-sm font-bold uppercase tracking-tight"
          >
            <LogOut size={16} /> Sair
          </button>
        </div>
      </div>
    </div>
  );
}
