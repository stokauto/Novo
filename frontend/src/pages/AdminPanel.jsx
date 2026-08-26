import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import api, { fileUrl } from "@/lib/api";
import * as pushLib from "@/lib/push";
import PanelLayout from "@/components/PanelLayout";
import { APANEL, APANEL_SVC } from "@/constants/testIds";
import { brl, km, UF_STATES } from "@/lib/format";
import {
  LayoutDashboard, Users, Car, Bell, Settings as SettingsIcon,
  Check, X, Trash2, Store, Clock, CheckCircle2, RefreshCw, ArrowRight, Image as ImageIcon,
  Pencil, Eye, EyeOff, GalleryHorizontal, ChevronUp, ChevronDown, ExternalLink, Plus,
  Wrench,
} from "lucide-react";

const TABS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, testId: APANEL.tabDashboard },
  { key: "dealers", label: "Revendedores", icon: Users, testId: APANEL.tabDealers },
  { key: "vehicles", label: "Moderação", icon: Car, testId: APANEL.tabVehicles },
  { key: "services", label: "Serviços", icon: Wrench, testId: APANEL.tabServices },
  { key: "banners", label: "Banners", icon: GalleryHorizontal, testId: APANEL.tabBanners },
  { key: "notifications", label: "Notificações", icon: Bell, testId: APANEL.tabNotifications },
  { key: "settings", label: "Pagamento", icon: SettingsIcon, testId: APANEL.tabSettings },
];

export default function AdminPanel() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "dashboard";
  const validTab = TABS.some((t) => t.key === initialTab) ? initialTab : "dashboard";
  const [tab, setTab] = useState(validTab);
  const [stats, setStats] = useState(null);

  // Keep tab in sync with URL so clicks on push notifications deep-link correctly.
  useEffect(() => {
    const urlTab = searchParams.get("tab");
    if (urlTab && urlTab !== tab && TABS.some((t) => t.key === urlTab)) setTab(urlTab);
  }, [searchParams, tab]);

  const changeTab = (next) => {
    setTab(next);
    const params = new URLSearchParams(searchParams);
    if (next === "dashboard") params.delete("tab"); else params.set("tab", next);
    setSearchParams(params, { replace: true });
  };

  const loadStats = useCallback(() => {
    api.get("/admin/stats").then(({ data }) => setStats(data)).catch(() => {});
  }, []);

  useEffect(() => { loadStats(); }, [loadStats, tab]);

  return (
    <PanelLayout
      testIdPage={APANEL.page}
      subtitle="ADM Master"
      title="Controle StockAuto"
      tabs={TABS}
      activeTab={tab}
      onTabChange={changeTab}
      rightHeader={
        stats?.dealers_pending > 0 || stats?.vehicles_pending > 0 ? (
          <div className="inline-flex items-center gap-2 bg-[#FF3B30] text-white px-4 py-2 text-xs font-bold uppercase tracking-tight">
            <Bell size={14} /> {(stats.dealers_pending || 0) + (stats.vehicles_pending || 0)} pendência(s)
          </div>
        ) : null
      }
    >
      {tab === "dashboard" && <DashboardTab stats={stats} onGo={changeTab} />}
      {tab === "dealers" && <DealersTab onChanged={loadStats} />}
      {tab === "vehicles" && <VehiclesTab onChanged={loadStats} />}
      {tab === "services" && <ServicesTab />}
      {tab === "banners" && <BannersTab />}
      {tab === "notifications" && <NotificationsTab onChanged={loadStats} />}
      {tab === "settings" && <SettingsTab />}
    </PanelLayout>
  );
}

/* ---------------------------------------------------------------- Dashboard */
function DashboardTab({ stats, onGo }) {
  const cards = [
    { testId: APANEL.statDealers, label: "Lojistas", value: stats?.dealers_total, sub: `${stats?.dealers_active || 0} ativos`, icon: Store, accent: false },
    { testId: APANEL.statPendingDealers, label: "Lojistas pendentes", value: stats?.dealers_pending, sub: "aguardando aprovação", icon: Clock, accent: (stats?.dealers_pending || 0) > 0, go: "dealers" },
    { testId: APANEL.statActiveVehicles, label: "Anúncios ativos", value: stats?.vehicles_active, sub: `${stats?.vehicles_total || 0} no total`, icon: CheckCircle2, accent: false },
    { testId: APANEL.statPendingVehicles, label: "Anúncios pendentes", value: stats?.vehicles_pending, sub: "aguardando moderação", icon: Car, accent: (stats?.vehicles_pending || 0) > 0, go: "vehicles" },
  ];
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.label}
              data-testid={c.testId}
              onClick={() => c.go && onGo(c.go)}
              className={`text-left p-6 border transition-all ${c.accent ? "bg-[#FF3B30] text-white border-[#FF3B30]" : "bg-white border-zinc-200 hover:border-black"}`}
            >
              <div className="flex items-center justify-between">
                <Icon size={20} className={c.accent ? "text-white" : "text-zinc-400"} />
                {c.go && <ArrowRight size={16} className={c.accent ? "text-white" : "text-zinc-300"} />}
              </div>
              <div className="mt-6 text-5xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>
                {c.value ?? "—"}
              </div>
              <div className="mt-2 text-xs uppercase tracking-widest font-bold">{c.label}</div>
              <div className={`mt-1 text-xs ${c.accent ? "text-white/80" : "text-zinc-500"}`}>{c.sub}</div>
            </button>
          );
        })}
      </div>

      <div className="mt-8 grid md:grid-cols-2 gap-4">
        <button onClick={() => onGo("dealers")} className="text-left p-6 bg-black text-white hover:bg-zinc-800 transition-colors">
          <Users size={20} className="text-[#FF3B30]" />
          <div className="mt-4 text-xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>Aprovar revendedores</div>
          <p className="mt-1 text-sm text-zinc-300">Confirme o pagamento PIX e libere o acesso ao painel.</p>
        </button>
        <button onClick={() => onGo("vehicles")} className="text-left p-6 bg-black text-white hover:bg-zinc-800 transition-colors">
          <Car size={20} className="text-[#FF3B30]" />
          <div className="mt-4 text-xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>Moderar anúncios</div>
          <p className="mt-1 text-sm text-zinc-300">Revise e publique os anúncios enviados pelas lojas.</p>
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Dealers */
const DEALER_STATUS = {
  active: { label: "Ativo", cls: "bg-emerald-100 text-emerald-800" },
  pending: { label: "Pendente", cls: "bg-amber-100 text-amber-800" },
  blocked: { label: "Bloqueado", cls: "bg-red-100 text-red-700" },
};

function DealersTab({ onChanged }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get("/admin/users").then(({ data }) => setItems(data)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (uid, status) => {
    await api.put(`/admin/users/${uid}`, { status });
    load(); onChanged?.();
  };
  const remove = async (uid) => {
    await api.delete(`/admin/users/${uid}`);
    setConfirmDelete(null); load(); onChanged?.();
  };

  const filtered = items.filter((d) => filter === "all" || d.status === filter);
  const counts = {
    all: items.length,
    pending: items.filter((d) => d.status === "pending").length,
    active: items.filter((d) => d.status === "active").length,
    blocked: items.filter((d) => d.status === "blocked").length,
  };

  return (
    <div>
      <FilterPills
        options={[
          { k: "all", label: `Todos (${counts.all})` },
          { k: "pending", label: `Pendentes (${counts.pending})` },
          { k: "active", label: `Ativos (${counts.active})` },
          { k: "blocked", label: `Bloqueados (${counts.blocked})` },
        ]}
        value={filter}
        onChange={setFilter}
      />

      {loading ? (
        <div className="mt-8 text-zinc-500">Carregando…</div>
      ) : filtered.length === 0 ? (
        <Empty label="Nenhum revendedor neste filtro." />
      ) : (
        <div className="mt-6 border border-zinc-200 divide-y divide-zinc-200 bg-white">
          {filtered.map((d) => {
            const s = DEALER_STATUS[d.status] || DEALER_STATUS.pending;
            return (
              <div key={d.id} data-testid={APANEL.dealerRow(d.id)} className="p-4 flex flex-col md:flex-row md:items-center gap-4 hover:bg-zinc-50">
                <div className="w-12 h-12 bg-zinc-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {d.logo_path ? <img src={fileUrl(d.logo_path)} alt={d.store_name} className="w-full h-full object-cover" /> : <Store size={18} className="text-zinc-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold tracking-tight truncate">{d.store_name}</span>
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 ${s.cls}`}>{s.label}</span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    {d.email} · {d.city}/{d.uf} · Plano <span className="font-bold">{d.plan_name}</span> ({brl(d.plan_price)})
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {d.status !== "active" && (
                    <button data-testid={APANEL.dealerApprove(d.id)} onClick={() => act(d.id, "active")}
                      className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 h-9 text-xs font-bold uppercase tracking-tight">
                      <Check size={14} /> Aprovar
                    </button>
                  )}
                  {d.status !== "blocked" ? (
                    <button data-testid={APANEL.dealerBlock(d.id)} onClick={() => act(d.id, "blocked")}
                      className="inline-flex items-center gap-1 border border-zinc-300 hover:border-[#FF3B30] hover:text-[#FF3B30] px-3 h-9 text-xs font-bold uppercase tracking-tight">
                      <X size={14} /> Bloquear
                    </button>
                  ) : (
                    <button onClick={() => act(d.id, "active")}
                      className="inline-flex items-center gap-1 border border-zinc-300 hover:border-black px-3 h-9 text-xs font-bold uppercase tracking-tight">
                      <RefreshCw size={14} /> Reativar
                    </button>
                  )}
                  <button data-testid={`apanel-dealer-edit-${d.id}`} onClick={() => setEditing(d)}
                    className="p-2.5 border border-zinc-300 hover:border-black" aria-label="Editar">
                    <Pencil size={16} />
                  </button>
                  <button data-testid={APANEL.dealerDelete(d.id)} onClick={() => setConfirmDelete(d)}
                    className="p-2.5 border border-zinc-300 hover:border-[#FF3B30] hover:text-[#FF3B30]" aria-label="Excluir">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Excluir revendedor?"
          body={`Remover "${confirmDelete.store_name}"? Todos os anúncios desta loja serão removidos. Esta ação não pode ser desfeita.`}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => remove(confirmDelete.id)}
        />
      )}

      {editing && (
        <EditUserModal
          user={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); onChanged?.(); }}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- Vehicles */
const VEH_STATUS = {
  active: { label: "Ativo", cls: "bg-emerald-100 text-emerald-800" },
  pending: { label: "Pendente", cls: "bg-amber-100 text-amber-800" },
  blocked: { label: "Bloqueado", cls: "bg-red-100 text-red-700" },
};

function VehiclesTab({ onChanged }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [typeFilter, setTypeFilter] = useState("all");

  const load = useCallback(() => {
    setLoading(true);
    const params = {};
    if (filter !== "all") params.status = filter;
    if (typeFilter !== "all") params.ad_type = typeFilter;
    api.get("/admin/vehicles", { params }).then(({ data }) => setItems(data)).finally(() => setLoading(false));
  }, [filter, typeFilter]);
  useEffect(() => { load(); }, [load]);

  const setStatus = async (vid, status) => {
    await api.put(`/admin/vehicles/${vid}/status`, { status });
    load(); onChanged?.();
  };

  const deleteVehicle = async (vid) => {
    if (!window.confirm("Excluir este anúncio definitivamente? Esta ação remove o anúncio do banco e não pode ser desfeita.")) return;
    await api.delete(`/admin/vehicles/${vid}`);
    load(); onChanged?.();
  };

  return (
    <div>
      <FilterPills
        testId={APANEL.vehicleStatusFilter}
        options={[
          { k: "pending", label: "Pendentes" },
          { k: "active", label: "Ativos" },
          { k: "blocked", label: "Bloqueados" },
          { k: "all", label: "Todos" },
        ]}
        value={filter}
        onChange={setFilter}
      />
      <div className="mt-3">
        <FilterPills
          testId="admin-vehicle-type-filter"
          options={[
            { k: "all", label: "Todos os tipos" },
            { k: "public", label: "Público" },
            { k: "repasse", label: "Repasse B2B" },
          ]}
          value={typeFilter}
          onChange={setTypeFilter}
        />
      </div>

      {loading ? (
        <div className="mt-8 text-zinc-500">Carregando…</div>
      ) : items.length === 0 ? (
        <Empty label="Nenhum anúncio neste filtro." />
      ) : (
        <div className="mt-6 border border-zinc-200 divide-y divide-zinc-200 bg-white">
          {items.map((v) => {
            const s = VEH_STATUS[v.status] || VEH_STATUS.pending;
            const isRepasse = v.ad_type === "repasse";
            return (
              <div key={v.id} data-testid={APANEL.vehicleRow(v.id)} className={`p-4 flex flex-col md:flex-row md:items-center gap-4 hover:bg-zinc-50 ${isRepasse ? "border-l-4 border-l-[#F5A623]" : ""}`}>
                <div className="w-20 h-16 bg-zinc-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {v.main_photo ? <img src={fileUrl(v.main_photo)} alt={`${v.brand} ${v.model}`} className="w-full h-full object-cover" /> : <ImageIcon size={18} className="text-zinc-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold tracking-tight truncate">{v.brand} {v.model} <span className="font-normal text-zinc-500">{v.version}</span></span>
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 ${s.cls}`}>{s.label}</span>
                    {isRepasse && (
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-[#FFF8EC] text-[#8A5F0D] border border-[#F5A623]">
                        Repasse B2B
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    {v.year_made}/{v.year_model} · {km(v.km)} · {v.city}/{v.uf} ·{" "}
                    {isRepasse ? (
                      <>
                        <span className="text-zinc-500">FIPE {brl(v.fipe_price)}</span> · <span className="font-bold text-[#B5820E]">Oferta {brl(v.price)}</span>
                      </>
                    ) : (
                      <span className="font-bold text-black">{brl(v.price)}</span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5">Loja: {v.dealer?.store_name || "—"}</div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {v.status !== "active" && (
                    <button data-testid={APANEL.vehicleApprove(v.id)} onClick={() => setStatus(v.id, "active")}
                      className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 h-9 text-xs font-bold uppercase tracking-tight">
                      <Check size={14} /> Aprovar
                    </button>
                  )}
                  {v.status !== "blocked" ? (
                    <button data-testid={APANEL.vehicleReject(v.id)} onClick={() => setStatus(v.id, "blocked")}
                      className="inline-flex items-center gap-1 border border-zinc-300 hover:border-[#FF3B30] hover:text-[#FF3B30] px-3 h-9 text-xs font-bold uppercase tracking-tight">
                      <X size={14} /> Reprovar
                    </button>
                  ) : (
                    <button onClick={() => setStatus(v.id, "active")}
                      className="inline-flex items-center gap-1 border border-zinc-300 hover:border-black px-3 h-9 text-xs font-bold uppercase tracking-tight">
                      <RefreshCw size={14} /> Republicar
                    </button>
                  )}
                  <button
                    data-testid={`admin-vehicle-delete-${v.id}`}
                    onClick={() => deleteVehicle(v.id)}
                    className="inline-flex items-center gap-1 border border-zinc-300 hover:border-[#FF3B30] hover:bg-[#FF3B30] hover:text-white px-3 h-9 text-xs font-bold uppercase tracking-tight"
                  >
                    <Trash2 size={14} /> Excluir
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- Banners */
function BannersTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null = closed, {} = new, {...} = edit
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get("/admin/banners").then(({ data }) => setItems(data)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggleActive = async (b) => {
    const fd = new FormData();
    fd.append("active", String(!b.active));
    await api.put(`/admin/banners/${b.id}`, fd);
    load();
  };

  const move = async (idx, dir) => {
    const newOrder = [...items];
    const target = idx + dir;
    if (target < 0 || target >= newOrder.length) return;
    [newOrder[idx], newOrder[target]] = [newOrder[target], newOrder[idx]];
    setItems(newOrder); // optimistic
    await api.put("/admin/banners/reorder", { order: newOrder.map((b) => b.id) });
    load();
  };

  const remove = async (id) => {
    await api.delete(`/admin/banners/${id}`);
    setConfirmDelete(null);
    load();
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] font-bold text-zinc-500">Banner rotativo da home</div>
          <p className="text-sm text-zinc-600 mt-1 max-w-2xl">
            Cadastre imagens com link externo. Tamanhos recomendados:{" "}
            <strong className="text-black">Desktop 1920×500</strong> ·{" "}
            <strong className="text-black">Mobile 1080×1080</strong>. Formatos: JPG, PNG ou WEBP (máx 8 MB).
          </p>
        </div>
        <button
          data-testid={APANEL.bannerNew}
          onClick={() => setEditing({})}
          className="inline-flex items-center gap-2 bg-black hover:bg-zinc-800 text-white px-5 h-11 font-bold uppercase tracking-tight text-sm"
        >
          <Plus size={16} /> Novo banner
        </button>
      </div>

      {loading ? (
        <div className="mt-8 text-zinc-500">Carregando…</div>
      ) : items.length === 0 ? (
        <Empty label="Nenhum banner cadastrado. Crie o primeiro para ele aparecer na home." />
      ) : (
        <div className="mt-6 border border-zinc-200 divide-y divide-zinc-200 bg-white">
          {items.map((b, idx) => (
            <div key={b.id} data-testid={APANEL.bannerRow(b.id)} className="p-4 flex flex-col md:flex-row md:items-center gap-4 hover:bg-zinc-50">
              <div className="w-44 h-20 bg-zinc-100 flex-shrink-0 overflow-hidden border border-zinc-200">
                <img src={fileUrl(b.image_desktop_path)} alt={b.alt || ""} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold tracking-tight truncate">{b.alt || "(sem descrição)"}</span>
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 ${b.active ? "bg-emerald-100 text-emerald-800" : "bg-zinc-200 text-zinc-600"}`}>
                    {b.active ? "Ativo" : "Inativo"}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">#{idx + 1}</span>
                </div>
                <a href={b.link_url} target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-500 hover:text-black inline-flex items-center gap-1 mt-1 truncate">
                  <ExternalLink size={12} /> {b.link_url}
                </a>
                {b.image_mobile_path && (
                  <div className="text-[11px] text-zinc-400 mt-0.5">Possui versão mobile</div>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button data-testid={APANEL.bannerMoveUp(b.id)} onClick={() => move(idx, -1)} disabled={idx === 0}
                  className="p-2.5 border border-zinc-300 hover:border-black disabled:opacity-30 disabled:cursor-not-allowed" aria-label="Subir">
                  <ChevronUp size={16} />
                </button>
                <button data-testid={APANEL.bannerMoveDown(b.id)} onClick={() => move(idx, +1)} disabled={idx === items.length - 1}
                  className="p-2.5 border border-zinc-300 hover:border-black disabled:opacity-30 disabled:cursor-not-allowed" aria-label="Descer">
                  <ChevronDown size={16} />
                </button>
                <button data-testid={APANEL.bannerToggle(b.id)} onClick={() => toggleActive(b)}
                  className={`px-3 h-9 text-xs font-bold uppercase tracking-tight border ${b.active ? "border-zinc-300 hover:border-[#FF3B30] hover:text-[#FF3B30]" : "border-zinc-300 hover:border-emerald-600 hover:text-emerald-600"}`}>
                  {b.active ? "Desativar" : "Ativar"}
                </button>
                <button data-testid={APANEL.bannerEdit(b.id)} onClick={() => setEditing(b)}
                  className="p-2.5 border border-zinc-300 hover:border-black" aria-label="Editar">
                  <Pencil size={16} />
                </button>
                <button data-testid={APANEL.bannerDelete(b.id)} onClick={() => setConfirmDelete(b)}
                  className="p-2.5 border border-zinc-300 hover:border-[#FF3B30] hover:text-[#FF3B30]" aria-label="Excluir">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <BannerFormModal
          banner={Object.keys(editing).length ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Excluir banner?"
          body={`Remover este banner da home? Esta ação não pode ser desfeita.`}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => remove(confirmDelete.id)}
        />
      )}
    </div>
  );
}

function BannerFormModal({ banner, onClose, onSaved }) {
  const isEdit = !!banner;
  const [linkUrl, setLinkUrl] = useState(banner?.link_url || "");
  const [alt, setAlt] = useState(banner?.alt || "");
  const [active, setActive] = useState(banner?.active ?? true);
  const [desktopFile, setDesktopFile] = useState(null);
  const [mobileFile, setMobileFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!isEdit && !desktopFile) {
      setError("Selecione a imagem desktop (1920×500).");
      return;
    }
    if (!linkUrl.trim()) {
      setError("Informe a URL de destino do banner.");
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      if (desktopFile) fd.append("image_desktop", desktopFile);
      if (mobileFile) fd.append("image_mobile", mobileFile);
      fd.append("link_url", linkUrl.trim());
      fd.append("alt", alt.trim());
      fd.append("active", String(active));
      if (isEdit) {
        await api.put(`/admin/banners/${banner.id}`, fd);
      } else {
        await api.post("/admin/banners", fd);
      }
      onSaved?.();
    } catch (err) {
      setError(err?.response?.data?.detail || "Erro ao salvar banner.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="bg-white max-w-2xl w-full" data-testid="apanel-banner-modal">
        <div className="sticky top-0 bg-white border-b border-zinc-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] font-bold text-zinc-500">{isEdit ? "Editar banner" : "Novo banner"}</div>
            <div className="text-2xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>
              Banner da home
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-zinc-100" aria-label="Fechar"><X size={20} /></button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-5">
          {error && <div className="border-l-4 border-[#FF3B30] bg-red-50 text-red-700 text-sm px-4 py-2">{error}</div>}

          <Field label={`Imagem Desktop ${isEdit ? "(deixe vazio p/ manter)" : "— 1920×500 px"}`}>
            <input
              data-testid={APANEL.bannerFormImageDesktop}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={(e) => setDesktopFile(e.target.files?.[0] || null)}
              className="w-full text-sm file:mr-3 file:px-4 file:py-2 file:border file:border-zinc-300 file:bg-white file:font-bold file:uppercase file:text-xs file:tracking-tight hover:file:border-black"
            />
            {isEdit && banner.image_desktop_path && (
              <div className="mt-2 w-full h-24 bg-zinc-100 overflow-hidden border border-zinc-200">
                <img src={fileUrl(banner.image_desktop_path)} alt="" className="w-full h-full object-cover" />
              </div>
            )}
          </Field>

          <Field label={`Imagem Mobile (opcional) — 1080×1080 px`}>
            <input
              data-testid={APANEL.bannerFormImageMobile}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={(e) => setMobileFile(e.target.files?.[0] || null)}
              className="w-full text-sm file:mr-3 file:px-4 file:py-2 file:border file:border-zinc-300 file:bg-white file:font-bold file:uppercase file:text-xs file:tracking-tight hover:file:border-black"
            />
            <div className="text-[11px] text-zinc-500 mt-1.5">
              Se não enviar, será usada a imagem desktop também no celular.
            </div>
            {isEdit && banner.image_mobile_path && (
              <div className="mt-2 w-24 h-24 bg-zinc-100 overflow-hidden border border-zinc-200">
                <img src={fileUrl(banner.image_mobile_path)} alt="" className="w-full h-full object-cover" />
              </div>
            )}
          </Field>

          <Field label="Link de destino (URL externa)">
            <input
              data-testid={APANEL.bannerFormLink}
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
              required
              className="w-full h-12 px-4 border border-zinc-300 focus:border-black outline-none bg-white"
            />
          </Field>

          <Field label="Descrição (alt — usada para SEO/acessibilidade)">
            <input
              data-testid={APANEL.bannerFormAlt}
              type="text"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="Ex: Promoção de SUVs em Campo Grande"
              maxLength={140}
              className="w-full h-12 px-4 border border-zinc-300 focus:border-black outline-none bg-white"
            />
          </Field>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              data-testid={APANEL.bannerFormActive}
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="w-5 h-5 accent-black"
            />
            <span className="text-sm font-bold uppercase tracking-tight">Banner ativo (visível na home)</span>
          </label>

          <div className="flex gap-3 pt-2 border-t border-zinc-200">
            <button type="button" onClick={onClose} className="flex-1 h-12 border border-zinc-300 hover:border-black font-bold uppercase tracking-tight">Cancelar</button>
            <button
              data-testid={APANEL.bannerFormSubmit}
              type="submit"
              disabled={saving}
              className="flex-1 h-12 bg-black hover:bg-zinc-800 disabled:opacity-60 text-white font-bold uppercase tracking-tight"
            >
              {saving ? "Salvando…" : isEdit ? "Salvar alterações" : "Criar banner"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Notifications */
function PushSettings() {
  const [status, setStatus] = useState({ configured: false, subscriptions: 0 });
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { kind: 'ok'|'err', text: string }
  const [permission, setPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );

  const refresh = useCallback(async () => {
    try {
      const s = await pushLib.getStatus();
      setStatus(s);
    } catch (_) {
      setStatus({ configured: false, subscriptions: 0 });
    }
    setEnabled(await pushLib.isEnabledOnThisDevice());
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const enable = async () => {
    setBusy(true); setMsg(null);
    const r = await pushLib.enablePush();
    if (r.ok) setMsg({ kind: "ok", text: "Notificações ativadas neste dispositivo." });
    else setMsg({ kind: "err", text: r.message });
    await refresh();
    setBusy(false);
  };

  const disable = async () => {
    setBusy(true); setMsg(null);
    const r = await pushLib.disablePush();
    if (r.ok) setMsg({ kind: "ok", text: "Notificações desativadas neste dispositivo." });
    else setMsg({ kind: "err", text: r.message });
    await refresh();
    setBusy(false);
  };

  const test = async () => {
    setBusy(true); setMsg(null);
    const r = await pushLib.sendTest();
    if (r.ok) {
      setMsg({
        kind: r.sent > 0 ? "ok" : "err",
        text: r.sent > 0
          ? `Teste enviado para ${r.sent} dispositivo(s).`
          : "Nenhum dispositivo ativo. Ative primeiro no botão acima.",
      });
    } else {
      setMsg({ kind: "err", text: r.message });
    }
    setBusy(false);
  };

  const supported = pushLib.isPushSupported();

  return (
    <div data-testid="apanel-push-settings" className="mb-6 border-2 border-zinc-200 bg-zinc-50 p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] font-black text-zinc-500">
            Notificações no celular
          </div>
          <div className="mt-1 font-black tracking-tight text-lg" style={{ fontFamily: "Cabinet Grotesk" }}>
            Push nativo (Web Push)
          </div>
          <p className="text-sm text-zinc-600 mt-1 max-w-xl">
            Receba um aviso instantâneo no seu celular sempre que houver um novo lojista
            pendente ou um anúncio aguardando moderação.
          </p>
        </div>
        <div className="text-xs text-zinc-500 uppercase tracking-widest font-bold">
          {status.subscriptions} dispositivo(s) ativo(s)
        </div>
      </div>

      {!supported && (
        <div className="mt-4 border-l-4 border-amber-500 bg-amber-50 text-amber-800 text-sm px-4 py-3">
          Este navegador não suporta notificações push. Abra o painel no Chrome/Edge/Firefox no Android
          ou no Safari 16.4+ no iPhone/iPad.
        </div>
      )}

      {supported && !status.configured && (
        <div className="mt-4 border-l-4 border-amber-500 bg-amber-50 text-amber-800 text-sm px-4 py-3">
          Notificações push ainda não configuradas no servidor.
        </div>
      )}

      {supported && status.configured && permission === "denied" && (
        <div className="mt-4 border-l-4 border-[#FF3B30] bg-red-50 text-red-700 text-sm px-4 py-3">
          Você bloqueou as notificações neste navegador. Reative nas configurações do site do navegador
          e tente novamente.
        </div>
      )}

      {msg && (
        <div className={`mt-4 border-l-4 text-sm px-4 py-3 ${msg.kind === "ok" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-[#FF3B30] bg-red-50 text-red-700"}`}>
          {msg.text}
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {!enabled ? (
          <button
            data-testid="apanel-push-enable"
            onClick={enable}
            disabled={busy || !supported || !status.configured || permission === "denied"}
            className="inline-flex items-center gap-2 bg-black text-white px-5 h-11 font-bold uppercase tracking-tight text-xs hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Bell size={14} /> Ativar notificações neste celular
          </button>
        ) : (
          <>
            <span data-testid="apanel-push-active-badge" className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 h-11 font-bold uppercase tracking-tight text-xs">
              <Check size={14} /> Ativadas neste dispositivo
            </span>
            <button
              data-testid="apanel-push-test"
              onClick={test}
              disabled={busy}
              className="inline-flex items-center gap-2 border border-zinc-300 hover:border-black px-4 h-11 font-bold uppercase tracking-tight text-xs disabled:opacity-40"
            >
              Enviar teste
            </button>
            <button
              data-testid="apanel-push-disable"
              onClick={disable}
              disabled={busy}
              className="inline-flex items-center gap-2 border border-zinc-300 hover:border-[#FF3B30] hover:text-[#FF3B30] px-4 h-11 font-bold uppercase tracking-tight text-xs disabled:opacity-40"
            >
              Desativar aqui
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function NotificationsTab({ onChanged }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get("/admin/notifications").then(({ data }) => setItems(data)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const markRead = async (id) => {
    await api.put(`/admin/notifications/${id}/read`);
    load(); onChanged?.();
  };

  return (
    <div>
      <PushSettings />
      {loading ? (
        <div className="mt-8 text-zinc-500">Carregando…</div>
      ) : items.length === 0 ? (
        <Empty label="Nenhuma notificação." />
      ) : (
        <div className="border border-zinc-200 divide-y divide-zinc-200 bg-white">
          {items.map((n) => (
            <div key={n.id} data-testid={APANEL.notifRow(n.id)} className={`p-4 flex items-start gap-4 ${n.read ? "opacity-60" : ""}`}>
              <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${n.read ? "bg-zinc-300" : "bg-[#FF3B30]"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    {n.type === "new_dealer" ? "Novo lojista"
                      : n.type === "new_ad" ? "Novo anúncio"
                      : n.type === "ad_edited" ? "Anúncio editado"
                      : n.type}
                  </span>
                </div>
                <div className="font-bold tracking-tight">{n.title}</div>
                <div className="text-sm text-zinc-600">{n.body}</div>
                <div className="text-xs text-zinc-400 mt-1">{new Date(n.created_at).toLocaleString("pt-BR")}</div>
              </div>
              {!n.read && (
                <button data-testid={APANEL.notifMarkRead(n.id)} onClick={() => markRead(n.id)}
                  className="inline-flex items-center gap-1 border border-zinc-300 hover:border-black px-3 h-9 text-xs font-bold uppercase tracking-tight">
                  <Check size={14} /> Marcar lida
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- Settings */
function SettingsTab() {
  const [pixKey, setPixKey] = useState("");
  const [holder, setHolder] = useState("");
  const [city, setCity] = useState("");
  const [payload, setPayload] = useState("");
  const [plans, setPlans] = useState([]);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/admin/settings").then(({ data }) => {
      setPixKey(data.pix_key || "");
      setHolder(data.pix_holder_name || "");
      setCity(data.pix_city || "");
      setPayload(data.pix_payload || "");
      setPlans(data.plans || []);
    });
  }, []);

  const setPlanField = (code, field, value) =>
    setPlans((p) => p.map((pl) => (pl.code === code ? { ...pl, [field]: ["name", "period_label"].includes(field) ? value : Number(value) } : pl)));

  const planTestId = (code) => (code === "avulso" ? APANEL.settingsPlanAvulsoPrice : code === "loja" ? APANEL.settingsPlanLojaPrice : `apanel-settings-plan-${code}-price`);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setOk(false); setError("");
    try {
      await api.put("/admin/settings", {
        pix_key: pixKey,
        pix_holder_name: holder,
        pix_city: city,
        pix_payload: payload,
        plans,
      });
      setOk(true); setTimeout(() => setOk(false), 2200);
    } catch (err) {
      setError(err?.response?.data?.detail || "Erro ao salvar.");
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={save} className="max-w-3xl space-y-8">
      {error && <div className="border-l-4 border-[#FF3B30] bg-red-50 text-red-700 text-sm px-4 py-2">{error}</div>}
      {ok && <div className="border-l-4 border-emerald-500 bg-emerald-50 text-emerald-800 text-sm px-4 py-2">Configurações salvas!</div>}

      <div className="bg-white border border-zinc-200 p-6">
        <div className="text-xs uppercase tracking-[0.2em] font-bold text-zinc-500">Recebimento PIX</div>
        <div className="mt-5 grid sm:grid-cols-2 gap-4">
          <Field label="Chave PIX (CNPJ/Email/Celular)">
            <input data-testid={APANEL.settingsPix} value={pixKey} onChange={(e) => setPixKey(e.target.value)} required
              placeholder="Ex: 61.343.028/0001-16"
              className="w-full h-12 px-4 border border-zinc-300 focus:border-black outline-none bg-white" />
          </Field>
          <Field label="Titular da conta">
            <input data-testid={APANEL.settingsPixHolder} value={holder} onChange={(e) => setHolder(e.target.value)} required
              placeholder="Ex: Rogerio Alves"
              className="w-full h-12 px-4 border border-zinc-300 focus:border-black outline-none bg-white" />
          </Field>
          <Field label="Cidade do titular">
            <input data-testid="apanel-settings-pix-city" value={city} onChange={(e) => setCity(e.target.value)}
              placeholder="Ex: RIO DE JANEIRO"
              className="w-full h-12 px-4 border border-zinc-300 focus:border-black outline-none bg-white" />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="PIX Copia e Cola (payload completo do QR Code)">
            <textarea data-testid="apanel-settings-pix-payload" value={payload} onChange={(e) => setPayload(e.target.value)}
              rows={3}
              placeholder="00020126360014br.gov.bcb.pix..."
              className="w-full p-3 border border-zinc-300 focus:border-black outline-none bg-white font-mono text-xs leading-relaxed" />
            <div className="text-[11px] text-zinc-500 mt-1.5">
              Cole aqui o payload completo do QR Code (gerado pelo banco). Sem ele, o QR mostra apenas a chave.
            </div>
          </Field>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 p-6">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-[0.2em] font-bold text-zinc-500">Planos</div>
          <span className="text-[10px] font-black uppercase tracking-wider bg-black text-white px-2 py-1">Trimestral</span>
        </div>
        <div className="mt-5 space-y-5">
          {plans.map((pl) => (
            <div key={pl.code} className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end border-b border-zinc-100 pb-4">
              <Field label="Nome do plano">
                <input value={pl.name} onChange={(e) => setPlanField(pl.code, "name", e.target.value)}
                  className="w-full h-12 px-4 border border-zinc-300 focus:border-black outline-none bg-white" />
              </Field>
              <Field label="Preço (R$)">
                <input data-testid={planTestId(pl.code)} type="number" step="0.01" value={pl.price}
                  onChange={(e) => setPlanField(pl.code, "price", e.target.value)}
                  className="w-full h-12 px-4 border border-zinc-300 focus:border-black outline-none bg-white" />
              </Field>
              <Field label="Limite de anúncios">
                <input type="number" value={pl.ad_limit} onChange={(e) => setPlanField(pl.code, "ad_limit", e.target.value)}
                  className="w-full h-12 px-4 border border-zinc-300 focus:border-black outline-none bg-white" />
              </Field>
              <Field label="Limite de ofertas em destaque">
                <input
                  data-testid={`admin-plan-${pl.code}-offer-limit`}
                  type="number"
                  value={pl.offer_limit ?? 0}
                  onChange={(e) => setPlanField(pl.code, "offer_limit", e.target.value)}
                  className="w-full h-12 px-4 border border-zinc-300 focus:border-black outline-none bg-white"
                />
              </Field>
              <Field label="Validade (dias)">
                <input type="number" value={pl.period_days ?? 90}
                  onChange={(e) => setPlanField(pl.code, "period_days", e.target.value)}
                  className="w-full h-12 px-4 border border-zinc-300 focus:border-black outline-none bg-white" />
              </Field>
            </div>
          ))}
        </div>
      </div>

      <button data-testid={APANEL.settingsSubmit} type="submit" disabled={saving}
        className="bg-black hover:bg-zinc-800 text-white px-8 h-12 font-bold uppercase tracking-tight text-sm disabled:opacity-60">
        {saving ? "Salvando…" : "Salvar configurações"}
      </button>
    </form>
  );
}

/* ---------------------------------------------------------------- Services */
function ServicesTab() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null = closed, {} = new, {...} = edit
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [filter, setFilter] = useState("all");

  const load = useCallback(() => {
    setLoading(true);
    api.get("/admin/services").then(({ data }) => setItems(data)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get("/service-categories").then(({ data }) => setCategories(data)).catch(() => {});
  }, []);

  const toggleActive = async (s) => {
    const fd = new FormData();
    fd.append("active", String(!s.active));
    await api.put(`/admin/services/${s.id}`, fd);
    load();
  };

  const remove = async (id) => {
    await api.delete(`/admin/services/${id}`);
    setConfirmDelete(null);
    load();
  };

  const filtered = filter === "all" ? items : items.filter((s) => s.category === filter);
  const catLabel = (code) => categories.find((c) => c.code === code)?.label || code;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] font-bold text-zinc-500">Empresas de serviços</div>
          <p className="text-sm text-zinc-600 mt-1 max-w-2xl">
            Cadastro exclusivo do administrador. Ao criar, uma mini-página pública é gerada em{" "}
            <code className="bg-zinc-100 px-1.5 py-0.5 text-xs">/servicos/&lt;slug&gt;</code>.
          </p>
        </div>
        <button
          data-testid={APANEL_SVC.newBtn}
          onClick={() => setEditing({})}
          className="inline-flex items-center gap-2 text-white px-5 h-11 font-bold uppercase tracking-tight text-sm hover:opacity-90"
          style={{ backgroundColor: "#0E7C86" }}
        >
          <Plus size={16} /> Nova empresa
        </button>
      </div>

      <div className="mt-6">
        <FilterPills
          options={[
            { k: "all", label: `Todas (${items.length})` },
            ...categories.map((c) => ({
              k: c.code,
              label: `${c.label} (${items.filter((s) => s.category === c.code).length})`,
            })),
          ]}
          value={filter}
          onChange={setFilter}
        />
      </div>

      {loading ? (
        <div className="mt-8 text-zinc-500">Carregando…</div>
      ) : filtered.length === 0 ? (
        <Empty label="Nenhuma empresa cadastrada nesta categoria." />
      ) : (
        <div className="mt-6 border border-zinc-200 divide-y divide-zinc-200 bg-white">
          {filtered.map((s) => (
            <div key={s.id} data-testid={APANEL_SVC.row(s.id)} className="p-4 flex flex-col md:flex-row md:items-center gap-4 hover:bg-zinc-50">
              <div className="w-14 h-14 bg-zinc-100 flex items-center justify-center flex-shrink-0 overflow-hidden border border-zinc-200">
                {s.logo_path ? (
                  <img src={fileUrl(s.logo_path)} alt={s.name} className="w-full h-full object-cover" />
                ) : (
                  <Wrench size={18} className="text-zinc-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold tracking-tight truncate">{s.name}</span>
                  <span
                    className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 text-white"
                    style={{ backgroundColor: "#0E7C86" }}
                  >
                    {catLabel(s.category)}
                  </span>
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 ${s.active ? "bg-emerald-100 text-emerald-800" : "bg-zinc-200 text-zinc-600"}`}>
                    {s.active ? "Ativa" : "Inativa"}
                  </span>
                </div>
                <div className="text-xs text-zinc-500 mt-1 truncate">
                  {s.city}/{s.uf} · {s.phone || "sem telefone"} · slug: <code className="bg-zinc-100 px-1">{s.slug}</code>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <a
                  href={`/servicos/${s.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 border border-zinc-300 hover:border-black px-3 h-9 text-xs font-bold uppercase tracking-tight"
                >
                  <ExternalLink size={14} /> Abrir
                </a>
                <button
                  data-testid={APANEL_SVC.toggle(s.id)}
                  onClick={() => toggleActive(s)}
                  className={`px-3 h-9 text-xs font-bold uppercase tracking-tight border ${s.active ? "border-zinc-300 hover:border-[#FF3B30] hover:text-[#FF3B30]" : "border-zinc-300 hover:border-emerald-600 hover:text-emerald-600"}`}
                >
                  {s.active ? "Desativar" : "Ativar"}
                </button>
                <button data-testid={APANEL_SVC.edit(s.id)} onClick={() => setEditing(s)}
                  className="p-2.5 border border-zinc-300 hover:border-black" aria-label="Editar">
                  <Pencil size={16} />
                </button>
                <button data-testid={APANEL_SVC.delete(s.id)} onClick={() => setConfirmDelete(s)}
                  className="p-2.5 border border-zinc-300 hover:border-[#FF3B30] hover:text-[#FF3B30]" aria-label="Excluir">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <ServiceFormModal
          service={Object.keys(editing).length ? editing : null}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Excluir empresa de serviço?"
          body={`Remover "${confirmDelete.name}"? A mini-página pública será excluída. Esta ação não pode ser desfeita.`}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => remove(confirmDelete.id)}
        />
      )}
    </div>
  );
}

function ServiceFormModal({ service, categories, onClose, onSaved }) {
  const isEdit = !!service;
  const [form, setForm] = useState({
    name: service?.name || "",
    category: service?.category || (categories[0]?.code || ""),
    description: service?.description || "",
    phone: service?.phone || "",
    whatsapp: service?.whatsapp || "",
    city: service?.city || "Campo Grande",
    uf: service?.uf || "MS",
    address: service?.address || "",
    active: service?.active ?? true,
  });
  const [logoFile, setLogoFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) { setError("Informe o nome da empresa."); return; }
    if (!form.category) { setError("Selecione uma categoria."); return; }
    if (!form.city.trim() || !form.uf.trim()) { setError("Informe cidade e UF."); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, typeof v === "boolean" ? String(v) : v));
      if (logoFile) fd.append("logo", logoFile);
      if (coverFile) fd.append("cover", coverFile);
      if (isEdit) {
        await api.put(`/admin/services/${service.id}`, fd);
      } else {
        await api.post("/admin/services", fd);
      }
      onSaved?.();
    } catch (err) {
      setError(err?.response?.data?.detail || "Erro ao salvar empresa.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="bg-white max-w-2xl w-full" data-testid="apanel-service-modal">
        <div className="sticky top-0 bg-white border-b border-zinc-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] font-bold text-zinc-500">
              {isEdit ? "Editar empresa" : "Nova empresa"}
            </div>
            <div className="text-2xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>
              Serviços
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-zinc-100" aria-label="Fechar"><X size={20} /></button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-5">
          {error && <div className="border-l-4 border-[#FF3B30] bg-red-50 text-red-700 text-sm px-4 py-2">{error}</div>}
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Nome da empresa">
              <input data-testid={APANEL_SVC.formName} value={form.name} onChange={(e) => set("name", e.target.value)}
                maxLength={120}
                className="w-full h-12 px-4 border border-zinc-300 focus:border-black outline-none bg-white" />
            </Field>
            <Field label="Categoria de serviço">
              <select data-testid={APANEL_SVC.formCategory} value={form.category} onChange={(e) => set("category", e.target.value)}
                className="w-full h-12 px-4 border border-zinc-300 focus:border-black outline-none bg-white">
                {categories.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Telefone">
              <input data-testid={APANEL_SVC.formPhone} value={form.phone} onChange={(e) => set("phone", e.target.value)}
                placeholder="(67) 99999-9999"
                className="w-full h-12 px-4 border border-zinc-300 focus:border-black outline-none bg-white" />
            </Field>
            <Field label="WhatsApp">
              <input data-testid={APANEL_SVC.formWhatsapp} value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)}
                placeholder="(67) 99999-9999"
                className="w-full h-12 px-4 border border-zinc-300 focus:border-black outline-none bg-white" />
            </Field>
            <Field label="Cidade">
              <input data-testid={APANEL_SVC.formCity} value={form.city} onChange={(e) => set("city", e.target.value)}
                className="w-full h-12 px-4 border border-zinc-300 focus:border-black outline-none bg-white" />
            </Field>
            <Field label="UF">
              <select data-testid={APANEL_SVC.formUf} value={form.uf} onChange={(e) => set("uf", e.target.value)}
                className="w-full h-12 px-4 border border-zinc-300 focus:border-black outline-none bg-white">
                {UF_STATES.map((u) => <option key={u.code} value={u.code}>{u.code} - {u.name}</option>)}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Endereço completo">
                <input data-testid={APANEL_SVC.formAddress} value={form.address} onChange={(e) => set("address", e.target.value)}
                  placeholder="Rua, número, bairro"
                  className="w-full h-12 px-4 border border-zinc-300 focus:border-black outline-none bg-white" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Descrição da empresa">
                <textarea data-testid={APANEL_SVC.formDescription} value={form.description} onChange={(e) => set("description", e.target.value)}
                  rows={4} maxLength={800}
                  placeholder="Serviços oferecidos, diferenciais, horário de atendimento..."
                  className="w-full px-4 py-3 border border-zinc-300 focus:border-black outline-none" />
              </Field>
            </div>
            <Field label={`Logo ${isEdit ? "(deixe vazio p/ manter)" : "(quadrado, ideal 400×400)"}`}>
              <input
                data-testid={APANEL_SVC.formLogo}
                type="file" accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                className="w-full text-sm file:mr-3 file:px-4 file:py-2 file:border file:border-zinc-300 file:bg-white file:font-bold file:uppercase file:text-xs file:tracking-tight hover:file:border-black"
              />
              {isEdit && service.logo_path && !logoFile && (
                <div className="mt-2 w-16 h-16 bg-zinc-100 overflow-hidden border border-zinc-200">
                  <img src={fileUrl(service.logo_path)} alt="" className="w-full h-full object-cover" />
                </div>
              )}
            </Field>
            <Field label={`Foto de capa ${isEdit ? "(deixe vazio p/ manter)" : "(horizontal, ideal 1600×600)"}`}>
              <input
                data-testid={APANEL_SVC.formCover}
                type="file" accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                className="w-full text-sm file:mr-3 file:px-4 file:py-2 file:border file:border-zinc-300 file:bg-white file:font-bold file:uppercase file:text-xs file:tracking-tight hover:file:border-black"
              />
              {isEdit && service.cover_path && !coverFile && (
                <div className="mt-2 w-full h-24 bg-zinc-100 overflow-hidden border border-zinc-200">
                  <img src={fileUrl(service.cover_path)} alt="" className="w-full h-full object-cover" />
                </div>
              )}
            </Field>
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              data-testid={APANEL_SVC.formActive}
              type="checkbox"
              checked={form.active}
              onChange={(e) => set("active", e.target.checked)}
              className="w-5 h-5 accent-black"
            />
            <span className="text-sm font-bold uppercase tracking-tight">Empresa ativa (visível em /servicos)</span>
          </label>

          <div className="flex gap-3 pt-2 border-t border-zinc-200">
            <button type="button" onClick={onClose} className="flex-1 h-12 border border-zinc-300 hover:border-black font-bold uppercase tracking-tight">Cancelar</button>
            <button
              data-testid={APANEL_SVC.formSubmit}
              type="submit"
              disabled={saving}
              className="flex-1 h-12 text-white font-bold uppercase tracking-tight disabled:opacity-60 hover:opacity-90"
              style={{ backgroundColor: "#0E7C86" }}
            >
              {saving ? "Salvando…" : isEdit ? "Salvar alterações" : "Criar empresa"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Shared */
function FilterPills({ options, value, onChange, testId }) {
  return (
    <div data-testid={testId} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.k} onClick={() => onChange(o.k)}
          className={`px-4 h-9 text-xs font-bold uppercase tracking-tight border transition-colors ${value === o.k ? "bg-black text-white border-black" : "border-zinc-300 hover:border-black"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Empty({ label }) {
  return <div className="mt-8 border-2 border-dashed border-zinc-300 py-16 text-center text-zinc-500">{label}</div>;
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-widest text-zinc-700">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function ConfirmModal({ title, body, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4">
      <div className="bg-white max-w-md w-full p-6" data-testid="apanel-confirm-modal">
        <div className="text-xl font-black tracking-tighter">{title}</div>
        <div className="mt-2 text-sm text-zinc-600">{body}</div>
        <div className="mt-6 flex gap-3">
          <button data-testid="apanel-confirm-cancel" onClick={onCancel} className="flex-1 h-11 border border-zinc-300 font-bold uppercase tracking-tight text-sm">Cancelar</button>
          <button data-testid="apanel-confirm-delete" onClick={onConfirm} className="flex-1 h-11 bg-[#FF3B30] hover:bg-[#E13128] text-white font-bold uppercase tracking-tight text-sm">Excluir</button>
        </div>
      </div>
    </div>
  );
}


function EInput({ testid, value, onChange, type = "text" }) {
  return (
    <input
      data-testid={testid}
      type={type}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-12 px-4 border border-zinc-300 focus:border-black outline-none bg-white"
    />
  );
}

function EditUserModal({ user, onClose, onSaved }) {
  const [plans, setPlans] = useState([]);
  const [form, setForm] = useState({
    store_name: user.store_name || "",
    email: user.email || "",
    phone: user.phone || "",
    whatsapp: user.whatsapp || "",
    city: user.city || "",
    uf: user.uf || "",
    address: user.address || "",
    description: user.description || "",
    plan_code: user.plan_code || "avulso",
  });
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/settings/public").then(({ data }) => setPlans(data.plans || [])).catch(() => {});
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      const payload = { ...form };
      if (password) payload.password = password;
      await api.put(`/admin/users/${user.id}`, payload);
      onSaved?.();
    } catch (err) {
      setError(err?.response?.data?.detail || "Erro ao salvar.");
      setSaving(false);
    }
  };

  const planOptions = plans.length ? plans : [{ code: "avulso", name: "Avulso" }, { code: "loja", name: "Loja" }];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="bg-white max-w-2xl w-full" data-testid="apanel-edit-user-modal">
        <div className="sticky top-0 bg-white border-b border-zinc-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] font-bold text-zinc-500">Editar revendedor</div>
            <div className="text-2xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>{user.store_name}</div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100" aria-label="Fechar"><X size={20} /></button>
        </div>

        <form onSubmit={save} className="p-6 space-y-5">
          {error && <div className="border-l-4 border-[#FF3B30] bg-red-50 text-red-700 text-sm px-4 py-2">{error}</div>}
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Nome da loja"><EInput value={form.store_name} onChange={(v) => set("store_name", v)} /></Field>
            <Field label="E-mail (login)"><EInput testid="apanel-edit-email" type="email" value={form.email} onChange={(v) => set("email", v)} /></Field>
            <Field label="Telefone"><EInput value={form.phone} onChange={(v) => set("phone", v)} /></Field>
            <Field label="WhatsApp"><EInput value={form.whatsapp} onChange={(v) => set("whatsapp", v)} /></Field>
            <Field label="Cidade"><EInput value={form.city} onChange={(v) => set("city", v)} /></Field>
            <Field label="UF">
              <select value={form.uf} onChange={(e) => set("uf", e.target.value)} className="w-full h-12 px-4 border border-zinc-300 focus:border-black outline-none bg-white">
                <option value="">—</option>
                {UF_STATES.map((u) => <option key={u.code} value={u.code}>{u.code} - {u.name}</option>)}
              </select>
            </Field>
            <Field label="Plano">
              <select data-testid="apanel-edit-plan" value={form.plan_code} onChange={(e) => set("plan_code", e.target.value)} className="w-full h-12 px-4 border border-zinc-300 focus:border-black outline-none bg-white">
                {planOptions.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Redefinir senha (opcional)">
              <div className="relative">
                <input
                  data-testid="apanel-edit-password"
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Deixe vazio para manter"
                  className="w-full h-12 px-4 pr-12 border border-zinc-300 focus:border-black outline-none bg-white"
                />
                <button type="button" onClick={() => setShowPwd((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black" aria-label="Mostrar senha">
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Endereço"><EInput value={form.address} onChange={(v) => set("address", v)} /></Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Descrição">
                <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} className="w-full px-4 py-3 border border-zinc-300 focus:border-black outline-none" />
              </Field>
            </div>
          </div>
          <div className="flex gap-3 pt-2 border-t border-zinc-200">
            <button type="button" onClick={onClose} className="flex-1 h-12 border border-zinc-300 hover:border-black font-bold uppercase tracking-tight">Cancelar</button>
            <button type="submit" data-testid="apanel-edit-submit" disabled={saving} className="flex-1 h-12 bg-black hover:bg-zinc-800 disabled:opacity-60 text-white font-bold uppercase tracking-tight">{saving ? "Salvando…" : "Salvar"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
