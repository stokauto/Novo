/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { fileUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { DPANEL } from "@/constants/testIds";
import { brl, km, UF_LIST } from "@/lib/format";
import PendingApproval from "@/components/PendingApproval";
import VehicleForm from "@/components/VehicleForm";
import { Plus, Pencil, Trash2, Image as ImageIcon, Upload, Car, User as UserIcon, CreditCard, Eye, EyeOff } from "lucide-react";
import { Link } from "react-router-dom";

const STATUS_LABEL = {
  pending: { label: "Pendente", cls: "bg-amber-100 text-amber-800" },
  active: { label: "Ativo", cls: "bg-emerald-100 text-emerald-800" },
  paused: { label: "Pausado", cls: "bg-zinc-200 text-zinc-700" },
  blocked: { label: "Bloqueado", cls: "bg-red-100 text-red-700" },
  deleted: { label: "Removido", cls: "bg-zinc-300 text-zinc-600" },
};

export default function DealerPanel() {
  const { user, refresh } = useAuth();
  const [tab, setTab] = useState("vehicles");

  if (!user) return null;
  if (user.status !== "active") return <PendingApproval />;

  return (
    <div data-testid={DPANEL.page} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] font-bold text-zinc-500">Painel do revendedor</div>
          <h1 className="mt-2 text-4xl sm:text-5xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>
            {user.store_name}
          </h1>
          <div className="mt-1 text-zinc-600 text-sm">
            {user.city}/{user.uf} · Plano <span className="font-bold">{user.plan_name}</span> · Limite {user.plan_ad_limit} anúncios
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Link
            to="/repasse"
            data-testid="dealer-panel-repasse-link"
            className="self-start md:self-auto text-xs font-bold uppercase tracking-tight border-b-2 border-[#F5A623] text-[#B5820E] hover:text-[#F5A623]"
          >
            Ver Hub de Repasse →
          </Link>
          <Link
            to={`/revendedor/${user.slug}`}
            target="_blank"
            rel="noreferrer"
            className="self-start md:self-auto text-xs font-bold uppercase tracking-tight border-b-2 border-black hover:text-[#FF3B30] hover:border-[#FF3B30]"
          >
            Ver mini site público →
          </Link>
        </div>
      </div>

      <div className="mt-8 border-b border-zinc-200 flex gap-1 overflow-x-auto">
        <TabBtn id={DPANEL.tabVehicles} active={tab === "vehicles"} onClick={() => setTab("vehicles")} icon={<Car size={14} />}>
          Meus anúncios
        </TabBtn>
        <TabBtn id={DPANEL.tabProfile} active={tab === "profile"} onClick={() => setTab("profile")} icon={<UserIcon size={14} />}>
          Perfil da loja
        </TabBtn>
        <TabBtn id={DPANEL.tabPlan} active={tab === "plan"} onClick={() => setTab("plan")} icon={<CreditCard size={14} />}>
          Plano
        </TabBtn>
      </div>

      <div className="mt-8">
        {tab === "vehicles" && <VehiclesTab user={user} />}
        {tab === "profile" && <ProfileTab user={user} onSaved={refresh} />}
        {tab === "plan" && <PlanTab user={user} />}
      </div>
    </div>
  );
}

function TabBtn({ id, active, onClick, icon, children }) {
  return (
    <button
      data-testid={id}
      onClick={onClick}
      className={`px-4 py-3 text-sm font-bold uppercase tracking-tight border-b-2 -mb-px inline-flex items-center gap-2 transition-colors whitespace-nowrap ${
        active ? "border-[#FF3B30] text-black" : "border-transparent text-zinc-500 hover:text-black"
      }`}
    >
      {icon} {children}
    </button>
  );
}

function VehiclesTab({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | "new" | vehicle object
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/dealer/vehicles");
      setItems(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onDelete = async (id) => {
    await api.delete(`/dealer/vehicles/${id}`);
    setConfirmDelete(null);
    load();
  };

  const visible = items.filter((v) => v.status !== "deleted");
  const remaining = Math.max(0, (user.plan_ad_limit || 0) - visible.filter((v) => ["active", "pending"].includes(v.status)).length);

  return (
    <div>
      {remaining <= 0 && (
        <div
          data-testid="dpanel-plan-limit-warning"
          className="mb-5 border-l-4 border-[#FF3B30] bg-red-50 px-5 py-4 flex items-start gap-3"
        >
          <div className="text-2xl leading-none">⚠️</div>
          <div className="flex-1">
            <div className="font-black tracking-tight text-[#FF3B30] uppercase text-sm">
              Limite de anúncios atingido
            </div>
            <div className="text-sm text-zinc-700 mt-1 leading-relaxed">
              Seu plano <strong>{user.plan_name}</strong> permite{" "}
              <strong>{user.plan_ad_limit} anúncio{user.plan_ad_limit > 1 ? "s" : ""}</strong> ativos/pendentes.
              Para anunciar mais, faça upgrade ou exclua um anúncio existente.
            </div>
            <button
              onClick={() => {
                const tabBtn = document.querySelector(`[data-testid="${DPANEL.tabPlan}"]`);
                if (tabBtn) tabBtn.click();
              }}
              className="mt-3 text-xs font-bold uppercase tracking-tight bg-[#FF3B30] text-white px-4 h-9 inline-flex items-center"
            >
              Ver planos →
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-zinc-600">
          {visible.length} anúncio(s) ·{" "}
          <span className={`font-bold ${remaining <= 0 ? "text-[#FF3B30]" : "text-black"}`}>
            {remaining}
          </span>{" "}
          vaga(s) restante(s) <span className="text-zinc-400">(plano {user.plan_name})</span>
        </div>
        <button
          data-testid={DPANEL.newVehicle}
          onClick={() => setEditing("new")}
          disabled={remaining <= 0}
          title={remaining <= 0 ? "Limite do plano atingido" : "Cadastrar novo veículo"}
          className="bg-[#FF3B30] hover:bg-[#E13128] disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 h-11 font-bold uppercase tracking-tight text-sm inline-flex items-center gap-2"
        >
          <Plus size={16} /> Novo anúncio
        </button>
      </div>

      {loading ? (
        <div className="mt-8 text-zinc-500">Carregando…</div>
      ) : visible.length === 0 ? (
        <EmptyState onCreate={() => setEditing("new")} disabled={remaining <= 0} />
      ) : (
        <div className="mt-6 border border-zinc-200 divide-y divide-zinc-200 bg-white">
          {visible.map((v) => (
            <div key={v.id} data-testid={DPANEL.vehicleRow(v.id)} className="p-4 flex items-center gap-4 hover:bg-zinc-50">
              <div className="w-20 h-20 bg-zinc-100 flex-shrink-0 overflow-hidden">
                {v.main_photo ? (
                  <img src={fileUrl(v.main_photo)} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full grid place-items-center text-zinc-400"><ImageIcon size={20} /></div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-bold tracking-tight truncate">
                    {v.brand} {v.model} <span className="text-zinc-500 font-normal">{v.version}</span>
                  </div>
                  <Badge status={v.status} />
                  {v.ad_type === "repasse" && (
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-[#FFF8EC] text-[#8A5F0D] border border-[#F5A623]">
                      Repasse B2B
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  {v.year_made}/{v.year_model} · {km(v.km)} · {v.city}/{v.uf}
                </div>
                {v.ad_type === "repasse" ? (
                  <div className="text-sm mt-1 flex items-center gap-2">
                    <span className="text-zinc-500 line-through">FIPE {brl(v.fipe_price)}</span>
                    <span className="font-bold text-[#B5820E]">Oferta {brl(v.price)}</span>
                  </div>
                ) : (
                  <div className="text-sm font-bold mt-1">{brl(v.price)}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  data-testid={DPANEL.vehicleEdit(v.id)}
                  onClick={() => setEditing(v)}
                  className="p-2.5 border border-zinc-300 hover:border-black"
                  aria-label="Editar"
                >
                  <Pencil size={16} />
                </button>
                <button
                  data-testid={DPANEL.vehicleDelete(v.id)}
                  onClick={() => setConfirmDelete(v)}
                  className="p-2.5 border border-zinc-300 hover:border-[#FF3B30] hover:text-[#FF3B30]"
                  aria-label="Excluir"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <VehicleForm
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => load()}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Excluir anúncio?"
          body={`Tem certeza que deseja excluir "${confirmDelete.brand} ${confirmDelete.model}"? Esta ação não pode ser desfeita.`}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => onDelete(confirmDelete.id)}
        />
      )}
    </div>
  );
}

function Badge({ status }) {
  const s = STATUS_LABEL[status] || STATUS_LABEL.pending;
  return <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 ${s.cls}`}>{s.label}</span>;
}

function EmptyState({ onCreate, disabled }) {
  return (
    <div className="mt-10 border-2 border-dashed border-zinc-300 p-12 text-center">
      <div className="inline-flex w-12 h-12 bg-black text-white items-center justify-center">
        <Car size={20} />
      </div>
      <div className="mt-4 text-xl font-black tracking-tight">Nenhum anúncio ainda</div>
      <div className="mt-2 text-sm text-zinc-500">Crie seu primeiro anúncio para começar a receber contatos via WhatsApp.</div>
      <button
        onClick={onCreate}
        disabled={disabled}
        className="mt-6 bg-[#FF3B30] hover:bg-[#E13128] disabled:opacity-50 text-white px-6 h-12 font-bold uppercase tracking-tight text-sm inline-flex items-center gap-2"
      >
        <Plus size={16} /> Criar anúncio
      </button>
    </div>
  );
}

function ProfileTab({ user, onSaved }) {
  const [form, setForm] = useState({
    store_name: user.store_name || "",
    phone: user.phone || "",
    whatsapp: user.whatsapp || "",
    city: user.city || "",
    uf: user.uf || "",
    address: user.address || "",
    description: user.description || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true); setError(""); setOk(false);
    try {
      await api.put("/dealer/profile", form);
      setOk(true);
      onSaved?.();
      setTimeout(() => setOk(false), 2200);
    } catch (err) {
      setError(err?.response?.data?.detail || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const uploadImage = async (kind, file) => {
    const fd = new FormData();
    fd.append("file", file);
    const url = kind === "logo" ? "/dealer/logo" : "/dealer/cover";
    if (kind === "logo") setLogoUploading(true); else setCoverUploading(true);
    try {
      await api.post(url, fd, { headers: { "Content-Type": "multipart/form-data" } });
      onSaved?.();
    } finally {
      if (kind === "logo") setLogoUploading(false); else setCoverUploading(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-white border border-zinc-200 p-6">
        <form onSubmit={save} className="space-y-5">
          {error && <div className="border-l-4 border-[#FF3B30] bg-red-50 text-red-700 text-sm px-4 py-2">{error}</div>}
          {ok && <div className="border-l-4 border-emerald-500 bg-emerald-50 text-emerald-800 text-sm px-4 py-2">Perfil atualizado!</div>}

          <Row>
            <Field label="Nome da loja">
              <Input value={form.store_name} onChange={(v) => set("store_name", v)} required />
            </Field>
            <Field label="Telefone">
              <Input value={form.phone} onChange={(v) => set("phone", v)} required />
            </Field>
          </Row>
          <Row>
            <Field label="WhatsApp">
              <Input value={form.whatsapp} onChange={(v) => set("whatsapp", v)} required />
            </Field>
            <Field label="Endereço">
              <Input value={form.address} onChange={(v) => set("address", v)} />
            </Field>
          </Row>
          <Row>
            <Field label="Cidade">
              <Input value={form.city} onChange={(v) => set("city", v)} required />
            </Field>
            <Field label="UF">
              <Select value={form.uf} onChange={(v) => set("uf", v)} required>
                <option value="">—</option>
                {UF_LIST.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </Select>
            </Field>
          </Row>
          <Field label="Descrição da loja">
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-zinc-300 focus:border-black outline-none"
            />
          </Field>

          <div className="pt-3 border-t border-zinc-100">
            <button
              data-testid={DPANEL.profileSubmit}
              type="submit"
              disabled={saving}
              className="bg-black hover:bg-zinc-800 text-white px-8 h-12 font-bold uppercase tracking-tight text-sm disabled:opacity-60"
            >
              {saving ? "Salvando…" : "Salvar alterações"}
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-6">
        <ImageBox
          title="Logo"
          path={user.logo_path}
          uploading={logoUploading}
          onUpload={(f) => uploadImage("logo", f)}
          testid={DPANEL.profileLogoUpload}
          aspect="aspect-square"
        />
        <ImageBox
          title="Capa"
          path={user.cover_path}
          uploading={coverUploading}
          onUpload={(f) => uploadImage("cover", f)}
          testid={DPANEL.profileCoverUpload}
          aspect="aspect-[16/9]"
        />
      </div>
    </div>
  );
}

function ImageBox({ title, path, uploading, onUpload, testid, aspect }) {
  return (
    <div className="bg-white border border-zinc-200 p-5">
      <div className="text-xs uppercase tracking-widest font-bold text-zinc-700">{title}</div>
      <div className={`mt-3 ${aspect} bg-zinc-100 overflow-hidden`}>
        {path ? (
          <img src={fileUrl(path)} alt={title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-items-center text-zinc-400"><ImageIcon size={28} /></div>
        )}
      </div>
      <label className="mt-3 inline-flex items-center justify-center w-full h-10 border border-zinc-300 hover:border-black cursor-pointer text-xs font-bold uppercase tracking-tight gap-2">
        <Upload size={14} />
        {uploading ? "Enviando…" : `Trocar ${title.toLowerCase()}`}
        <input
          data-testid={testid}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
        />
      </label>
    </div>
  );
}

function PlanTab({ user }) {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="bg-white border border-zinc-200 p-8">
        <div className="text-xs uppercase tracking-widest font-bold text-zinc-500">Plano atual</div>
        <div className="mt-3 text-4xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>
          {user.plan_name}
        </div>
        <div className="mt-1 text-zinc-600">Valor mensal: <span className="font-bold text-black">{brl(user.plan_price)}</span></div>
        <div className="mt-1 text-zinc-600">Limite: <span className="font-bold text-black">{user.plan_ad_limit} anúncio(s)</span></div>
        <div className="mt-1 text-zinc-600">Pagamento: <span className="font-bold text-black">PIX</span></div>
        <div className="mt-4">
          <Badge status={user.status} />
        </div>
      </div>
      <div className="bg-black text-white p-8">
        <div className="text-xs uppercase tracking-widest font-bold text-zinc-400">Precisa mudar de plano?</div>
        <p className="mt-3 text-zinc-300 leading-relaxed">
          Para upgrade ou downgrade, fale com o administrador. A alteração é feita manualmente
          após confirmação do pagamento via PIX.
        </p>
        <a
          href="mailto:admin@stockauto.com"
          className="mt-6 inline-flex items-center gap-2 bg-[#FF3B30] hover:bg-[#E13128] text-white px-6 h-12 font-bold uppercase tracking-tight text-sm"
        >
          Falar com admin
        </a>
      </div>
    </div>
  );
}

function ConfirmModal({ title, body, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4">
      <div className="bg-white max-w-md w-full p-6" data-testid="confirm-modal">
        <div className="text-xl font-black tracking-tighter">{title}</div>
        <div className="mt-2 text-sm text-zinc-600">{body}</div>
        <div className="mt-6 flex gap-3">
          <button onClick={onCancel} className="flex-1 h-11 border border-zinc-300 font-bold uppercase tracking-tight text-sm">Cancelar</button>
          <button onClick={onConfirm} className="flex-1 h-11 bg-[#FF3B30] hover:bg-[#E13128] text-white font-bold uppercase tracking-tight text-sm">Excluir</button>
        </div>
      </div>
    </div>
  );
}

function Row({ children }) {
  return <div className="grid sm:grid-cols-2 gap-4">{children}</div>;
}
function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-widest text-zinc-700">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
function Input({ value, onChange, required, type = "text" }) {
  return (
    <input
      type={type}
      required={required}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-12 px-4 border border-zinc-300 focus:border-black outline-none bg-white"
    />
  );
}
function Select({ value, onChange, required, children }) {
  return (
    <select
      required={required}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-12 px-4 border border-zinc-300 focus:border-black outline-none bg-white"
    >
      {children}
    </select>
  );
}
