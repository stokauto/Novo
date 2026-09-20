import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api, { fileUrl } from "@/lib/api";
import {
  Plus, Pencil, ExternalLink, X, Check, Loader2, Store, Palette,
  Image as ImageIcon, Upload, Trash2,
} from "lucide-react";
import ImageHelperText from "./ImageHelperText";

/**
 * Admin panel section for managing white-label store sites.
 * Kept intentionally simple in this iteration: list + create + edit basic
 * config (subdomain, colors, about text, social) + toggle active.
 * Media uploads (logo/cover/favicon) are not part of this iteration — the
 * fields exist in the model but can be filled later via a dedicated flow.
 */
export default function StoreSitesTab() {
  const [items, setItems] = useState([]);
  const [dealers, setDealers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | { new: true } | site doc

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get("/admin/store-sites").then((r) => r.data),
      api.get("/admin/users").then((r) => r.data),
    ])
      .then(([sites, users]) => {
        setItems(sites);
        setDealers(
          users
            .filter((u) => u.role === "dealer" && u.status === "active")
            .sort((a, b) => (a.store_name || "").localeCompare(b.store_name || "")),
        );
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const dealerWithSite = useMemo(
    () => new Set(items.map((s) => s.dealer_id)),
    [items],
  );

  const toggle = async (site) => {
    // Ask for confirmation before deactivating (activation is safe and
    // doesn't need a prompt).
    if (site.site_active) {
      const ok = typeof window !== "undefined" && window.confirm(
        `Desativar o site "${site.subdomain}"?\n\n` +
        `A página /loja/${site.subdomain} deixará de abrir publicamente. ` +
        `A loja, os veículos, anúncios, usuários e fotos são preservados.\n\n` +
        `Você pode reativar o site depois neste mesmo painel.`,
      );
      if (!ok) return;
    }
    await api.patch(`/admin/store-sites/${site.dealer_id}/status`, {
      site_active: !site.site_active,
    });
    load();
  };

  const remove = async (site) => {
    const ok = typeof window !== "undefined" && window.confirm(
      `Excluir a configuração do site "${site.subdomain}"?\n\n` +
      `Isso removerá SOMENTE a configuração do site white-label. ` +
      `A loja, os veículos, anúncios, usuários e fotos NÃO serão apagados.\n\n` +
      `Depois de excluído, /loja/${site.subdomain} não abrirá mais. ` +
      `Você pode recriar o site no botão "Criar site" quando quiser.`,
    );
    if (!ok) return;
    try {
      await api.delete(`/admin/store-sites/${site.dealer_id}`);
      load();
    } catch (err) {
      alert(err?.response?.data?.detail || "Erro ao excluir o site.");
    }
  };

  // Public route used in production (path-based, no wildcard subdomain needed).
  // The plataform Emergent does NOT support wildcard subdomains, so the
  // preview and the shared URL are always this shape.
  const publicRoute = (sub) => {
    if (typeof window === "undefined") return `/loja/${sub}`;
    return `${window.location.origin}/loja/${sub}`;
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] font-bold text-zinc-500">Sites das lojas</div>
          <p className="text-sm text-zinc-600 mt-1 max-w-2xl">
            Cada lojista ativo pode ter um site próprio acessível em{" "}
            <code className="bg-zinc-100 px-1.5 py-0.5 text-xs">stockauto.com.br/loja/&lt;subdomínio&gt;</code>.
            Configure aqui o subdomínio e as cores. Uploads de logo, capa e favicon são feitos
            na edição do site.
          </p>
        </div>
        <button
          data-testid="apanel-storesite-new"
          onClick={() => setEditing({ new: true })}
          className="inline-flex items-center gap-2 bg-black text-white px-5 h-11 font-bold uppercase tracking-tight text-sm hover:opacity-90"
        >
          <Plus size={16} /> Criar site
        </button>
      </div>

      {loading ? (
        <div className="mt-8 text-zinc-500 inline-flex items-center gap-2">
          <Loader2 size={16} className="animate-spin" /> Carregando…
        </div>
      ) : items.length === 0 ? (
        <div className="mt-8 border-2 border-dashed border-zinc-300 py-16 text-center">
          <Store size={40} className="mx-auto text-zinc-300" />
          <p className="mt-3 text-zinc-500 text-sm">Nenhum site criado ainda.</p>
        </div>
      ) : (
        <div className="mt-6 border border-zinc-200 divide-y divide-zinc-200 bg-white">
          {items.map((s) => (
            <div key={s.id} data-testid={`apanel-storesite-row-${s.dealer_id}`} className="p-4 flex flex-col md:flex-row md:items-center gap-4 hover:bg-zinc-50">
              <div className="w-11 h-11 flex-shrink-0 flex items-center justify-center overflow-hidden border border-zinc-200"
                   style={{ backgroundColor: s.primary_color }}>
                <Store size={16} className="text-white/90" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold tracking-tight truncate">
                    {s.dealer?.store_name || s.dealer_id}
                  </span>
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 ${s.site_active ? "bg-emerald-100 text-emerald-800" : "bg-zinc-200 text-zinc-600"}`}>
                    {s.site_active ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  <code className="bg-zinc-100 px-1">/loja/{s.subdomain}</code>
                  {s.dealer && <span className="ml-2">· {s.dealer.city}/{s.dealer.uf}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <a
                  href={publicRoute(s.subdomain)}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid={`apanel-storesite-preview-${s.dealer_id}`}
                  className="inline-flex items-center gap-1 border border-zinc-300 hover:border-black px-3 h-9 text-xs font-bold uppercase tracking-tight"
                  title="Abrir /loja/{subdomain} em nova aba"
                >
                  <ExternalLink size={14} /> Prévia
                </a>
                <button
                  data-testid={`apanel-storesite-toggle-${s.dealer_id}`}
                  onClick={() => toggle(s)}
                  className={`px-3 h-9 text-xs font-bold uppercase tracking-tight border ${s.site_active ? "border-zinc-300 hover:border-[#FF3B30] hover:text-[#FF3B30]" : "border-zinc-300 hover:border-emerald-600 hover:text-emerald-600"}`}
                >
                  {s.site_active ? "Desativar" : "Ativar"}
                </button>
                <button
                  data-testid={`apanel-storesite-edit-${s.dealer_id}`}
                  onClick={() => setEditing(s)}
                  className="p-2.5 border border-zinc-300 hover:border-black"
                  aria-label="Editar site"
                >
                  <Pencil size={16} />
                </button>
                <button
                  data-testid={`apanel-storesite-delete-${s.dealer_id}`}
                  onClick={() => remove(s)}
                  className="p-2.5 border border-zinc-300 hover:border-[#FF3B30] hover:text-[#FF3B30]"
                  aria-label="Excluir configuração do site"
                  title="Excluir configuração do site (a loja, veículos e usuário são preservados)"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <StoreSiteFormModal
          site={editing.new ? null : editing}
          dealers={dealers}
          dealerWithSite={dealerWithSite}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function StoreSiteFormModal({ site, dealers, dealerWithSite, onClose, onSaved }) {
  const isEdit = !!site;
  const [form, setForm] = useState({
    dealer_id: site?.dealer_id || (dealers.find((d) => !dealerWithSite.has(d.id))?.id || ""),
    subdomain: site?.subdomain || "",
    site_active: site?.site_active ?? true,
    primary_color: site?.primary_color || "#111111",
    secondary_color: site?.secondary_color || "#FF3B30",
    button_color: site?.button_color || "#111111",
    about_text: site?.about_text || "",
    facebook_url: site?.facebook_url || "",
    instagram_url: site?.instagram_url || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.dealer_id) { setError("Selecione o revendedor."); return; }
    if (!form.subdomain.trim()) { setError("Informe o subdomínio."); return; }
    setSaving(true);
    try {
      if (isEdit) {
        // dealer_id não muda em edição
        const { dealer_id, ...rest } = form;
        await api.put(`/admin/store-sites/${site.dealer_id}`, rest);
      } else {
        await api.post("/admin/store-sites", form);
      }
      onSaved?.();
    } catch (err) {
      setError(err?.response?.data?.detail || "Erro ao salvar site.");
      setSaving(false);
    }
  };

  const availableDealers = isEdit
    ? dealers
    : dealers.filter((d) => !dealerWithSite.has(d.id));

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="bg-white max-w-2xl w-full" data-testid="apanel-storesite-modal">
        <div className="sticky top-0 bg-white border-b border-zinc-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] font-bold text-zinc-500">
              {isEdit ? "Editar site" : "Novo site"}
            </div>
            <div className="text-2xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>
              Sites das lojas
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-zinc-100" aria-label="Fechar"><X size={20} /></button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-5">
          {error && <div className="border-l-4 border-[#FF3B30] bg-red-50 text-red-700 text-sm px-4 py-2">{error}</div>}

          {isEdit && (
            <div className="border border-zinc-200 bg-zinc-50 p-4 space-y-4">
              <div className="text-[10px] uppercase tracking-[0.25em] font-black text-zinc-500">
                Identidade visual
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                <SiteAssetUploader
                  label="Logo"
                  hint="PNG, JPG ou WEBP · máx 3 MB"
                  accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                  currentPath={site?.logo_path}
                  aspectClass="aspect-square"
                  testid="apanel-storesite-upload-logo"
                  endpoint={`/admin/store-sites/${site?.dealer_id}/logo`}
                  helper={{
                    formats: ["PNG", "WEBP", "JPG"],
                    dimensions: "800 × 800 px (quadrado) ou 1200 × 400 px (horizontal curto)",
                    aspectHint: "quadrada ou horizontal curta",
                    sizeLimit: "máx 3 MB",
                    tips: [
                      "PNG/WEBP com fundo transparente é o ideal — evita bordas brancas sobre o cabeçalho colorido.",
                      "Envie na maior resolução possível dentro do limite; será redimensionado no cliente.",
                    ],
                  }}
                  onUploaded={(newSite) => {
                    // Update the local reference so previews refresh
                    if (site && newSite) {
                      site.logo_path = newSite.logo_path;
                      site.cover_path = newSite.cover_path;
                      site.favicon_path = newSite.favicon_path;
                    }
                  }}
                />
                <SiteAssetUploader
                  label="Capa"
                  hint="PNG, JPG ou WEBP · máx 5 MB · horizontal"
                  accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                  currentPath={site?.cover_path}
                  aspectClass="aspect-[16/9]"
                  testid="apanel-storesite-upload-cover"
                  endpoint={`/admin/store-sites/${site?.dealer_id}/cover`}
                  helper={{
                    formats: ["JPG", "WEBP"],
                    dimensions: "1920 × 600 px (desktop)",
                    aspectHint: "horizontal 16:9 — o mesmo arquivo é usado no celular e será recortado no centro",
                    sizeLimit: "máx 5 MB",
                    tips: [
                      "Como o mesmo arquivo é reaproveitado no mobile, mantenha logotipos e textos importantes no centro da imagem (safe area).",
                      "Se puder, exporte também uma versão 1080 × 1350 px e envie o retrato via edição de textos/composição externa antes do upload.",
                    ],
                  }}
                  onUploaded={(newSite) => {
                    if (site && newSite) {
                      site.logo_path = newSite.logo_path;
                      site.cover_path = newSite.cover_path;
                      site.favicon_path = newSite.favicon_path;
                    }
                  }}
                />
                <SiteAssetUploader
                  label="Favicon"
                  hint="ICO, PNG ou WEBP · máx 512 KB"
                  accept="image/png,image/webp,image/x-icon,image/vnd.microsoft.icon,.ico,.png,.webp"
                  currentPath={site?.favicon_path}
                  aspectClass="aspect-square"
                  testid="apanel-storesite-upload-favicon"
                  endpoint={`/admin/store-sites/${site?.dealer_id}/favicon`}
                  helper={{
                    formats: ["PNG", "WEBP", "ICO"],
                    dimensions: "512 × 512 px",
                    aspectHint: "quadrada",
                    sizeLimit: "máx 512 KB",
                    tips: [
                      "É o ícone que aparece na aba do navegador. Prefira uma marca simplificada, sem texto.",
                    ],
                  }}
                  onUploaded={(newSite) => {
                    if (site && newSite) {
                      site.logo_path = newSite.logo_path;
                      site.cover_path = newSite.cover_path;
                      site.favicon_path = newSite.favicon_path;
                    }
                  }}
                />
              </div>
            </div>
          )}

          <Field label="Revendedor">
            <select
              data-testid="apanel-storesite-form-dealer"
              value={form.dealer_id}
              disabled={isEdit}
              onChange={(e) => set("dealer_id", e.target.value)}
              className="w-full h-12 px-4 border border-zinc-300 focus:border-black outline-none bg-white disabled:bg-zinc-50 disabled:text-zinc-500"
            >
              {isEdit && (
                <option value={form.dealer_id}>
                  {(dealers.find((d) => d.id === form.dealer_id)?.store_name) || form.dealer_id}
                </option>
              )}
              {!isEdit && (
                <>
                  <option value="">— Selecione —</option>
                  {availableDealers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.store_name} · {d.city}/{d.uf}
                    </option>
                  ))}
                </>
              )}
            </select>
            {!isEdit && availableDealers.length === 0 && (
              <p className="text-xs text-amber-700 mt-1">
                Nenhum revendedor ativo sem site. Ative um lojista antes.
              </p>
            )}
          </Field>

          <Field
            label="Subdomínio"
            hint="Apenas letras minúsculas, números e hífen. Ex.: auto-silva. A loja fica acessível em stockauto.com.br/loja/<subdomínio>."
          >
            <div className="flex">
              <span className="inline-flex items-center px-3 h-12 bg-zinc-100 border border-r-0 border-zinc-300 text-sm text-zinc-600 font-mono">
                /loja/
              </span>
              <input
                data-testid="apanel-storesite-form-subdomain"
                value={form.subdomain}
                onChange={(e) => set("subdomain", e.target.value.toLowerCase())}
                maxLength={40}
                placeholder="auto-silva"
                className="w-full h-12 px-4 border border-zinc-300 focus:border-black outline-none bg-white lowercase"
              />
            </div>
          </Field>

          <div className="grid sm:grid-cols-3 gap-4">
            <ColorField label="Cor primária" value={form.primary_color} onChange={(v) => set("primary_color", v)} testid="apanel-storesite-form-primary" />
            <ColorField label="Cor secundária" value={form.secondary_color} onChange={(v) => set("secondary_color", v)} testid="apanel-storesite-form-secondary" />
            <ColorField label="Cor dos botões" value={form.button_color} onChange={(v) => set("button_color", v)} testid="apanel-storesite-form-button" />
          </div>

          <Field label="Texto sobre a loja">
            <textarea
              data-testid="apanel-storesite-form-about"
              value={form.about_text}
              onChange={(e) => set("about_text", e.target.value)}
              rows={3}
              maxLength={600}
              placeholder="Descrição curta que aparece na página inicial do site."
              className="w-full px-4 py-3 border border-zinc-300 focus:border-black outline-none"
            />
          </Field>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Instagram (URL)">
              <input
                data-testid="apanel-storesite-form-instagram"
                value={form.instagram_url}
                onChange={(e) => set("instagram_url", e.target.value)}
                placeholder="https://www.instagram.com/..."
                className="w-full h-12 px-4 border border-zinc-300 focus:border-black outline-none bg-white"
              />
            </Field>
            <Field label="Facebook (URL)">
              <input
                data-testid="apanel-storesite-form-facebook"
                value={form.facebook_url}
                onChange={(e) => set("facebook_url", e.target.value)}
                placeholder="https://www.facebook.com/..."
                className="w-full h-12 px-4 border border-zinc-300 focus:border-black outline-none bg-white"
              />
            </Field>
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none">
            <input
              data-testid="apanel-storesite-form-active"
              type="checkbox"
              checked={form.site_active}
              onChange={(e) => set("site_active", e.target.checked)}
              className="w-5 h-5 accent-black"
            />
            <span className="text-sm font-bold uppercase tracking-tight">
              Site ativo (visível em /loja/{form.subdomain || "<subdomínio>"})
            </span>
          </label>

          <div className="flex gap-3 pt-2 border-t border-zinc-200">
            <button type="button" onClick={onClose} className="flex-1 h-12 border border-zinc-300 hover:border-black font-bold uppercase tracking-tight">Cancelar</button>
            <button
              data-testid="apanel-storesite-form-submit"
              type="submit"
              disabled={saving}
              className="flex-1 h-12 bg-black text-white font-bold uppercase tracking-tight disabled:opacity-60 hover:opacity-90 inline-flex items-center justify-center gap-2"
            >
              {saving ? <><Loader2 size={16} className="animate-spin" /> Salvando…</> : <><Check size={16} /> {isEdit ? "Salvar" : "Criar site"}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-[0.25em] font-black text-zinc-500 mb-1.5 block">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-zinc-500 mt-1">{hint}</p>}
    </div>
  );
}

function ColorField({ label, value, onChange, testid }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-[0.25em] font-black text-zinc-500 mb-1.5 block flex items-center gap-1">
        <Palette size={11} /> {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          data-testid={testid}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-12 h-12 border border-zinc-300 cursor-pointer bg-white"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={9}
          className="flex-1 h-12 px-3 border border-zinc-300 focus:border-black outline-none font-mono text-sm bg-white"
        />
      </div>
    </div>
  );
}

function SiteAssetUploader({ label, hint, accept, currentPath, aspectClass,
                            testid, endpoint, onUploaded, helper }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(currentPath || null);
  const [success, setSuccess] = useState(false);

  const pick = () => inputRef.current?.click();

  const handleFile = async (file) => {
    if (!file) return;
    setError("");
    setSuccess(false);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post(endpoint, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (data?.path) {
        setPreview(data.path);
        setSuccess(true);
        onUploaded?.(data.site);
        // Auto-hide success indicator
        setTimeout(() => setSuccess(false), 2200);
      }
    } catch (err) {
      setError(err?.response?.data?.detail || "Falha ao enviar arquivo.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div data-testid={testid}>
      <div className="text-[10px] uppercase tracking-[0.25em] font-black text-zinc-500 mb-1.5 flex items-center gap-1">
        <ImageIcon size={11} /> {label}
      </div>
      <div
        className={`relative ${aspectClass} bg-white border-2 border-dashed border-zinc-300 hover:border-black transition-colors overflow-hidden group`}
      >
        {preview ? (
          <img src={fileUrl(preview)} alt={label} className="w-full h-full object-contain bg-zinc-50" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400 text-xs">
            <ImageIcon size={22} className="mb-1" />
            Sem imagem
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
            <Loader2 className="animate-spin" size={22} />
          </div>
        )}
        {success && !uploading && (
          <div className="absolute top-2 right-2 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest px-2 py-1 inline-flex items-center gap-1">
            <Check size={11} /> Enviado
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
        data-testid={`${testid}-input`}
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={pick}
          disabled={uploading}
          data-testid={`${testid}-pick`}
          className="inline-flex items-center gap-1.5 border border-zinc-300 hover:border-black px-3 h-8 text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
        >
          <Upload size={12} /> {preview ? "Trocar" : "Selecionar"}
        </button>
        <span className="text-[10px] text-zinc-500">{hint}</span>
      </div>
      {error && (
        <p className="mt-2 text-[10px] text-[#FF3B30] font-bold">{error}</p>
      )}
      {helper && (
        <ImageHelperText
          {...helper}
          testid={`${testid}-helper`}
        />
      )}
    </div>
  );
}
