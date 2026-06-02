/** DB snake_case row → LexResolve-style camelCase API object */
export function rowToApi(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: row.id,
    type: row.type,
    title: row.title,
    slug: row.slug,
    description: row.description ?? "",
    content: row.content ?? "",
    status: row.status ?? "draft",
    author: row.author,
    category: row.category,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
    publishDate: row.publish_date ?? row.publishDate,
    featuredImage: row.featured_image ?? row.featuredImage,
    galleryImages: parseJsonArray(row.gallery_images ?? row.galleryImages),
    pdfUrl: row.pdf_url ?? row.pdfUrl,
    coverImage: row.cover_image ?? row.coverImage,
    buyLink: row.buy_link ?? row.buyLink,
    publicationDate: row.publication_date ?? row.publicationDate,
    publisher: row.publisher,
    isbn: row.isbn,
    summary: row.summary ?? "",
    audioUrl: row.audio_url ?? row.audioUrl,
    videoUrl: row.video_url ?? row.videoUrl,
    duration: row.duration,
    episodeNumber: row.episode_number ?? row.episodeNumber,
    guestName: row.guest_name ?? row.guestName,
    platformLinks: parseJsonObject(row.platform_links ?? row.platformLinks),
    icon: row.icon,
    articleCount: row.article_count ?? row.articleCount ?? 0,
    tags: parseTags(row.tags),
    topicIds: parseJsonArray(row.topic_ids ?? row.topicIds),
  };

  for (const key of Object.keys(out)) {
    if (out[key] === undefined) delete out[key];
  }
  return out;
}

/** Request body camelCase → DB columns for pickBody */
export function apiToRow(body: Record<string, unknown>): Record<string, unknown> {
  const map: Record<string, string> = {
    featuredImage: "featured_image",
    galleryImages: "gallery_images",
    pdfUrl: "pdf_url",
    publishDate: "publish_date",
    coverImage: "cover_image",
    buyLink: "buy_link",
    publicationDate: "publication_date",
    audioUrl: "audio_url",
    videoUrl: "video_url",
    episodeNumber: "episode_number",
    guestName: "guest_name",
    platformLinks: "platform_links",
    articleCount: "article_count",
    topicIds: "topic_ids",
    createdAt: "created_at",
    updatedAt: "updated_at",
  };

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) continue;
    const col = map[key] ?? key.replace(/([A-Z])/g, "_$1").toLowerCase();
    if (col === "type" && typeof value === "string" && !body.type) {
      /* keep */
    }
    out[col] = value;
  }
  return out;
}

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return value.split(",").map((t) => t.trim()).filter(Boolean);
    }
  }
  return [];
}

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return [];
    }
  }
  return [];
}

function parseJsonObject(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string" && value.trim()) {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export const contentTypeToConfigKey: Record<
  string,
  "articles" | "topics" | "books" | "podcasts" | "about"
> = {
  article: "articles",
  topic: "topics",
  book: "books",
  podcast: "podcasts",
  about: "about",
};
