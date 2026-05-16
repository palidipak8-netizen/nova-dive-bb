# Nova Drive Prototype

Free-stack starter for a Google Drive-like app.

## Stack

- Cloudflare Pages for the frontend
- Cloudflare Workers for the API
- Cloudflare D1 for folder/file metadata
- Cloudflare R2 for uploaded files

## Files

- `index.html`, `styles.css`, `script.js` - frontend prototype
- `src/worker.js` - Worker API
- `schema.sql` - D1 schema and seed data
- `wrangler.toml` - Worker config

## Local setup

1. Install Wrangler.
2. Create the D1 database and R2 bucket.
3. Apply `schema.sql` to D1.
4. Run the Worker with `wrangler dev`.

## Production deploy

1. Set `database_id` in `wrangler.toml`.
2. Set `CORS_ORIGIN` to your deployed frontend origin.
3. Set `AUTH_SECRET` as a Wrangler secret:

   `wrangler secret put AUTH_SECRET`

4. Apply the schema to your live D1 database:

   `wrangler d1 execute nova_drive_db --file schema.sql`

5. Deploy the Worker:

   `wrangler deploy`

6. Deploy the frontend to Cloudflare Pages, then update `CORS_ORIGIN` to that Pages URL.

## API routes

- `GET /api/bootstrap`
- `GET /api/folders`
- `POST /api/folders`
- `GET /api/files?folderId=...`
- `POST /api/files`
- `DELETE /api/files/:id`
