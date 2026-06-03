/** Book publication formatting — TOC, sections, bullet points on detail; short excerpt on lists */

const METADATA_RE = /<!--\s*METADATA_START[\s\S]*?-->\s*$/i;

function stripMetadata(text: string): string {
  return text.replace(METADATA_RE, "").trim();
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/ {2,}/g, " ")
    .trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isTocHeading(line: string): boolean {
  return /^table of contents$/i.test(line.trim());
}

function isSectionHeading(line: string): boolean {
  const l = line.trim();
  if (!l) return false;
  return (
    /^section\s+\d+[\s:.–-]/i.test(l) ||
    /^section\s+\d+$/i.test(l) ||
    /^chapter\s+\d+/i.test(l) ||
    /^part\s+\d+/i.test(l) ||
    /^appendix\b/i.test(l) ||
    (/^meaning of\b/i.test(l) && l.length < 160)
  );
}

function isTocEntry(line: string): boolean {
  const l = line.trim();
  if (!l || isTocHeading(l)) return false;
  if (/^\d+\.\s/.test(l) && l.length < 140 && !/[.!?]$/.test(l)) return true;
  if (/^meaning of\b/i.test(l) && l.length < 160) return true;
  return false;
}

function isBulletLine(line: string): boolean {
  const l = line.trim();
  return /^[-•*–—]\s+/.test(l) || /^\d+[\.)]\s+/.test(l);
}

function stripBulletPrefix(line: string): string {
  return line.trim().replace(/^[-•*–—]\s+/, "").replace(/^\d+[\.)]\s+/, "").trim();
}

function isProseParagraph(line: string): boolean {
  const l = line.trim();
  if (l.length < 50) return false;
  if (isTocEntry(l) || isSectionHeading(l) || isBulletLine(l)) return false;
  return /[.!?]/.test(l) || l.length > 120;
}

function splitBookLines(text: string): string[] {
  const plain = stripHtml(text).replace(/\r\n/g, "\n").trim();
  if (!plain) return [];

  const chunks = plain
    .split(/\n+/)
    .flatMap((block) => {
      const t = block.trim();
      if (!t) return [];
      if (t.length < 180) return [t];
      return t
        .split(/(?=\d+\.\s)|(?=Meaning of\b)|(?=Section\s+\d+)|(?=Chapter\s+\d+)/i)
        .map((s) => s.trim())
        .filter(Boolean);
    });

  return chunks.map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
}

type BookBlock =
  | { kind: "toc"; title: string; entries: string[] }
  | { kind: "section"; title: string; paragraphs: string[]; points: string[] }
  | { kind: "paragraph"; text: string };

function parseBookBlocks(text: string): BookBlock[] {
  const lines = splitBookLines(text);
  if (!lines.length) return [];

  const blocks: BookBlock[] = [];
  let i = 0;

  let tocTitle = "Table of Contents";
  const tocEntries: string[] = [];
  let sawTocHeading = false;

  while (i < lines.length && (isTocHeading(lines[i]) || isTocEntry(lines[i]))) {
    if (isTocHeading(lines[i])) {
      sawTocHeading = true;
      tocTitle = lines[i];
      i++;
      continue;
    }
    tocEntries.push(lines[i]);
    i++;
  }

  if (tocEntries.length >= 2 || (sawTocHeading && tocEntries.length >= 1)) {
    blocks.push({ kind: "toc", title: tocTitle, entries: tocEntries });
  } else {
    i = 0;
  }

  let section: { title: string; paragraphs: string[]; points: string[] } | null = null;

  function flushSection() {
    if (!section) return;
    if (section.title || section.paragraphs.length || section.points.length) {
      blocks.push({ kind: "section", ...section });
    }
    section = null;
  }

  for (; i < lines.length; i++) {
    const line = lines[i];

    if (isSectionHeading(line)) {
      flushSection();
      section = { title: line, paragraphs: [], points: [] };
      continue;
    }

    if (isBulletLine(line)) {
      if (!section) section = { title: "", paragraphs: [], points: [] };
      section.points.push(stripBulletPrefix(line));
      continue;
    }

    if (isTocEntry(line) && !section) {
      if (blocks.length && blocks[blocks.length - 1].kind === "toc") {
        (blocks[blocks.length - 1] as { kind: "toc"; entries: string[] }).entries.push(line);
      } else {
        blocks.push({ kind: "toc", title: "Table of Contents", entries: [line] });
      }
      continue;
    }

    if (isProseParagraph(line)) {
      flushSection();
      blocks.push({ kind: "paragraph", text: line });
      continue;
    }

    if (!section) section = { title: "", paragraphs: [], points: [] };
    section.paragraphs.push(line);
  }

  flushSection();
  return blocks;
}

function renderToc(block: Extract<BookBlock, { kind: "toc" }>): string {
  const items = block.entries.map((e) => `<li>${escapeHtml(e)}</li>`).join("\n");
  return `<nav class="book-toc" aria-label="Table of contents">
  <h2 class="book-toc-title">${escapeHtml(block.title)}</h2>
  <ol class="book-toc-list">${items}</ol>
</nav>`;
}

function renderSection(block: Extract<BookBlock, { kind: "section" }>): string {
  const title = block.title
    ? `<h2 class="book-section-title">${escapeHtml(block.title)}</h2>`
    : "";
  const paras = block.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n");
  const points =
    block.points.length > 0
      ? `<ul class="book-points">${block.points.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>`
      : "";
  return `<section class="book-section">${title}${paras}${points}</section>`;
}

export function formatBookBodyHtml(description: string): string {
  const raw = stripMetadata(description.trim());
  if (!raw) return "";

  if (raw.includes("<nav") && raw.includes("book-toc")) return raw;

  const blocks = parseBookBlocks(raw);
  if (!blocks.length) {
    const plain = stripHtml(raw);
    return plain ? `<div class="book-publication"><p>${escapeHtml(plain)}</p></div>` : "";
  }

  const html = blocks
    .map((b) => {
      if (b.kind === "toc") return renderToc(b);
      if (b.kind === "section") return renderSection(b);
      return `<p>${escapeHtml(b.text)}</p>`;
    })
    .join("\n");

  return `<div class="book-publication">${html}</div>`;
}

export function formatBookCardSummary(description: string, maxLen = 160): string {
  const blocks = parseBookBlocks(stripMetadata(description));
  for (const b of blocks) {
    if (b.kind === "paragraph" && b.text.length >= 40) {
      let text = b.text.replace(/\s+/g, " ").trim();
      if (text.length > maxLen) text = text.slice(0, maxLen).replace(/\s+\S*$/, "") + "…";
      return text;
    }
    if (b.kind === "section" && b.paragraphs.length) {
      let text = b.paragraphs.join(" ").replace(/\s+/g, " ").trim();
      if (text.length > maxLen) text = text.slice(0, maxLen).replace(/\s+\S*$/, "") + "…";
      return text;
    }
  }

  const fallback = stripHtml(description)
    .split(/\n\n+/)
    .map((p) => p.trim())
    .find((p) => p.length >= 50 && !isTocEntry(p) && !isTocHeading(p));

  if (!fallback) return "";
  let text = fallback.replace(/\s+/g, " ").trim();
  if (text.length > maxLen) text = text.slice(0, maxLen).replace(/\s+\S*$/, "") + "…";
  return text;
}

export type BookSanitizeMode = "list" | "detail";

export function sanitizeBookRow<T extends Record<string, unknown>>(
  row: T,
  mode: BookSanitizeMode = "list",
): T {
  const next = { ...row } as T & { description?: string; excerpt?: string };
  const raw = next.description == null ? "" : String(next.description);
  const excerpt = formatBookCardSummary(raw);

  if (mode === "detail") {
    const body = formatBookBodyHtml(raw);
    if (excerpt) next.excerpt = excerpt;
    if (body) next.description = body;
    else if (excerpt) next.description = `<div class="book-publication"><p>${escapeHtml(excerpt)}</p></div>`;
  } else {
    next.description = excerpt;
  }

  return next as T;
}
