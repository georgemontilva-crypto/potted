import sanitize from "sanitize-html";

/** Limpia el HTML de artículos y páginas: solo etiquetas de contenido, sin scripts ni estilos. */
export function cleanHtml(input: string): string {
  return sanitize(input, {
    allowedTags: [
      "h2", "h3", "h4", "h5", "h6", "p", "br", "hr", "ul", "ol", "li", "a", "strong", "b", "em", "i", "u", "s",
      "blockquote", "figure", "figcaption", "img", "table", "thead", "tbody", "tr", "th", "td", "code", "pre",
      "span", "sup", "sub", "iframe",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel", "title"],
      img: ["src", "alt", "width", "height", "loading"],
      iframe: ["src", "width", "height", "allow", "allowfullscreen", "title"],
      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesAppliedToAttributes: ["href", "src"],
    allowProtocolRelative: false,
    allowedIframeHostnames: ["www.youtube.com", "www.youtube-nocookie.com", "player.vimeo.com"],
    transformTags: {
      h1: "h2",
      a: (tagName, attribs) => {
        const href = attribs.href ?? "";
        const out: Record<string, string> = { href };
        if (attribs.title) out.title = attribs.title;
        if (/^https?:\/\//i.test(href)) {
          out.target = "_blank";
          out.rel = "noopener noreferrer";
        }
        return { tagName, attribs: out };
      },
      img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy" } }),
    },
    exclusiveFilter: (frame) => (frame.tag === "p" || frame.tag === "span") && !frame.text.trim() && !frame.mediaChildren?.length,
  }).trim();
}

/** Texto plano corto a partir de HTML (para extractos y descripciones). */
export function textFromHtml(html: string, max = 280): string {
  const text = sanitize(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;|&rsquo;/g, "’")
    .replace(/&#8216;|&lsquo;/g, "‘")
    .replace(/&#8220;|&ldquo;/g, "“")
    .replace(/&#8221;|&rdquo;/g, "”")
    .replace(/&#8211;|&ndash;/g, "–")
    .replace(/&#8212;|&mdash;/g, "—")
    .replace(/&#8230;|&hellip;/g, "…")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ") > max * 0.6 ? cut.lastIndexOf(" ") : max).trim()}…`;
}
