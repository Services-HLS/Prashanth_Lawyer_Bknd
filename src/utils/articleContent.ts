/** LexResolve-style metadata appended to article HTML */
const METADATA_RE = /<!--\s*METADATA_START([\s\S]*?)-->\s*$/i;

export type ArticleContentMeta = {
  cleanHtml: string;
  galleryImages: string[];
  pdfUrl: string;
};

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isOutlineOrToc(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return false;
  if (/^table of contents$/i.test(t)) return true;
  if (/table of contents/i.test(t.slice(0, 80)) && t.length < 500) return true;
  if ((t.match(/\bmeaning of\b/gi) || []).length >= 2) return true;
  if ((t.match(/\bsection\s+\d+/gi) || []).length >= 2) return true;
  const lines = t.split(/(?:\n|(?<=[.!?])\s+)/).filter((l) => l.trim().length > 2);
  if (lines.length >= 4) {
    const outlineLike = lines.filter(
      (l) =>
        l.length < 90 &&
        (/^\d+\.\s/.test(l) ||
          /^meaning of\b/i.test(l) ||
          /^section\b/i.test(l) ||
          /^chapter\b/i.test(l)),
    );
    if (outlineLike.length >= 3) return true;
  }
  return false;
}

function isOutlineLine(line: string): boolean {
  const l = line.trim();
  if (!l || /^table of contents$/i.test(l)) return true;
  if (/^\d+\.\s/.test(l) && l.length < 100 && !/[.!?]$/.test(l)) return true;
  if (/^meaning of\b/i.test(l) && l.length < 120) return true;
  return isOutlineOrToc(l);
}

function normalizedHeadingText(line: string): string {
  return line
    .trim()
    .replace(/^#{1,6}\s+/, "")
    .replace(/^\d+[\.)]\s+/, "")
    .replace(/^section\s+\d+\s*[:.-]?\s*/i, "Section ")
    .replace(/\s+/g, " ");
}

function detectSectionHeading(line: string): string | null {
  const raw = line.trim();
  if (!raw) return null;
  const text = normalizedHeadingText(raw);
  if (!text || text.length > 100) return null;

  if (/^#{1,6}\s+/.test(raw)) return text;
  if (/^section\s+\d+[:.\s-]/i.test(raw)) return text;
  if (
    /^(introduction|background|analysis|conclusion|references|bibliography|facts|issues|arguments?|discussion|key takeaways?)\s*[:.-]?$/i.test(
      raw,
    )
  ) {
    return text;
  }
  return null;
}

function firstReadableParagraph(htmlOrText: string, minLen = 60): string {
  const raw = htmlOrText.replace(METADATA_RE, "").trim();
  if (!raw) return "";

  if (raw.includes("<p")) {
    const parts = raw.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || [];
    for (const part of parts) {
      const text = stripHtml(part).trim();
      if (text.length >= minLen && !isOutlineLine(text)) return text;
    }
  }

  const plain = stripHtml(raw);
  const chunks = plain.split(/\n\n+/).map((c) => c.trim()).filter(Boolean);
  for (const chunk of chunks) {
    if (chunk.length >= minLen && !isOutlineLine(chunk)) return chunk;
  }
  return "";
}

function formatSummary(description: unknown, content: unknown, maxLen = 220): string {
  const desc = description == null ? "" : String(description);
  const body = content == null ? "" : String(content);

  let text = "";
  if (desc && !isOutlineOrToc(stripHtml(desc))) text = stripHtml(desc);
  else text = firstReadableParagraph(body, 50);
  if (!text && desc) text = stripHtml(desc);
  if (!text) text = firstReadableParagraph(body, 40);

  text = text.replace(/\s+/g, " ").trim();
  if (text.length > maxLen) text = text.slice(0, maxLen).replace(/\s+\S*$/, "") + "…";
  return text;
}

function filterHtmlParagraphs(html: string): string {
  const parts = html.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || [];
  if (!parts.length) return html;
  const kept = parts
    .map((part) => {
      const text = stripHtml(part).trim();
      const heading = detectSectionHeading(text);
      if (heading) return `<h2>${escapeHtml(heading)}</h2>`;
      return part;
    })
    .filter((part) => {
      const text = stripHtml(part).trim();
      return text && !isOutlineLine(text);
    });
  return kept.join("\n");
}

function plainTextToHtml(text: string): string {
  const cleaned = text.replace(METADATA_RE, "").trim();
  if (!cleaned) return "";

  const lines = cleaned
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out: string[] = [];
  let paragraph = "";

  const flushParagraph = () => {
    const p = paragraph.replace(/\s+/g, " ").trim();
    paragraph = "";
    if (!p || p.length < 20 || isOutlineLine(p)) return;
    out.push(`<p>${escapeHtml(p)}</p>`);
  };

  for (const line of lines) {
    const heading = detectSectionHeading(line);
    if (heading) {
      flushParagraph();
      out.push(`<h2>${escapeHtml(heading)}</h2>`);
      continue;
    }
    paragraph = paragraph ? `${paragraph} ${line}` : line;
  }
  flushParagraph();
  return out.join("\n");
}

function formatBodyHtml(content: string): string {
  const raw = content.replace(METADATA_RE, "").trim();
  if (!raw) return "";
  if (raw.includes("<p") || raw.includes("<h")) {
    const filtered = filterHtmlParagraphs(raw);
    if (filtered) return filtered.replace(/<h1/gi, "<h2").replace(/<\/h1>/gi, "</h2>");
  }
  return plainTextToHtml(raw);
}

export function parseArticleContentMetadata(html: string): ArticleContentMeta {
  const raw = html ?? "";
  const match = raw.match(METADATA_RE);
  if (!match) {
    return { cleanHtml: raw, galleryImages: [], pdfUrl: "" };
  }

  let galleryImages: string[] = [];
  let pdfUrl = "";
  try {
    const meta = JSON.parse(match[1]) as {
      galleryImages?: unknown;
      pdfUrl?: string;
    };
    if (Array.isArray(meta.galleryImages)) {
      galleryImages = meta.galleryImages.map(String).filter(Boolean);
    }
    if (typeof meta.pdfUrl === "string") pdfUrl = meta.pdfUrl;
  } catch {
    /* ignore invalid JSON */
  }

  return {
    cleanHtml: raw.replace(METADATA_RE, "").trim(),
    galleryImages,
    pdfUrl,
  };
}

export type ArticleSanitizeMode = "list" | "detail";

export function sanitizeArticleRow<T extends Record<string, unknown>>(
  row: T,
  mode: ArticleSanitizeMode = "list",
): T {
  const content = row.content;
  const description = row.description;
  const next = { ...row } as T & {
    content?: string;
    description?: string;
    gallery_images?: string;
    pdf_url?: string;
  };

  if (mode === "detail" && typeof content === "string") {
    if (content.includes("METADATA_START")) {
      const { cleanHtml, galleryImages, pdfUrl } = parseArticleContentMetadata(content);
      next.content = cleanHtml;
      if (galleryImages.length && !next.gallery_images) {
        next.gallery_images = JSON.stringify(galleryImages);
      }
      if (pdfUrl && !next.pdf_url) next.pdf_url = pdfUrl;
    }
    const formatted = formatBodyHtml(String(next.content ?? content));
    if (formatted) next.content = formatted;
  } else {
    delete next.content;
  }

  const summary = formatSummary(description, mode === "detail" ? (next.content ?? content) : "");
  if (summary) next.description = summary;
  else if (typeof description === "string" && isOutlineOrToc(stripHtml(description))) {
    next.description = "";
  }

  return next as T;
}

export { sanitizeBookRow } from "./bookContent.js";
