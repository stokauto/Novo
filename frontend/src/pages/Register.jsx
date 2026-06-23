import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { REGISTER } from "@/constants/testIds";
import { ArrowRight, Check, Info, Eye, EyeOff } from "lucide-react";

const UFS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB",
  "PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [plans, setPlans] = useState([]);
  const [form, setForm] = useState({
    store_name: "",
    email: "",
    password: "",
    password_confirm: "",
    phone: "",
    whatsapp: "",
    city: "",
    uf: "SP",
    address: "",
    description: "",
    plan_code: "avulso",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);

  useEffect(() => {
    api.get("/settings/public")
      .then((r) => setPlans(r.data.plans || []))
      .catch(() => setPlans([
        { code: "avulso", name: "Avulso", ad_limit: 1, price: 0 },
        { code: "loja", name: "Loja", ad_limit: 50, price: 129.9 },
      ]));
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const selectPlan = (code) => setForm({ ...form, plan_code: code });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password.length < 6) {
      setError("A senha deve ter ao menos 6 caracteres.");
      return;
    }
    if (form.password !== form.password_confirm) {
      setError("As senhas não conferem.");
      return;
    }
    setLoading(true);
    try {
      const { password_confirm, ...payload } = form;
      await register(payload);
      // Após o cadastro, redireciona pro WhatsApp do StockAuto para combinar o pagamento.
      const planLabel = (plans.find((p) => p.code === form.plan_code)?.name) || form.plan_code;
      const msg =
        `Olá! Acabei de me cadastrar no StockAuto e quero ativar minha loja.\n\n` +
        `*Loja:* ${form.store_name}\n` +
        `*E-mail:* ${form.email}\n` +
        `*Plano:* ${planLabel}\n` +
        `*Cidade:* ${form.city}/${form.uf}\n\n` +
        `Por favor, me passem os dados para o pagamento.`;
      const waUrl = `https://wa.me/5567982132978?text=${encodeURIComponent(msg)}`;
      window.location.href = waUrl;
    } catch (err) {
      setError(err?.response?.data?.detail || "Não foi possível concluir o cadastro.");
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full border border-zinc-300 focus:border-black h-12 px-4 outline-none bg-transparent text-base transition-colors";

  return (
    <div className="bg-zinc-50 min-h-[calc(100vh-4rem)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid lg:grid-cols-12 gap-10">
          {/* Header column */}
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-24">
              <div className="text-xs uppercase tracking-[0.3em] font-bold text-zinc-500">
                Cadastro de revendedor
              </div>
              <h1 className="mt-3 text-5xl lg:text-6xl font-black tracking-tighter leading-[0.95]"
                  style={{ fontFamily: "Cabinet Grotesk, Inter, sans-serif" }}>
                Cadastre <span className="text-[#FF3B30]">sua loja</span>.
              </h1>
              <p className="mt-6 text-zinc-600 leading-relaxed max-w-md">
                Crie sua conta, escolha um plano e comece a anunciar.
                Sem comissão, sem burocracia — contato direto via WhatsApp.
              </p>

              {/* WhatsApp activation note */}
              <div className="mt-10 bg-black text-white p-6">
                <div className="flex gap-3">
                  <Info size={20} className="flex-shrink-0 text-[#25D366] mt-0.5" />
                  <div>
                    <div className="text-xs uppercase tracking-[0.25em] font-bold text-zinc-400 mb-2">
                      Ativação via WhatsApp
                    </div>
                    <p className="text-sm text-zinc-300 leading-relaxed">
                      Após o cadastro, você será redirecionado direto para o nosso{" "}
                      <span className="text-white font-bold">WhatsApp</span> para combinar a forma
                      de pagamento e liberação da conta. Atendimento humano, rápido e sem complicação.
                    </p>
                  </div>
                </div>
              </div>

              <ul className="mt-8 space-y-3 text-sm text-zinc-700">
                {[
                  "Mini site exclusivo da sua loja",
                  "Botão WhatsApp em destaque",
                  "Suporte e moderação humana",
                ].map((b) => (
                  <li key={b} className="flex items-center gap-2">
                    <Check size={16} className="text-[#FF3B30]" /> {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Form column */}
          <div className="lg:col-span-7">
            <form onSubmit={onSubmit} className="bg-white border border-zinc-200 p-6 sm:p-10 space-y-8">
              {/* Plan picker */}
              <section>
                <div className="text-xs uppercase tracking-[0.25em] font-bold text-zinc-500 mb-4">
                  1. Escolha seu plano
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {plans.map((p) => {
                    const active = form.plan_code === p.code;
                    const periodLabel = p.period_label || (p.period_days ? `${p.period_days} dias` : "mensal");
                    return (
                      <button
                        type="button"
                        key={p.code}
                        data-testid={`register-plan-${p.code}`}
                        onClick={() => selectPlan(p.code)}
                        className={`text-left border p-5 transition-all relative ${active ? "border-black bg-black text-white" : "border-zinc-300 hover:border-black"}`}
                      >
                        <span className={`absolute -top-2.5 left-4 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${active ? "bg-[#FF3B30] text-white" : "bg-black text-white"}`}>
                          {periodLabel} · {p.period_days || 90} dias
                        </span>
                        <div className="flex items-center justify-between mt-1">
                          <div className="text-lg font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>
                            {p.name}
                          </div>
                          {active && <Check size={18} className="text-[#FF3B30]" />}
                        </div>
                        <div className="mt-2 text-xs uppercase tracking-widest opacity-70">
                          {p.ad_limit === 1 ? "1 anúncio" : `Até ${p.ad_limit} anúncios`}
                        </div>
                        <div className="mt-3 text-2xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>
                          {p.price > 0 ? `R$ ${p.price.toFixed(2).replace(".", ",")}` : "Grátis"}
                          {p.price > 0 && <span className="text-xs font-normal opacity-70 ml-1">/{p.period_days || 90} dias</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Store data */}
              <section>
                <div className="text-xs uppercase tracking-[0.25em] font-bold text-zinc-500 mb-4">
                  2. Dados da loja
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-700">Nome da loja</label>
                    <input
                      data-testid={REGISTER.nameInput}
                      required value={form.store_name} onChange={set("store_name")}
                      placeholder="Ex: AutoStock Motors"
                      className={`mt-2 ${inputCls}`}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-700">Telefone</label>
                    <input
                      data-testid="register-phone-input"
                      required value={form.phone} onChange={set("phone")}
                      placeholder="(11) 0000-0000"
                      className={`mt-2 ${inputCls}`}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-700">WhatsApp</label>
                    <input
                      data-testid="register-whatsapp-input"
                      required value={form.whatsapp} onChange={set("whatsapp")}
                      placeholder="(11) 99999-0000"
                      className={`mt-2 ${inputCls}`}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-700">Cidade</label>
                    <input
                      data-testid="register-city-input"
                      required value={form.city} onChange={set("city")}
                      placeholder="São Paulo"
                      className={`mt-2 ${inputCls}`}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-700">UF</label>
                    <select
                      data-testid="register-uf-input"
                      required value={form.uf} onChange={set("uf")}
                      className={`mt-2 ${inputCls}`}
                    >
                      {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-700">Endereço <span className="text-zinc-400 normal-case font-normal">(opcional)</span></label>
                    <input
                      data-testid="register-address-input"
                      value={form.address} onChange={set("address")}
                      placeholder="Av. Brasil, 1000"
                      className={`mt-2 ${inputCls}`}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-700">Descrição da loja <span className="text-zinc-400 normal-case font-normal">(opcional)</span></label>
                    <textarea
                      data-testid="register-description-input"
                      value={form.description} onChange={set("description")}
                      rows={3}
                      placeholder="Conte rapidamente sobre sua loja, especialidades, anos de mercado…"
                      className={`mt-2 border border-zinc-300 focus:border-black px-4 py-3 w-full outline-none bg-transparent text-base transition-colors`}
                    />
                  </div>
                </div>
              </section>

              {/* Account */}
              <section>
                <div className="text-xs uppercase tracking-[0.25em] font-bold text-zinc-500 mb-4">
                  3. Dados de acesso
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-700">E-mail</label>
                    <input
                      data-testid={REGISTER.emailInput}
                      required type="email" autoComplete="email"
                      value={form.email} onChange={set("email")}
                      placeholder="voce@empresa.com"
                      className={`mt-2 ${inputCls}`}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-700">Senha</label>
                    <div className="relative mt-2">
                      <input
                        data-testid={REGISTER.passwordInput}
                        required type={showPwd ? "text" : "password"} autoComplete="new-password" minLength={6}
                        value={form.password} onChange={set("password")}
                        placeholder="Mínimo 6 caracteres"
                        className={`${inputCls} pr-12`}
                      />
                      <button type="button" data-testid="register-password-toggle" onClick={() => setShowPwd((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black" aria-label="Mostrar senha">
                        {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-700">Confirmar senha</label>
                    <div className="relative mt-2">
                      <input
                        data-testid={REGISTER.passwordConfirmInput}
                        required type={showPwd2 ? "text" : "password"} autoComplete="new-password" minLength={6}
                        value={form.password_confirm} onChange={set("password_confirm")}
                        placeholder="Repita a senha"
                        className={`${inputCls} pr-12`}
                      />
                      <button type="button" data-testid="register-password-confirm-toggle" onClick={() => setShowPwd2((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black" aria-label="Mostrar senha">
                        {showPwd2 ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {error && (
                <div data-testid="register-error" className="border-l-4 border-[#FF3B30] bg-red-50 text-red-700 text-sm px-4 py-3">
                  {error}
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                <Link
                  to="/login"
                  data-testid={REGISTER.loginLink}
                  className="text-sm text-zinc-600 hover:text-black"
                >
                  Já tem conta? <span className="font-bold uppercase tracking-tight border-b-2 border-black ml-1">Entrar</span>
                </Link>
                <button
                  data-testid={REGISTER.submitButton}
                  type="submit"
                  disabled={loading}
                  className="bg-[#FF3B30] hover:bg-[#E13128] disabled:opacity-60 text-white h-14 px-8 font-bold uppercase tracking-tight inline-flex items-center justify-center gap-2 transition-colors w-full sm:w-auto"
                >
                  {loading ? "Enviando…" : (<>Criar conta <ArrowRight size={18} /></>)}
                </button>
              </div>

              <p className="text-xs text-zinc-500 leading-relaxed">
                Ao criar sua conta você concorda com os termos de uso da plataforma StockAuto
                e autoriza a moderação dos anúncios publicados.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
