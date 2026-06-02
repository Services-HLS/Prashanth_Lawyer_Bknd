# Prasanth Lawyer — Backend API

Express + MySQL API aligned with `frontend/public/site.html` (no frontend changes required until you wire fetch calls).

## Setup

1. Create MySQL database:
   ```sql
   CREATE DATABASE prasanth_lawyer CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

2. Run migrations in order:
   - `database/base-schema.sql`
   - `database/schema-extensions.sql`

3. Configure environment (`backend/.env`):
   ```bash
   cd backend
   cp .env.example .env
   ```
   Use either naming style (both supported):
   - `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (AWS RDS)
   - `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`
   
   For **AWS RDS**, SSL is enabled automatically when the host contains `rds.amazonaws.com`.

4. Install and run:
   ```bash
   npm install
   npm run dev
   ```

API base: `http://localhost:3001/api/v1`

## Key endpoints

| Method | Path | Maps to frontend |
|--------|------|------------------|
| GET | `/health` | Server / DB check |
| GET | `/site` | Full homepage payload (all sections) |
| GET | `/articles?category=oxford` | `#writing` filters |
| GET | `/articles/opinions` | `#opinions` |
| POST | `/forms/newsletter` | `#newsletter` |
| POST | `/forms/contact` | `#contact` |
| POST | `/ai/chat` | `#qa` / floating chat (optional proxy) |
| GET | `/practice-areas` | `#practice` |
| GET | `/timeline` | About + credentials timeline |
| GET | `/testimonials` | `#testimonials` |
| … | CRUD resources | Per-section admin under `/*/admin` |

Admin CMS: sign in at `/admin/login` with `ADMIN_USERNAME` / `ADMIN_PASSWORD` from `.env` (Bearer session token). Optional legacy header: `X-Admin-Key: <ADMIN_API_KEY>`

## Example requests

```bash
curl http://localhost:3001/api/v1/health

curl http://localhost:3001/api/v1/site

curl -X POST http://localhost:3001/api/v1/forms/contact \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","matter_type":"GST","message":"Hello"}'
```
