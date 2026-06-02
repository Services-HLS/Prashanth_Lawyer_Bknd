import mysql from "mysql2/promise";
import { writeFileSync } from "fs";

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false },
});

const slug = process.argv[2] || "section-34-and-judicial-restraint-when-review-becomes-substitution";
const [rows] = await pool.query(
  "SELECT slug, content, featured_image FROM articles WHERE slug = ? LIMIT 1",
  [slug],
);
const row = rows[0];
const content = String(row.content || "");
const patterns = [
  /<img/gi,
  /data:image/gi,
  /background-image/gi,
  /src=/gi,
  /\[image/gi,
];
for (const p of patterns) {
  const m = content.match(p);
  console.log(p, m ? m.length : 0);
}
writeFileSync("scripts/content-sample.txt", content.slice(0, 8000));
console.log("wrote scripts/content-sample.txt, total len", content.length);
console.log("featured len", String(row.featured_image || "").length);
await pool.end();
