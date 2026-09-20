import { Image as ImageIcon, Info } from "lucide-react";

/**
 * ImageHelperText — small, responsive helper block that renders next to
 * any image upload field in the admin panel.
 *
 * Purpose: help admins understand exactly which image to upload for each
 * placement (logo, cover, favicon, vehicle photos, banners). Rendered as
 * a compact zinc-50 block with badges for format + dimension so it never
 * shouts over the form and works well inside modals on desktop and
 * mobile.
 *
 * Props:
 *  - formats: string[]  e.g. ["PNG", "WEBP"] — shown as small badges
 *  - dimensions: string e.g. "800 × 800 px" or "1920 × 600 px"
 *  - aspectHint: string e.g. "quadrada" or "horizontal 16:9"
 *  - sizeLimit: string  e.g. "máx 3 MB" — echoes the ACTUAL backend limit
 *  - tips: string[]     one-line tips (transparent bg, safe area, etc.)
 *  - testid: string     data-testid for tests
 *
 * The helper is purely informational — it does NOT block or filter
 * uploads. Backend/frontend validation stays unchanged.
 */
export default function ImageHelperText({
  formats = [],
  dimensions,
  aspectHint,
  sizeLimit,
  tips = [],
  testid,
}) {
  return (
    <div
      data-testid={testid}
      className="mt-2 border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-[11px] leading-relaxed text-zinc-700 space-y-1.5"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <ImageIcon size={12} className="text-zinc-500" />
        <span className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-500">
          Recomendação
        </span>
        {formats.length > 0 && (
          <span className="ml-1 flex flex-wrap gap-1">
            {formats.map((f) => (
              <span
                key={f}
                className="inline-block bg-white border border-zinc-300 px-1.5 py-0.5 text-[10px] font-bold tracking-tight"
              >
                {f}
              </span>
            ))}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        {dimensions && (
          <span>
            <strong className="text-zinc-900">Tamanho:</strong> {dimensions}
          </span>
        )}
        {aspectHint && (
          <span>
            <strong className="text-zinc-900">Proporção:</strong> {aspectHint}
          </span>
        )}
        {sizeLimit && (
          <span>
            <strong className="text-zinc-900">Limite:</strong> {sizeLimit}
          </span>
        )}
      </div>
      {tips.length > 0 && (
        <ul className="pt-0.5 space-y-0.5">
          {tips.map((t, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <li key={i} className="flex items-start gap-1.5 text-zinc-600">
              <Info size={10} className="mt-1 flex-shrink-0 text-zinc-400" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
