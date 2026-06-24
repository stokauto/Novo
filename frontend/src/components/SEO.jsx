import { Helmet } from "react-helmet-async";

const SITE_URL = "https://stockauto.com.br";
const DEFAULT_OG = `${SITE_URL}/og-default.jpg`;

/**
 * SEO component — wraps react-helmet-async with sensible Brazilian/local defaults.
 * Pass any of: title, description, canonical (relative path or absolute URL),
 * image, type (og:type), keywords, jsonLd (object or array of objects).
 */
export default function SEO({
  title,
  description,
  canonical,
  image,
  type = "website",
  keywords,
  jsonLd,
  noindex = false,
}) {
  const fullTitle = title
    ? title.includes("StockAuto")
      ? title
      : `${title} | StockAuto`
    : "StockAuto — Veículos em Campo Grande, MS";
  const desc =
    description ||
    "Marketplace de veículos em Campo Grande, MS. Compre direto do revendedor: carros, motos, camionetes e mais. Contato via WhatsApp.";
  const url = canonical
    ? canonical.startsWith("http")
      ? canonical
      : `${SITE_URL}${canonical.startsWith("/") ? "" : "/"}${canonical}`
    : SITE_URL;
  const img = image || DEFAULT_OG;

  const ldArray = jsonLd
    ? Array.isArray(jsonLd)
      ? jsonLd
      : [jsonLd]
    : [];

  return (
    <Helmet prioritizeSeoTags>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      {keywords && <meta name="keywords" content={keywords} />}
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      <link rel="canonical" href={url} />

      <meta property="og:type" content={type} />
      <meta property="og:site_name" content="StockAuto" />
      <meta property="og:locale" content="pt_BR" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={img} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={img} />

      {ldArray.map((obj, i) => (
        // JSON-LD scripts have no stable identifier; index key is acceptable
        // because the list is recomputed only when jsonLd input changes.
        // eslint-disable-next-line react/no-array-index-key
        <script key={`ld-${i}`} type="application/ld+json">
          {JSON.stringify(obj)}
        </script>
      ))}
    </Helmet>
  );
}

export { SITE_URL };
