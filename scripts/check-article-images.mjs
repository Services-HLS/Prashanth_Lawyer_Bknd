import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: (process.env.DB_HOST || "").includes("rds.amazonaws.com")
    ? { rejectUnauthorized: false }
    : undefined,
  connectTimeout: 20000,
});

try {
  const [rows] = await pool.query(
    `SELECT slug, title,
      CHAR_LENGTH(IFNULL(featured_image,'')) AS feat_len,
      LEFT(IFNULL(featured_image,''), 40) AS feat_start,
      CHAR_LENGTH(IFNULL(gallery_images,'')) AS gal_len,
      CHAR_LENGTH(IFNULL(content,'')) AS content_len,
      (content LIKE '%<img%') AS has_img_in_content
     FROM articles WHERE status = 'published'`,
  );
  console.log(JSON.stringify(rows, null, 2));
} catch (e) {
  console.error(e.message);
} finally {
  await pool.end();
}
