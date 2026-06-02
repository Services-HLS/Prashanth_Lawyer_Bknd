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
  const [books] = await pool.query(
    "SELECT id, title, slug, status, CHAR_LENGTH(IFNULL(cover_image,'')) AS cover_len FROM books",
  );
  const [pub] = await pool.query(
    "SELECT COUNT(*) AS c FROM books WHERE status = 'published'",
  );
  console.log("published count:", pub[0].c);
  console.log(JSON.stringify(books, null, 2));
} catch (e) {
  console.error("Error:", e.message);
} finally {
  await pool.end();
}
