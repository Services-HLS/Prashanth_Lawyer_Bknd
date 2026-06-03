const LARGE_IMAGE_BYTES = 80_000;

/** Omit huge base64 blobs from list payloads; clients load via /api/v1/images/... */
export function stripHeavyImageFields<T extends Record<string, unknown>>(row: T): T {
  const next: Record<string, unknown> = { ...row };

  const featured = next.featured_image;
  if (typeof featured === "string" && featured.length > LARGE_IMAGE_BYTES) {
    next.featured_image = null;
    next.has_featured_image = 1;
  }

  const cover = next.cover_image;
  if (typeof cover === "string" && cover.length > LARGE_IMAGE_BYTES) {
    next.cover_image = null;
    next.has_cover_image = 1;
  }

  const gallery = next.gallery_images;
  if (typeof gallery === "string" && gallery.length > LARGE_IMAGE_BYTES) {
    next.gallery_images = null;
    next.has_gallery_images = 1;
  }

  return next as T;
}
