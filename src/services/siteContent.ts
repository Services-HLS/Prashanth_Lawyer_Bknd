import type { RowDataPacket } from "mysql2/promise";

import { tableConfigs } from "../config/tables.js";
import { getPool } from "../db/pool.js";
import { isNoSuchTableError, listRows, safeListRows } from "./tableCrud.js";
import { parseJsonColumn } from "../utils/http.js";

export type SitePayload = {
  about: RowDataPacket | null;
  articles: RowDataPacket[];
  opinions: RowDataPacket[];
  practiceAreas: RowDataPacket[];
  timelineAbout: RowDataPacket[];
  timelineCredentials: RowDataPacket[];
  memberships: RowDataPacket[];
  speakingEvents: RowDataPacket[];
  collaborationServices: RowDataPacket[];
  resources: RowDataPacket[];
  testimonials: RowDataPacket[];
  ticker: RowDataPacket[];
  publications: RowDataPacket[];
  contactDetails: RowDataPacket[];
  socialLinks: RowDataPacket[];
  books: RowDataPacket[];
  podcasts: RowDataPacket[];
  settings: Record<string, unknown>;
};

async function loadSiteSettings(): Promise<Record<string, unknown>> {
  try {
    const pool = getPool();
    const [settingsRows] = await pool.query<RowDataPacket[]>(
      `SELECT setting_key, setting_value FROM site_settings`,
    );
    const settings: Record<string, unknown> = {};
    for (const row of settingsRows) {
      settings[row.setting_key as string] = parseJsonColumn(row.setting_value, row.setting_value);
    }
    return settings;
  } catch (err) {
    if (isNoSuchTableError(err)) {
      return {};
    }
    throw err;
  }
}

export async function loadSitePayload(): Promise<SitePayload> {
  const settings = await loadSiteSettings();

  const aboutRows = await listRows(tableConfigs.about, { publishedOnly: true });
  const articles = await listRows(tableConfigs.articles, { publishedOnly: true });
  const opinions = await listRows(tableConfigs.articles, {
    publishedOnly: true,
    extraWhere: "type = :type",
    params: { type: "legal_opinion" },
  });

  const timelineAll = await safeListRows(tableConfigs.timelineEntries, { publishedOnly: true });

  return {
    about: aboutRows[0] ?? null,
    articles: articles.filter((a) => (a.type as string) !== "legal_opinion"),
    opinions,
    practiceAreas: await safeListRows(tableConfigs.practiceAreas, { publishedOnly: true }),
    timelineAbout: timelineAll.filter((t) => t.section === "about"),
    timelineCredentials: timelineAll.filter((t) => t.section === "credentials"),
    memberships: await safeListRows(tableConfigs.memberships, { publishedOnly: true }),
    speakingEvents: await safeListRows(tableConfigs.speakingEvents, { publishedOnly: true }),
    collaborationServices: await safeListRows(tableConfigs.collaborationServices, {
      publishedOnly: true,
    }),
    resources: await safeListRows(tableConfigs.resources, { publishedOnly: true }),
    testimonials: await safeListRows(tableConfigs.testimonials, { publishedOnly: true }),
    ticker: await safeListRows(tableConfigs.tickerItems, { publishedOnly: true }),
    publications: await safeListRows(tableConfigs.publicationLogos, { publishedOnly: true }),
    contactDetails: await safeListRows(tableConfigs.contactDetails, { publishedOnly: true }),
    socialLinks: await safeListRows(tableConfigs.socialLinks, { publishedOnly: true }),
    books: await listRows(tableConfigs.books, { publishedOnly: true }),
    podcasts: await listRows(tableConfigs.podcasts, { publishedOnly: true }),
    settings,
  };
}
