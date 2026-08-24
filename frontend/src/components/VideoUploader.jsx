import { useRef, useState } from "react";
import { Video, X, Loader2, Upload } from "lucide-react";
import api, { fileUrl } from "@/lib/api";

const MAX_MB = 50;
const ACCEPT = "video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm,.m4v";

/**
 * Optional single-video uploader (mp4/mov/webm, up to 50 MB).
 * Props:
 *   value: string | null   storage path
 *   onChange: (path: string | null) => void
 */
export default function VideoUploader({ value, onChange, testid = "video-uploader" }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const pick = () => inputRef.current?.click();

  const handleFile = async (file) => {
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Vídeo muito grande. Máximo ${MAX_MB} MB.`);
      return;
    }
    setError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/dealer/upload-video", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        // No progress UI for MVP — 50MB tops. Extend later if needed.
      });
      if (data?.path) onChange(data.path);
    } catch (err) {
      setError(err?.response?.data?.detail || "Falha ao enviar vídeo.");
    } finally {
      setUploading(false);
    }
  };

  const remove = () => onChange("");

  if (value) {
    return (
      <div data-testid={testid} className="space-y-2">
        <div className="relative bg-black overflow-hidden border-2 border-zinc-200">
          <video
            src={fileUrl(value)}
            controls
            preload="metadata"
            className="w-full max-h-[280px] object-contain bg-black"
            data-testid={`${testid}-preview`}
          />
          <button
            type="button"
            onClick={remove}
            data-testid={`${testid}-remove`}
            className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm p-1.5 hover:bg-[#FF3B30] hover:text-white transition-colors"
            aria-label="Remover vídeo"
          >
            <X size={14} />
          </button>
          <div className="absolute top-2 left-2 bg-black/80 text-white text-[10px] font-black uppercase tracking-wider px-2 py-1 flex items-center gap-1">
            <Video size={10} /> Vídeo
          </div>
        </div>
        <button
          type="button"
          onClick={pick}
          className="text-xs font-bold uppercase tracking-tight border-b border-zinc-400 hover:border-black"
        >
          Trocar vídeo
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
          data-testid={`${testid}-input`}
        />
      </div>
    );
  }

  return (
    <div data-testid={testid} className="space-y-3">
      <div
        onClick={pick}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer?.files?.length) handleFile(e.dataTransfer.files[0]);
        }}
        className="border-2 border-dashed border-zinc-300 hover:border-black bg-zinc-50 hover:bg-white transition-colors cursor-pointer p-8 text-center"
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
          data-testid={`${testid}-input`}
        />
        <div className="inline-flex items-center justify-center w-12 h-12 bg-black text-white">
          {uploading ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
        </div>
        <div className="mt-4 font-bold uppercase tracking-tight text-sm">
          {uploading ? "Enviando vídeo…" : "Arraste 1 vídeo ou clique para enviar"}
        </div>
        <div className="mt-1 text-xs text-zinc-500">
          Opcional · MP4, MOV ou WEBM · Máx {MAX_MB} MB
        </div>
      </div>

      {error && (
        <div className="border-l-4 border-[#FF3B30] bg-red-50 text-red-700 text-sm px-4 py-2">
          {error}
        </div>
      )}
    </div>
  );
}
