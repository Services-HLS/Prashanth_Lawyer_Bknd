import { getPool } from "../db/pool.js";

async function hasColumn(columnName: string): Promise<boolean> {
  const pool = getPool();
  const [rows] = await pool.query(
    `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'podcasts'
        AND column_name = ?
      LIMIT 1
    `,
    [columnName],
  );
  return Array.isArray(rows) && rows.length > 0;
}

/** Ensures podcasts table has optional media + summary columns. */
export async function ensurePodcastSchema(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS podcasts (
      id VARCHAR(50) PRIMARY KEY,
      type VARCHAR(20) DEFAULT 'podcast',
      title VARCHAR(500) NOT NULL,
      slug VARCHAR(500) UNIQUE NOT NULL,
      summary TEXT,
      description TEXT,
      audio_url VARCHAR(1000),
      video_url VARCHAR(1000),
      duration VARCHAR(20),
      episode_number INT,
      platform_links JSON,
      guest_name VARCHAR(200),
      cover_image VARCHAR(1000),
      status ENUM('draft', 'published') DEFAULT 'draft',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_status (status),
      INDEX idx_slug (slug)
    )
  `);

  if (!(await hasColumn("summary"))) {
    await pool.query("ALTER TABLE podcasts ADD COLUMN summary TEXT NULL AFTER slug");
  }
  if (!(await hasColumn("video_url"))) {
    await pool.query("ALTER TABLE podcasts ADD COLUMN video_url VARCHAR(1000) NULL AFTER audio_url");
  }
}
