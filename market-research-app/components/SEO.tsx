import Head from "next/head";
import { siteConfig } from "@/config/site";

interface SEOProps {
  title?: string;
  description?: string;
  /** Absolute URL to OG image (1200×630 recommended) */
  image?: string;
  /** Canonical URL for this page */
  url?: string;
  /** "website" | "article" — defaults to "website" */
  type?: string;
  noIndex?: boolean;
}

const DEFAULT_IMAGE = `${siteConfig.url}/og-image.png`;

export default function SEO({
  title,
  description = siteConfig.description,
  image = DEFAULT_IMAGE,
  url = siteConfig.url,
  type = "website",
  noIndex = false,
}: SEOProps) {
  const fullTitle = title ? `${title} — ${siteConfig.name}` : `${siteConfig.name} — ${siteConfig.tagline}`;

  return (
    <Head>
      {/* Primary */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={siteConfig.name} />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* Misc */}
      <meta name="theme-color" content="#09090b" />
    </Head>
  );
}