const MAX_CANVAS_ASSIGNMENT_HTML = 250_000;

const allowedTags = new Set([
  "a", "b", "blockquote", "br", "div", "em", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "li", "ol", "p", "span", "strong", "table", "tbody", "td", "th", "thead", "tr", "u", "ul",
]);

function safeLink(tag: string) {
  const rawHref = tag.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)?.slice(1).find(Boolean);
  if (!rawHref) return "";
  try {
    const url = new URL(rawHref, "https://canvas.invalid");
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return ` href="${url.href.replace(/"/g, "%22")}" target="_blank" rel="noreferrer"`;
  } catch {
    return "";
  }
}

/**
 * Canvas assignment briefs are instructor-authored HTML. Retain the useful
 * semantic formatting (lists, tables, emphasis, and links) while stripping
 * executable content, attributes, embeds, and Canvas-only presentation CSS.
 */
export function sanitizeCanvasAssignmentHtml(rawHtml: string | null | undefined) {
  const source = (rawHtml ?? "").slice(0, MAX_CANVAS_ASSIGNMENT_HTML);
  return source
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|iframe|object|embed|form|input|button|svg|math)[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(script|style|iframe|object|embed|form|input|button|svg|math)\b[^>]*\/?\s*>/gi, "")
    .replace(/<\/?([a-z0-9]+)\b[^>]*>/gi, (tag, rawName: string) => {
      const name = rawName.toLowerCase();
      if (!allowedTags.has(name)) return "";
      if (tag.startsWith("</")) return `</${name}>`;
      if (name === "br" || name === "hr") return `<${name}>`;
      return `<${name}${name === "a" ? safeLink(tag) : ""}>`;
    });
}

export function canvasAssignmentHtmlForStorage(rawHtml: string | null | undefined) {
  return (rawHtml ?? "").slice(0, MAX_CANVAS_ASSIGNMENT_HTML);
}
