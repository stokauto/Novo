import { Link, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { NAV } from "@/constants/testIds";
import { Menu, X, ChevronRight, Instagram, Facebook, MapPin } from "lucide-react";

const linkBase = "text-sm font-bold tracking-tight uppercase hover:opacity-60 transition-opacity";

const REGION_OPTIONS = [
  { slug: "campo-grande-ms", label: "Campo Grande, MS" },
  { slug: "joao-pessoa-pb", label: "João Pessoa, PB" },
];

function RegionSelector() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState("campo-grande-ms");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("stockauto:region");
      if (saved && REGION_OPTIONS.some((r) => r.slug === saved)) setCurrent(saved);
    } catch (err) {
      console.warn("[region] localStorage unavailable", err?.message);
    }
  }, []);

  const onChange = (slug) => {
    setCurrent(slug);
    try { localStorage.setItem("stockauto:region", slug); } catch (e) { /* quota */ }
    navigate(`/seminovos-${slug}`);
  };

  return (
    <label
      data-testid="header-region-selector"
      className="hidden md:inline-flex items-center gap-1.5 border border-zinc-200 hover:border-black px-2.5 h-9 text-xs uppercase tracking-tight font-bold cursor-pointer transition-colors"
    >
      <MapPin size={13} className="text-[#FF3B30]" />
      <select
        value={current}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent outline-none cursor-pointer pr-1 font-bold"
        aria-label="Selecionar região"
      >
        {REGION_OPTIONS.map((r) => (
          <option key={r.slug} value={r.slug}>{r.label}</option>
        ))}
      </select>
    </label>
  );
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const onLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-black" style={{ fontFamily: "Satoshi, Inter, system-ui, sans-serif" }}>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" data-testid={NAV.logo} className="flex items-center">
            <img src="/logo-stockauto-light.png" alt="StockAuto — Campo Grande, MS" className="h-12 w-auto" />
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <NavLink to="/" data-testid={NAV.home} className={linkBase}>Início</NavLink>
            <NavLink to="/veiculos" data-testid={NAV.veiculos} className={linkBase}>Veículos</NavLink>
            <NavLink
              to="/veiculos?oferta=true"
              data-testid="nav-ofertas"
              className={({ isActive }) =>
                `text-sm font-bold uppercase tracking-tight transition-colors inline-flex items-center gap-1.5 text-[#FF3B30] hover:text-[#C92A22] ${
                  isActive ? "underline underline-offset-[6px] decoration-2" : ""
                }`
              }
            >
              <span aria-hidden>🔥</span> Ofertas
            </NavLink>
            <NavLink to="/revendedores" data-testid={NAV.revendedores} className={linkBase}>Revendedores</NavLink>
            <NavLink to="/planos" data-testid={NAV.planos} className={linkBase}>Anuncie</NavLink>
            {user && (user.role === "dealer" || user.role === "admin") && (
              <NavLink to="/repasse" data-testid="nav-repasse" className={`${linkBase} text-[#B5820E] hover:text-[#F5A623]`}>
                Repasse
              </NavLink>
            )}
            {user ? (
              <div className="flex items-center gap-4" data-testid={NAV.userMenu}>
                <RegionSelector />
                {user.role === "admin" ? (
                  <Link to="/admin" data-testid={NAV.admin} className={linkBase}>ADM</Link>
                ) : (
                  <Link to="/painel" data-testid={NAV.painel} className={linkBase}>Painel</Link>
                )}
                <button data-testid={NAV.logout} onClick={onLogout} className="text-sm font-bold uppercase tracking-tight border-b-2 border-black">Sair</button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <RegionSelector />
                <Link to="/login" data-testid={NAV.login} className={linkBase}>Entrar</Link>
                <Link to="/cadastro" data-testid={NAV.cadastro} className="bg-black text-white px-5 py-2.5 text-sm font-bold uppercase tracking-tight hover:bg-zinc-800 transition-colors">
                  Anunciar
                </Link>
              </div>
            )}
          </nav>
          <button className="md:hidden p-2" onClick={() => setOpen(!open)} aria-label="menu">
            {open ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
        {open && (
          <div className="md:hidden border-t border-zinc-200 bg-white">
            <div className="px-4 py-4 flex flex-col gap-3">
              <NavLink onClick={() => setOpen(false)} to="/" className={linkBase}>Início</NavLink>
              <NavLink onClick={() => setOpen(false)} to="/veiculos" className={linkBase}>Veículos</NavLink>
              <NavLink
                onClick={() => setOpen(false)}
                to="/veiculos?oferta=true"
                className="text-base font-bold uppercase tracking-tight text-[#FF3B30] hover:text-[#C92A22] inline-flex items-center gap-1.5"
              >
                <span aria-hidden>🔥</span> Ofertas
              </NavLink>
              <NavLink onClick={() => setOpen(false)} to="/revendedores" className={linkBase}>Revendedores</NavLink>
              <NavLink onClick={() => setOpen(false)} to="/planos" className={linkBase}>Anuncie</NavLink>
              {user && (user.role === "dealer" || user.role === "admin") && (
                <NavLink onClick={() => setOpen(false)} to="/repasse" className={`${linkBase} text-[#B5820E]`}>
                  Repasse
                </NavLink>
              )}
              {user ? (
                <>
                  {user.role === "admin" ? (
                    <Link onClick={() => setOpen(false)} to="/admin" className={linkBase}>ADM</Link>
                  ) : (
                    <Link onClick={() => setOpen(false)} to="/painel" className={linkBase}>Painel</Link>
                  )}
                  <button onClick={() => { setOpen(false); onLogout(); }} className="text-left text-sm font-bold uppercase tracking-tight">Sair</button>
                </>
              ) : (
                <>
                  <Link onClick={() => setOpen(false)} to="/login" className={linkBase}>Entrar</Link>
                  <Link onClick={() => setOpen(false)} to="/cadastro" className="bg-black text-white px-5 py-2.5 text-sm font-bold uppercase tracking-tight inline-block w-fit">Anunciar</Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-black text-white mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-2">
            <img src="/logo-stockauto-dark.png" alt="StockAuto" className="h-14 w-auto" />
            <p className="mt-5 text-zinc-400 max-w-md leading-relaxed">
              Marketplace nacional de veículos seminovos. Anúncios verificados, contato
              direto via WhatsApp e Hub de Repasse B2B exclusivo para lojistas — sem burocracia.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <a
                href="https://www.instagram.com/stockautobr"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Siga o StockAuto no Instagram"
                data-testid="footer-social-instagram"
                className="group inline-flex items-center justify-center w-11 h-11 border border-zinc-800 hover:border-[#FF3B30] hover:bg-[#FF3B30] transition-colors"
              >
                <Instagram size={20} className="text-zinc-300 group-hover:text-white transition-colors" />
              </a>
              <a
                href="https://www.facebook.com/stockautobr"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Siga o StockAuto no Facebook"
                data-testid="footer-social-facebook"
                className="group inline-flex items-center justify-center w-11 h-11 border border-zinc-800 hover:border-[#FF3B30] hover:bg-[#FF3B30] transition-colors"
              >
                <Facebook size={20} className="text-zinc-300 group-hover:text-white transition-colors" />
              </a>
              <span className="ml-2 text-xs uppercase tracking-[0.2em] font-bold text-zinc-500">
                @stockautobr
              </span>
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.2em] font-bold text-zinc-500 mb-4">Navegação</div>
            <ul className="space-y-2 text-sm">
              <li><Link to="/veiculos" className="hover:text-[#FF3B30]">Veículos</Link></li>
              <li><Link to="/veiculos?oferta=true" className="hover:text-[#FF3B30]">🔥 Ofertas</Link></li>
              <li><Link to="/revendedores" className="hover:text-[#FF3B30]">Revendedores</Link></li>
              <li><Link to="/planos" className="hover:text-[#FF3B30]">Anuncie</Link></li>
            </ul>
          </div>
          <div>
            <div data-testid="footer-cities-section" className="text-xs uppercase tracking-[0.2em] font-bold text-zinc-500 mb-4">Cidades Atendidas</div>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  to="/seminovos-campo-grande-ms"
                  data-testid="footer-city-campo-grande"
                  className="hover:text-[#FF3B30] flex items-center gap-1"
                >
                  Campo Grande, MS <ChevronRight size={14} />
                </Link>
              </li>
              <li>
                <Link
                  to="/seminovos-joao-pessoa-pb"
                  data-testid="footer-city-joao-pessoa"
                  className="hover:text-[#FF3B30] flex items-center gap-1"
                >
                  João Pessoa, PB <ChevronRight size={14} />
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <div className="text-xs uppercase tracking-[0.2em] font-bold text-zinc-500 mb-4">Acesso</div>
            <ul className="space-y-2 text-sm">
              <li><Link to="/login" className="hover:text-[#FF3B30] flex items-center gap-1">Entrar <ChevronRight size={14}/></Link></li>
              <li><Link to="/cadastro" className="hover:text-[#FF3B30] flex items-center gap-1">Cadastrar Loja <ChevronRight size={14}/></Link></li>
              <li><Link to="/login" data-testid="footer-admin-link" className="hover:text-[#FF3B30] flex items-center gap-1 text-zinc-500">Acesso ADM <ChevronRight size={14}/></Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-zinc-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-xs uppercase tracking-[0.2em] font-bold text-zinc-500 mb-4">
              Buscas populares
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <Link to="/seminovos-campo-grande-ms" className="text-zinc-400 hover:text-[#FF3B30]">Carros usados em Campo Grande, MS</Link>
              <Link to="/seminovos-joao-pessoa-pb" className="text-zinc-400 hover:text-[#FF3B30]">Seminovos em João Pessoa, PB</Link>
              <Link to="/veiculos?category=camionete" className="text-zinc-400 hover:text-[#FF3B30]">Camionetes</Link>
              <Link to="/veiculos?oferta=true" className="text-zinc-400 hover:text-[#FF3B30]">Veículos em oferta</Link>
              <Link to="/revendedores" className="text-zinc-400 hover:text-[#FF3B30]">Revendedores certificados</Link>
            </div>
          </div>
        </div>
        <div className="border-t border-zinc-900 py-6 text-center text-xs text-zinc-500">
          © {new Date().getFullYear()} StockAuto — Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}
