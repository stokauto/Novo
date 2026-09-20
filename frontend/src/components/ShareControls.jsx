import { useState } from "react";
import { Share2, Copy, Check, MessageCircle, Facebook } from "lucide-react";

/**
 * Reusable share control — supports the native mobile share sheet when
 * available (`navigator.share`) with a graceful desktop fallback to
 * WhatsApp / Facebook / Copy link.
 *
 * Uses the CURRENT page URL by default, so a share done from a white-label
 * page keeps the tenant subdomain intact.
 *
 * Props:
 *   title (string)        — text used in navigator.share and prefixed in WA
 *   text  (string)        — extra text used for WA / Facebook quotes
 *   url   (string)        — override the URL (defaults to window.location.href)
 *   testid (string)       — data-testid prefix for the buttons
 *   compact (boolean)     — when true, renders a single icon-only "Compartilhar"
 *                           button that opens native share OR toggles the fallback
 *                           menu. Default: false → shows the 2-button row we use
 *                           in the sidebars (Compartilhar + Copiar link).
 */
export default function ShareControls({
  title = "",
  text = "",
  url,
  testid = "share",
  compact = false,
}) {
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const currentUrl = () => url || (typeof window !== "undefined" ? window.location.href : "");
  const supportsShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const doNativeShare = async () => {
    const shareUrl = currentUrl();
    try {
      await navigator.share({
        title: title || document.title,
        text: text || title || "",
        url: shareUrl,
      });
    } catch (_) {
      // User cancelled or share failed — silently ignore (native sheet already handled it).
    }
  };

  const doCopy = async () => {
    const shareUrl = currentUrl();
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (_) {
      // Legacy fallback for very old browsers
      try {
        const ta = document.createElement("textarea");
        ta.value = shareUrl;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      } catch (_) { /* noop */ }
    }
  };

  const waHref = () => {
    const shareUrl = currentUrl();
    const msg = [title, text, shareUrl].filter(Boolean).join(" — ");
    return `https://wa.me/?text=${encodeURIComponent(msg)}`;
  };

  const fbHref = () => {
    const shareUrl = currentUrl();
    return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
  };

  const primaryClick = () => {
    if (supportsShare) doNativeShare();
    else setMenuOpen((v) => !v);
  };

  if (!compact) {
    // Two-button row (used in the sidebars of the detail pages).
    return (
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={primaryClick}
          data-testid={`${testid}-primary`}
          className="flex-1 inline-flex items-center justify-center gap-2 border border-zinc-300 h-11 text-xs font-bold uppercase tracking-tight hover:border-black"
        >
          <Share2 size={14} /> Compartilhar
        </button>
        <button
          type="button"
          onClick={doCopy}
          data-testid={`${testid}-copy`}
          className="flex-1 inline-flex items-center justify-center gap-2 border border-zinc-300 h-11 text-xs font-bold uppercase tracking-tight hover:border-black"
        >
          {copied ? <><Check size={14} /> Link copiado</> : <><Copy size={14} /> Copiar link</>}
        </button>

        {menuOpen && !supportsShare && (
          <FallbackMenu
            testid={testid}
            waHref={waHref()}
            fbHref={fbHref()}
            onClose={() => setMenuOpen(false)}
          />
        )}
      </div>
    );
  }

  // Compact single-button (used in headers/heroes when space is tight).
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={primaryClick}
        data-testid={`${testid}-primary`}
        className="inline-flex items-center gap-2 border border-zinc-300 hover:border-black h-10 px-3 text-xs font-bold uppercase tracking-tight"
        aria-label="Compartilhar"
      >
        <Share2 size={14} /> Compartilhar
      </button>
      {menuOpen && !supportsShare && (
        <FallbackMenu
          testid={testid}
          waHref={waHref()}
          fbHref={fbHref()}
          onCopy={doCopy}
          copied={copied}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </div>
  );
}

function FallbackMenu({ testid, waHref, fbHref, onCopy, copied, onClose }) {
  return (
    <div
      className="absolute right-0 mt-2 z-40 bg-white border border-zinc-200 shadow-lg min-w-[220px] p-2"
      data-testid={`${testid}-menu`}
      role="menu"
    >
      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClose}
        data-testid={`${testid}-whatsapp`}
        className="flex items-center gap-2 px-3 h-10 text-sm font-bold uppercase tracking-tight hover:bg-zinc-100"
      >
        <MessageCircle size={14} className="text-emerald-600" /> Compartilhar no WhatsApp
      </a>
      <a
        href={fbHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClose}
        data-testid={`${testid}-facebook`}
        className="flex items-center gap-2 px-3 h-10 text-sm font-bold uppercase tracking-tight hover:bg-zinc-100"
      >
        <Facebook size={14} className="text-[#1877F2]" /> Compartilhar no Facebook
      </a>
      {onCopy && (
        <button
          type="button"
          onClick={() => { onCopy(); }}
          data-testid={`${testid}-copy`}
          className="w-full flex items-center gap-2 px-3 h-10 text-sm font-bold uppercase tracking-tight hover:bg-zinc-100"
        >
          {copied ? <><Check size={14} /> Link copiado</> : <><Copy size={14} /> Copiar link</>}
        </button>
      )}
    </div>
  );
}
