import { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { DPANEL } from "@/constants/testIds";
import { UF_LIST } from "@/lib/format";
import PhotoUploader from "@/components/PhotoUploader";
import VideoUploader from "@/components/VideoUploader";
import { X, AlertCircle, CheckCircle2, Flame } from "lucide-react";

const empty = {
  category: "carro",
  brand: "",
  model: "",
  version: "",
  year_made: new Date().getFullYear(),
  year_model: new Date().getFullYear(),
  km: "",
  transmission: "",
  fuel: "",
  color: "",
  city: "",
  uf: "",
  price: "",
  description: "",
  photos: [],
  video: "",
  ad_type: "public",
  fipe_price: "",
  offer_price: "",
};

export default function VehicleForm({ initial, onClose, onSaved }) {
  const isEdit = !!initial?.id;
  const { user } = useAuth();
  const [data, setData] = useState({ ...empty, ...(initial || {}) });
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null); // { kind: "error"|"success", text }
  const formRef = useRef(null);
  const errorRef = useRef(null);

  const offerLimit = Number(user?.plan_offer_limit ?? 0);
  const canSetOffer = offerLimit > 0 && data.ad_type !== "repasse";

  useEffect(() => {
    api.get("/categories").then(({ data }) => setCategories(data)).catch(() => {});
  }, []);

  // Auto-dismiss toast after 6s
  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
  }, [toast]);

  const set = (k, v) => setData((d) => ({ ...d, [k]: v }));

  const showError = (msg) => {
    setError(msg);
    setToast({ kind: "error", text: msg });
    // Scroll the modal back to the top so the user sees the sticky error
    requestAnimationFrame(() => {
      if (errorRef.current && errorRef.current.scrollIntoView) {
        errorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (formRef.current) {
        formRef.current.scrollTop = 0;
      }
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setToast(null);

    // Client-side validation with friendly pt-BR messages so the browser's
    // native HTML5 tooltip ("Please fill out this field" in English) doesn't
    // cause silent submission failures on mobile.
    const missing = [];
    if (!data.brand?.trim()) missing.push("Marca");
    if (!data.model?.trim()) missing.push("Modelo");
    if (!data.year_made) missing.push("Ano fabricação");
    if (!data.year_model) missing.push("Ano modelo");
    if (!data.city?.trim()) missing.push("Cidade");
    if (!data.uf?.trim()) missing.push("UF");
    if (data.ad_type === "repasse") {
      const fp = Number(data.fipe_price);
      const op = Number(data.price);
      if (!fp || fp <= 0) missing.push("Valor Tabela FIPE");
      if (!op || op <= 0) missing.push("Valor de Oferta");
    }
    if (missing.length) {
      showError(`Preencha os campos obrigatórios: ${missing.join(", ")}.`);
      return;
    }

    setSaving(true);
    try {
      const toInt = (v) => {
        if (v === "" || v == null) return null;
        const n = parseInt(String(v).replace(/[^0-9-]/g, ""), 10);
        return Number.isFinite(n) ? n : null;
      };
      const toFloat = (v) => {
        if (v === "" || v == null) return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };
      const payload = {
        ...data,
        year_made: toInt(data.year_made),
        year_model: toInt(data.year_model),
        km: toInt(data.km),
        price: toFloat(data.price),
        fipe_price: toFloat(data.fipe_price),
        offer_price: toFloat(data.offer_price),
        ad_type: data.ad_type === "repasse" ? "repasse" : "public",
        uf: (data.uf || "").toUpperCase(),
      };
      let res;
      if (isEdit) {
        res = await api.put(`/dealer/vehicles/${initial.id}`, payload);
      } else {
        res = await api.post("/dealer/vehicles", payload);
      }
      onSaved?.(res.data);
      onClose?.();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      // FastAPI 422 returns an array of objects — flatten it to a string
      let msg;
      if (typeof detail === "string") {
        msg = detail;
      } else if (Array.isArray(detail)) {
        msg = detail.map((d) => d?.msg || JSON.stringify(d)).join(" • ");
      } else if (detail && typeof detail === "object") {
        msg = detail.msg || JSON.stringify(detail);
      } else {
        msg = "Erro ao salvar anúncio. Verifique sua conexão e tente novamente.";
      }
      showError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4">
      {/* Floating toast — visible from anywhere on the page */}
      {toast && (
        <div
          data-testid="vehicle-form-toast"
          className={`fixed top-5 left-1/2 -translate-x-1/2 z-[60] max-w-md w-[calc(100%-2rem)] px-5 py-3.5 shadow-2xl flex items-start gap-3 text-sm font-medium ${
            toast.kind === "error"
              ? "bg-[#FF3B30] text-white"
              : "bg-emerald-600 text-white"
          }`}
          role="alert"
        >
          {toast.kind === "error" ? (
            <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 size={20} className="flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">{toast.text}</div>
          <button
            onClick={() => setToast(null)}
            className="opacity-80 hover:opacity-100 -mr-1"
            aria-label="Fechar alerta"
          >
            <X size={18} />
          </button>
        </div>
      )}

      <div ref={formRef} className="bg-white max-w-4xl w-full" data-testid="vehicle-form-modal">
        <div className="sticky top-0 bg-white border-b border-zinc-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] font-bold text-zinc-500">
              {isEdit ? "Editar anúncio" : "Novo anúncio"}
            </div>
            <div className="text-2xl font-black tracking-tighter" style={{ fontFamily: "Cabinet Grotesk" }}>
              {isEdit ? `${data.brand} ${data.model}` : "Cadastrar veículo"}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100" aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        {/* Sticky error banner — pinned just below the header so it's always visible */}
        {error && (
          <div
            ref={errorRef}
            data-testid="vehicle-form-error"
            className="sticky top-[88px] z-10 bg-[#FF3B30] text-white text-sm font-bold px-6 py-3.5 flex items-start gap-2.5 shadow-md"
            role="alert"
          >
            <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{error}</div>
            <button
              onClick={() => setError("")}
              className="opacity-80 hover:opacity-100 -mr-1"
              aria-label="Fechar erro"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <form onSubmit={submit} className="p-6 space-y-6" noValidate>
          {/* Ad type toggle: Public vs Repasse B2B */}
          <div>
            <div className="text-xs uppercase tracking-widest font-bold text-zinc-700 mb-2">
              Tipo de anúncio
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                data-testid="vehicle-form-adtype-public"
                onClick={() => set("ad_type", "public")}
                className={`text-left p-4 border-2 transition-colors ${
                  data.ad_type !== "repasse"
                    ? "border-black bg-zinc-50"
                    : "border-zinc-200 hover:border-zinc-400"
                }`}
              >
                <div className="text-[10px] uppercase tracking-widest font-bold text-zinc-500">
                  Padrão
                </div>
                <div className="mt-1 font-black tracking-tight" style={{ fontFamily: "Cabinet Grotesk" }}>
                  Classificado Público
                </div>
                <div className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  Aparece na home, busca pública e Google. Vende para o consumidor final.
                </div>
              </button>
              <button
                type="button"
                data-testid="vehicle-form-adtype-repasse"
                onClick={() => set("ad_type", "repasse")}
                className={`text-left p-4 border-2 transition-colors ${
                  data.ad_type === "repasse"
                    ? "border-[#F5A623] bg-[#FFF8EC]"
                    : "border-zinc-200 hover:border-zinc-400"
                }`}
              >
                <div className="text-[10px] uppercase tracking-widest font-bold text-[#8A5F0D]">
                  B2B
                </div>
                <div className="mt-1 font-black tracking-tight" style={{ fontFamily: "Cabinet Grotesk" }}>
                  Repasse entre Lojistas
                </div>
                <div className="text-xs text-zinc-500 mt-1 leading-relaxed">
                  Visível apenas no Hub. Não aparece publicamente. Vende para outras revendas.
                </div>
              </button>
            </div>
          </div>

          <div>
            <div className="text-xs uppercase tracking-widest font-bold text-zinc-700 mb-2">Fotos</div>
            <PhotoUploader
              testid={DPANEL.vehicleFormPhotos}
              value={data.photos || []}
              onChange={(photos) => set("photos", photos)}
            />
          </div>

          <div>
            <div className="text-xs uppercase tracking-widest font-bold text-zinc-700 mb-2">
              Vídeo <span className="text-zinc-400 font-normal normal-case tracking-normal">(opcional)</span>
            </div>
            <VideoUploader
              testid="vehicle-form-video"
              value={data.video || ""}
              onChange={(v) => set("video", v)}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Categoria">
              <select
                data-testid={DPANEL.vehicleFormCategory}
                required
                value={data.category}
                onChange={(e) => set("category", e.target.value)}
                className="w-full h-12 px-4 border border-zinc-300 focus:border-black outline-none bg-white"
              >
                {categories.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Marca">
              <Input testid={DPANEL.vehicleFormBrand} required value={data.brand} onChange={(v) => set("brand", v)} />
            </Field>
            <Field label="Modelo">
              <Input testid={DPANEL.vehicleFormModel} required value={data.model} onChange={(v) => set("model", v)} />
            </Field>
            <Field label="Versão">
              <Input testid={DPANEL.vehicleFormVersion} value={data.version} onChange={(v) => set("version", v)} />
            </Field>
            <Field label="Ano fabricação">
              <Input testid={DPANEL.vehicleFormYearMade} type="number" required value={data.year_made} onChange={(v) => set("year_made", v)} />
            </Field>
            <Field label="Ano modelo">
              <Input testid={DPANEL.vehicleFormYearModel} type="number" required value={data.year_model} onChange={(v) => set("year_model", v)} />
            </Field>
            <Field label="Quilometragem">
              <Input testid={DPANEL.vehicleFormKm} type="number" value={data.km} onChange={(v) => set("km", v)} />
            </Field>
            <Field label="Câmbio">
              <select
                data-testid={DPANEL.vehicleFormTransmission}
                value={data.transmission}
                onChange={(e) => set("transmission", e.target.value)}
                className="w-full h-12 px-4 border border-zinc-300 focus:border-black outline-none bg-white"
              >
                <option value="">—</option>
                <option value="manual">Manual</option>
                <option value="automatico">Automático</option>
                <option value="automatizado">Automatizado</option>
                <option value="cvt">CVT</option>
              </select>
            </Field>
            <Field label="Combustível">
              <select
                data-testid={DPANEL.vehicleFormFuel}
                value={data.fuel}
                onChange={(e) => set("fuel", e.target.value)}
                className="w-full h-12 px-4 border border-zinc-300 focus:border-black outline-none bg-white"
              >
                <option value="">—</option>
                <option value="flex">Flex</option>
                <option value="gasolina">Gasolina</option>
                <option value="alcool">Álcool</option>
                <option value="diesel">Diesel</option>
                <option value="gnv">GNV</option>
                <option value="eletrico">Elétrico</option>
                <option value="hibrido">Híbrido</option>
              </select>
            </Field>
            <Field label="Cor">
              <Input testid={DPANEL.vehicleFormColor} value={data.color} onChange={(v) => set("color", v)} />
            </Field>
            <Field label="Cidade">
              <Input testid={DPANEL.vehicleFormCity} required value={data.city} onChange={(v) => set("city", v)} />
            </Field>
            <Field label="UF">
              <select
                data-testid={DPANEL.vehicleFormUf}
                required
                value={data.uf}
                onChange={(e) => set("uf", e.target.value)}
                className="w-full h-12 px-4 border border-zinc-300 focus:border-black outline-none bg-white"
              >
                <option value="">—</option>
                {UF_LIST.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </Field>
            <Field label={data.ad_type === "repasse" ? "Valor de Repasse/Oferta — obrigatório" : "Preço — vazio = Consultar Valor"}>
              <CurrencyInput testid={DPANEL.vehicleFormPrice} value={data.price} onChange={(v) => set("price", v)} />
            </Field>
            {data.ad_type === "repasse" && (
              <Field label="Valor Tabela FIPE — obrigatório">
                <CurrencyInput
                  testid="vehicle-form-fipe-price"
                  value={data.fipe_price}
                  onChange={(v) => set("fipe_price", v)}
                />
              </Field>
            )}
            {canSetOffer && (
              <Field
                label={
                  <span className="inline-flex items-center gap-1.5">
                    <Flame size={12} className="text-[#FF3B30]" />
                    Valor da Oferta (vira destaque &quot;OFERTA&quot;)
                  </span>
                }
              >
                <CurrencyInput
                  testid="vehicle-form-offer-price"
                  value={data.offer_price}
                  onChange={(v) => set("offer_price", v)}
                />
                <div className="text-[11px] text-zinc-500 mt-1">
                  Deixe vazio para anúncio normal. Seu plano permite até <strong>{offerLimit}</strong>{" "}
                  oferta{offerLimit > 1 ? "s" : ""} em destaque.
                </div>
              </Field>
            )}
          </div>

          <Field label="Descrição">
            <textarea
              data-testid={DPANEL.vehicleFormDescription}
              value={data.description || ""}
              onChange={(e) => set("description", e.target.value)}
              rows={5}
              className="w-full px-4 py-3 border border-zinc-300 focus:border-black outline-none"
              placeholder="Detalhes do veículo, opcionais, histórico…"
            />
          </Field>

          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-zinc-200">
            <button
              type="button"
              data-testid={DPANEL.vehicleFormCancel}
              onClick={onClose}
              className="flex-1 h-12 border border-zinc-300 hover:border-black font-bold uppercase tracking-tight"
            >
              Cancelar
            </button>
            <button
              type="submit"
              data-testid={DPANEL.vehicleFormSubmit}
              disabled={saving}
              className="flex-1 h-12 bg-[#FF3B30] hover:bg-[#E13128] disabled:opacity-60 text-white font-bold uppercase tracking-tight"
            >
              {saving ? "Salvando…" : (isEdit ? "Atualizar" : "Publicar anúncio")}
            </button>
          </div>
          <div className="text-xs text-zinc-500">
            Após salvar, o anúncio fica como <span className="font-bold">pendente</span> até a moderação do ADM Master.
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-widest text-zinc-700">{label}</label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Input({ testid, value, onChange, type = "text", required = false, step }) {
  return (
    <input
      data-testid={testid}
      type={type}
      step={step}
      required={required}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-12 px-4 border border-zinc-300 focus:border-black outline-none bg-white"
    />
  );
}

// BRL currency input with R$ 0.000,00 mask. Stores a numeric value (or "" => Consultar Valor).
function CurrencyInput({ testid, value, onChange }) {
  const display =
    value === "" || value === null || value === undefined
      ? ""
      : Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handle = (e) => {
    const onlyDigits = e.target.value.replace(/\D+/g, "");
    if (!onlyDigits) {
      onChange("");
      return;
    }
    onChange(Number(onlyDigits) / 100);
  };

  return (
    <div className="flex items-center h-12 border border-zinc-300 focus-within:border-black bg-white">
      <span className="px-3 text-zinc-500 font-bold select-none">R$</span>
      <input
        data-testid={testid}
        inputMode="numeric"
        value={display}
        onChange={handle}
        placeholder="0,00 (vazio = Consultar Valor)"
        className="flex-1 h-full pr-4 outline-none bg-transparent"
      />
    </div>
  );
}
