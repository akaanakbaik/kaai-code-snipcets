import { useEffect } from "react";

export const SITE_NAME = "Kaai Code Snippet";
export const SITE_URL = "https://codes-snippet.kaai.my.id";
export const SITE_LOGO =
  "https://raw.githubusercontent.com/akaanakbaik/my-cdn/main/furinaai/codes-snipset-kaai/logo%20bulat%20latar%20hitam.png";

export const DEFAULT_DESCRIPTION =
  "Kumpulan code snippet siap pakai untuk developer Indonesia dan mancanegara. Temukan, bagikan, dan salin kode JavaScript, TypeScript, Python, dan bahasa pemrograman lainnya secara gratis.";

export const DEFAULT_KEYWORDS =
  "code snippet, kode program, javascript snippet, typescript, python, developer indonesia, snippet sharing, programming, coding, open source, contoh kode, script siap pakai, kode gratis";

export interface SEOOptions {
  title?: string;
  description?: string;
  keywords?: string;
  url?: string;
  image?: string;
  type?: "website" | "article";
  structuredData?: Record<string, unknown> | Record<string, unknown>[];
  noindex?: boolean;
}

function setMeta(selector: string, attr: string, attrVal: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, attrVal);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLink(rel: string, href: string) {
  let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

function setJsonLd(data: Record<string, unknown> | Record<string, unknown>[] | null) {
  const id = "__seo_jsonld__";
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!data) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("script");
    el.id = id;
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

export function useSEO({
  title,
  description = DEFAULT_DESCRIPTION,
  keywords = DEFAULT_KEYWORDS,
  url,
  image = SITE_LOGO,
  type = "website",
  structuredData,
  noindex = false,
}: SEOOptions = {}) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — Kumpulan Code Snippet Developer`;
  const fullUrl = url ? `${SITE_URL}${url}` : SITE_URL;

  useEffect(() => {
    document.title = fullTitle;

    setMeta('meta[name="description"]', "name", "description", description);
    setMeta('meta[name="keywords"]', "name", "keywords", keywords);
    setMeta(
      'meta[name="robots"]',
      "name",
      "robots",
      noindex
        ? "noindex, nofollow"
        : "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1",
    );

    setLink("canonical", fullUrl);

    setMeta('meta[property="og:title"]', "property", "og:title", fullTitle);
    setMeta('meta[property="og:description"]', "property", "og:description", description);
    setMeta('meta[property="og:url"]', "property", "og:url", fullUrl);
    setMeta('meta[property="og:image"]', "property", "og:image", image);
    setMeta('meta[property="og:type"]', "property", "og:type", type);
    setMeta('meta[property="og:locale"]', "property", "og:locale", "id_ID");
    setMeta('meta[property="og:locale:alternate"]', "property", "og:locale:alternate", "en_US");

    setMeta('meta[name="twitter:title"]', "name", "twitter:title", fullTitle);
    setMeta('meta[name="twitter:description"]', "name", "twitter:description", description);
    setMeta('meta[name="twitter:image"]', "name", "twitter:image", image);
    setMeta('meta[name="twitter:card"]', "name", "twitter:card", "summary_large_image");

    setJsonLd(structuredData ?? null);

    return () => {
      document.title = SITE_NAME;
    };
  }, [fullTitle, description, keywords, fullUrl, image, type, noindex, structuredData]);
}
