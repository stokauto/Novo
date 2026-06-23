import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { LOGIN } from "@/constants/testIds";
import { ArrowRight, Lock, Mail, Eye, EyeOff } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const redirectFor = (user) => {
    const to = location.state?.from;
    if (to) return to;
    return user.role === "admin" ? "/admin" : "/painel";
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(email, password);
      navigate(redirectFor(user), { replace: true });
    } catch (err) {
      setError(err?.response?.data?.detail || "Não foi possível entrar. Verifique seus dados.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] grid md:grid-cols-2">
      {/* Left brand panel */}
      <div className="hidden md:flex relative bg-black text-white overflow-hidden">
        <div className="absolute inset-0 opacity-30 mix-blend-screen" style={{
          backgroundImage:
            "radial-gradient(circle at 20% 30%, #FF3B30 0%, transparent 40%), radial-gradient(circle at 80% 70%, #1a1a1a 0%, transparent 50%)",
        }} />
        <div className="relative p-12 lg:p-16 flex flex-col justify-between w-full">
          <div className="text-xs uppercase tracking-[0.3em] font-bold text-zinc-400">
            Marketplace de veículos
          </div>
          <div>
            <h1 className="font-black tracking-tighter leading-[0.95] text-5xl lg:text-6xl"
                style={{ fontFamily: "Cabinet Grotesk, Inter, sans-serif" }}>
              Bem-vindo<br />
              de <span className="text-[#FF3B30]">volta</span>.
            </h1>
            <p className="mt-6 text-zinc-300 max-w-md leading-relaxed">
              Acesse seu painel para gerenciar anúncios, acompanhar contatos via WhatsApp
              e expandir sua loja.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { k: "Anúncios", v: "Painel completo" },
              { k: "Contato", v: "Direto WhatsApp" },
              { k: "Plano", v: "Ativação via WhatsApp" },
            ].map((s) => (
              <div key={s.k} className="border border-zinc-800 p-4">
                <div className="text-sm font-black tracking-tight" style={{ fontFamily: "Cabinet Grotesk" }}>{s.k}</div>
                <div className="text-xs text-zinc-400 mt-1">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex items-center justify-center p-6 sm:p-10 lg:p-16">
        <div className="w-full max-w-md">
          <div className="text-xs uppercase tracking-[0.3em] font-bold text-zinc-500">
            Acesso restrito
          </div>
          <h2 className="mt-3 text-4xl sm:text-5xl font-black tracking-tighter"
              style={{ fontFamily: "Cabinet Grotesk, Inter, sans-serif" }}>
            Entrar
          </h2>
          <p className="mt-3 text-zinc-600">
            Revendedores e administradores acessam por aqui.
          </p>

          <form onSubmit={onSubmit} className="mt-10 space-y-5">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-700">E-mail</label>
              <div className="mt-2 flex items-center border border-zinc-300 focus-within:border-black h-12 px-4">
                <Mail size={18} className="text-zinc-500" />
                <input
                  data-testid={LOGIN.emailInput}
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@empresa.com"
                  className="flex-1 ml-3 outline-none bg-transparent text-base"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-zinc-700">Senha</label>
              <div className="mt-2 flex items-center border border-zinc-300 focus-within:border-black h-12 px-4">
                <Lock size={18} className="text-zinc-500" />
                <input
                  data-testid={LOGIN.passwordInput}
                  type={showPwd ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="flex-1 ml-3 outline-none bg-transparent text-base"
                />
                <button
                  type="button"
                  data-testid="login-password-toggle"
                  onClick={() => setShowPwd((s) => !s)}
                  className="text-zinc-400 hover:text-black p-1"
                  aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div data-testid="login-error" className="border-l-4 border-[#FF3B30] bg-red-50 text-red-700 text-sm px-4 py-3">
                {error}
              </div>
            )}

            <button
              data-testid={LOGIN.submitButton}
              type="submit"
              disabled={loading}
              className="w-full bg-[#FF3B30] hover:bg-[#E13128] disabled:opacity-60 text-white h-14 font-bold uppercase tracking-tight inline-flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? "Entrando…" : (<>Entrar <ArrowRight size={18} /></>)}
            </button>

            <div className="flex items-center justify-between pt-2 text-sm">
              <Link
                to="/recuperar-senha"
                data-testid={LOGIN.forgotPasswordLink}
                className="text-zinc-500 hover:text-black underline-offset-4 hover:underline"
              >
                Esqueci minha senha
              </Link>
              <Link
                to="/cadastro"
                data-testid={LOGIN.registerLink}
                className="font-bold uppercase tracking-tight border-b-2 border-black hover:text-[#FF3B30] hover:border-[#FF3B30]"
              >
                Criar conta
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
