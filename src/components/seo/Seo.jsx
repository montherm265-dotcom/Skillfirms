import { useEffect } from "react";

const SITE_NAME = "Skillfirms";
const SITE_URL = typeof window !== "undefined" ? window.location.origin : "";
const DEFAULT_OG_IMAGE = "/logo.png";

function upsertMeta(attr, key, content) {
  if (!content && content !== "") return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel, href) {
  if (!href) return;
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function absUrl(path) {
  if (!path) return SITE_URL;
  if (path.startsWith("http")) return path;
  return SITE_URL + (path.startsWith("/") ? path : "/" + path);
}

export default function Seo({ title, description, canonical = null, image = null, type = "website", noindex = false }) {
  useEffect(() => {
    const url = absUrl(canonical);
    const imgUrl = image ? absUrl(image) : absUrl(DEFAULT_OG_IMAGE);
    const fullTitle = title ? `${title} | Skillfirms` : "Skillfirms — AI Career Intelligence";
    const desc = description || "Tell Skillfirms where you want your career to go. We'll find your skill gaps, build your path, and prove what you can do.";

    document.title = fullTitle;
    upsertMeta("name", "description", desc);
    upsertMeta("name", "robots", noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1");
    upsertLink("canonical", url);

    upsertMeta("property", "og:title", fullTitle);
    upsertMeta("property", "og:description", desc);
    upsertMeta("property", "og:type", type);
    upsertMeta("property", "og:url", url);
    upsertMeta("property", "og:site_name", SITE_NAME);
    upsertMeta("property", "og:image", imgUrl);

    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", fullTitle);
    upsertMeta("name", "twitter:description", desc);
    upsertMeta("name", "twitter:image", imgUrl);
  }, [title, description, canonical, image, type, noindex]);

  return null;
}
