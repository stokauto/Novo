import { useEffect, useRef, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { fileUrl } from "@/lib/api";
import { HOMEPAGE } from "@/constants/testIds";

/**
 * BannerCarousel
 * - Props: items[] (each: { id, image_desktop_path, image_mobile_path, link_url, alt })
 * - Desktop aspect ratio: 1920×500 (~3.84:1)
 * - Mobile aspect ratio: 1080×1080 (1:1)
 * - Autoplay 5s, pause on hover, arrows + dots, click opens link in new tab.
 * - If no items: renders nothing (Home will hide it gracefully).
 */
export default function BannerCarousel({ items }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef(null);
  const n = items?.length || 0;

  const go = useCallback((idx) => setI(((idx % n) + n) % n), [n]);
  const next = useCallback(() => go(i + 1), [go, i]);
  const prev = useCallback(() => go(i - 1), [go, i]);

  useEffect(() => {
    if (n <= 1 || paused) return;
    timer.current = setTimeout(() => setI((p) => (p + 1) % n), 5000);
    return () => clearTimeout(timer.current);
  }, [i, paused, n]);

  if (!n) return null;

  return (
    <section
      data-testid={HOMEPAGE.bannerCarousel}
      className="relative w-full bg-black overflow-hidden group select-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Banners promocionais"
    >
      {/* Slides — sizing wraps to chosen aspect ratios */}
      <div
        className="relative w-full"
        style={{ aspectRatio: "1920 / 500" }}
      >
        {/* Mobile override aspect ratio */}
        <style>{`
          @media (max-width: 767px) {
            [data-testid="${HOMEPAGE.bannerCarousel}"] > div:first-child {
              aspect-ratio: 1 / 1 !important;
            }
          }
        `}</style>

        {items.map((b, idx) => {
          const isActive = idx === i;
          const desktop = fileUrl(b.image_desktop_path);
          const mobile = fileUrl(b.image_mobile_path || b.image_desktop_path);
          return (
            <a
              key={b.id}
              data-testid={HOMEPAGE.bannerSlide(idx)}
              href={b.link_url || "#"}
              target={b.link_url ? "_blank" : "_self"}
              rel="noopener noreferrer"
              aria-label={b.alt || `Banner ${idx + 1}`}
              aria-hidden={!isActive}
              tabIndex={isActive ? 0 : -1}
              className={`absolute inset-0 transition-opacity duration-700 ease-out ${
                isActive ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
              }`}
            >
              <picture>
                <source media="(min-width: 768px)" srcSet={desktop} />
                <img
                  src={mobile}
                  alt={b.alt || ""}
                  className="w-full h-full object-cover"
                  loading={idx === 0 ? "eager" : "lazy"}
                  draggable="false"
                />
              </picture>
            </a>
          );
        })}
      </div>

      {/* Arrows */}
      {n > 1 && (
        <>
          <button
            data-testid={HOMEPAGE.bannerPrev}
            onClick={prev}
            aria-label="Banner anterior"
            className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-20 grid place-items-center w-11 h-11 sm:w-12 sm:h-12 bg-black/40 hover:bg-black/70 text-white backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            data-testid={HOMEPAGE.bannerNext}
            onClick={next}
            aria-label="Próximo banner"
            className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-20 grid place-items-center w-11 h-11 sm:w-12 sm:h-12 bg-black/40 hover:bg-black/70 text-white backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white"
          >
            <ChevronRight size={22} />
          </button>
        </>
      )}

      {/* Dots */}
      {n > 1 && (
        <div className="absolute bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
          {items.map((_, idx) => (
            <button
              // Banner dots index is the position itself — stable for the lifetime of items array
              // eslint-disable-next-line react/no-array-index-key
              key={`dot-${idx}`}
              data-testid={HOMEPAGE.bannerDot(idx)}
              onClick={() => go(idx)}
              aria-label={`Ir para banner ${idx + 1}`}
              aria-current={idx === i ? "true" : "false"}
              className={`transition-all rounded-full ${
                idx === i
                  ? "bg-white w-8 h-2"
                  : "bg-white/50 hover:bg-white/80 w-2 h-2"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
