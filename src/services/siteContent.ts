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
  const [settings, aboutRows, articles, timelineAll, books, podcasts] = await Promise.all([
    loadSiteSettings(),
    listRows(tableConfigs.about, { publishedOnly: true }),
    listRows(tableConfigs.articles, { publishedOnly: true }),
    safeListRows(tableConfigs.timelineEntries, { publishedOnly: true }),
    listRows(tableConfigs.books, { publishedOnly: true }),
    listRows(tableConfigs.podcasts, { publishedOnly: true }),
  ]);

  const opinions = articles.filter((a) => (a.type as string) === "legal_opinion");

  const [
    practiceAreas,
    memberships,
    speakingEvents,
    collaborationServices,
    resources,
    testimonials,
    ticker,
    publications,
    contactDetails,
    socialLinks,
  ] = await Promise.all([
    safeListRows(tableConfigs.practiceAreas, { publishedOnly: true }),
    safeListRows(tableConfigs.memberships, { publishedOnly: true }),
    safeListRows(tableConfigs.speakingEvents, { publishedOnly: true }),
    safeListRows(tableConfigs.collaborationServices, { publishedOnly: true }),
    safeListRows(tableConfigs.resources, { publishedOnly: true }),
    safeListRows(tableConfigs.testimonials, { publishedOnly: true }),
    safeListRows(tableConfigs.tickerItems, { publishedOnly: true }),
    safeListRows(tableConfigs.publicationLogos, { publishedOnly: true }),
    safeListRows(tableConfigs.contactDetails, { publishedOnly: true }),
    safeListRows(tableConfigs.socialLinks, { publishedOnly: true }),
  ]);

  return {
    about: aboutRows[0] ?? null,
    articles: articles.filter((a) => (a.type as string) !== "legal_opinion"),
    opinions,
    practiceAreas,
    timelineAbout: timelineAll.filter((t) => t.section === "about"),
    timelineCredentials: timelineAll.filter((t) => t.section === "credentials"),
    memberships,
    speakingEvents,
    collaborationServices,
    resources,
    testimonials,
    ticker,
    publications,
    contactDetails,
    socialLinks,
    books,
    podcasts,
    settings,
  };
}
