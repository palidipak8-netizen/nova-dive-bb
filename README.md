# Nova Drive

Google Drive-style app built on Cloudflare Pages, Workers, D1, and R2.

## Live URLs

- Frontend: `https://67c104e5.nova-drive-frontend.pages.dev`
- API: `https://nova-drive-api.nova-drive-bb.workers.dev`

## Stack

- Cloudflare Pages for the frontend
- Cloudflare Workers for the API
- Cloudflare D1 for folder and file metadata
- Cloudflare R2 for uploaded files

## Main files

- `index.html`, `styles.css`, `script.js` - frontend
- `src/worker.js` - Worker API
- `schema.sql` - D1 schema and seed data
- `wrangler.toml` - Pages config
- `wrangler.worker.toml` - Worker config

## Local dev

Run the Worker API:

```powershell
npx.cmd wrangler dev --config wrangler.worker.toml
```

Run a local static frontend server:

```powershell
npx.cmd serve .
```

## Deploy

Apply the schema to remote D1:

```powershell
npx.cmd wrangler d1 execute nova_drive_db --file schema.sql --remote
```

Deploy the Worker:

```powershell
npx.cmd wrangler deploy --config wrangler.worker.toml
```

Deploy the frontend to Pages:

```powershell
npx.cmd wrangler pages deploy . --project-name nova-drive-frontend --branch main
```

## Access model

- `viewer` - view only
- `editor` - upload, create folders, and edit
- `manager` - download and grant access
- `owner` - full control

## API routes

- `GET /health`
- `GET /api/bootstrap`
- `GET /api/me`
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/folders`
- `POST /api/folders`
- `PUT /api/folders/:id`
- `DELETE /api/folders/:id`
- `GET /api/files`
- `POST /api/files`
- `GET /api/files/:id`
- `GET /api/files/:id/download`
- `PUT /api/files/:id`
- `DELETE /api/files/:id`
- `GET /api/files/versions?fileId=...`
- `POST /api/files/versions`
- `GET /api/files/comments?fileId=...`
- `POST /api/files/comments`
- `POST /api/grants`
- `POST /api/shared-drives`
