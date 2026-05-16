const json = (data, init = {}, corsOrigin = "*") =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": corsOrigin,
      "access-control-allow-credentials": "true",
      "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
      "access-control-allow-headers": "content-type, authorization",
      ...(init.headers || {}),
    },
  });

const text = (body, init = {}, corsOrigin = "*") =>
  new Response(body, {
    ...init,
    headers: {
      "access-control-allow-origin": corsOrigin,
      "access-control-allow-credentials": "true",
      ...(init.headers || {}),
    },
  });

function uuid() {
  return crypto.randomUUID();
}

async function sha256Base64(input) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
}

async function derivePasswordHash(password, salt) {
  return sha256Base64(`${salt}:${password}`);
}

async function getSecret(env) {
  return env.AUTH_SECRET || "dev-secret-change-me";
}

async function signSession(payload, env) {
  const secret = await getSecret(env);
  const encoded = btoa(JSON.stringify(payload));
  const sig = await sha256Base64(`${encoded}.${secret}`);
  return `${encoded}.${sig}`;
}

async function verifySession(token, env) {
  if (!token) return null;
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;
  const secret = await getSecret(env);
  const expected = await sha256Base64(`${encoded}.${secret}`);
  if (expected !== sig) return null;
  return JSON.parse(atob(encoded));
}

function getCookie(request, name) {
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function getBearerToken(request) {
  const header = request.headers.get("authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1] : null;
}

function getCorsOrigin(request, env) {
  const origin = request.headers.get("origin");
  const allowed = env.CORS_ORIGIN || "";
  if (!origin) return allowed || "*";
  if (!allowed) return origin;
  try {
    const originUrl = new URL(origin);
    const allowedUrl = new URL(allowed);
    if (
      originUrl.protocol === allowedUrl.protocol &&
      (originUrl.host === allowedUrl.host || originUrl.host.endsWith(`.${allowedUrl.host}`))
    ) {
      return origin;
    }
  } catch {
    // Fall through to the exact match below.
  }
  return origin === allowed ? origin : allowed;
}

function sessionCookie(token, secure = false) {
  const parts = [`nova_session=${encodeURIComponent(token)}`, "Path=/", "HttpOnly", "SameSite=None"];
  if (secure) parts.push("Secure");
  parts.push("Max-Age=2592000");
  return parts.join("; ");
}

async function getActor(request, env) {
  const token = getBearerToken(request) || getCookie(request, "nova_session");
  const session = await verifySession(token, env);
  if (session) return session;
  return { user: "guest", role: "viewer" };
}

async function getQueryActor(url, env) {
  const token = url.searchParams.get("auth");
  const session = await verifySession(token, env);
  if (session) return session;
  return { user: "guest", role: "viewer" };
}

function canWrite(actor) {
  return actor.role === "owner" || actor.role === "manager" || actor.role === "editor";
}

function roleRank(role) {
  return { guest: 0, viewer: 1, editor: 2, manager: 3, owner: 4 }[role] || 0;
}

function canDownload(actor) {
  return roleRank(actor.role) >= roleRank("manager");
}

function canGrantRole(actor, role) {
  return roleRank(actor.role) >= roleRank(role) && roleRank(role) >= roleRank("viewer");
}

async function getGrant(env, resourceType, resourceId, username) {
  return env.DB.prepare(
    "SELECT id, resource_type as resourceType, resource_id as resourceId, username, role FROM grants WHERE resource_type = ? AND resource_id = ? AND username = ?"
  ).bind(resourceType, resourceId, username).first();
}

async function hasFolderGrant(env, folderId, username, role) {
  let current = folderId;
  while (current) {
    const grant = await getGrant(env, "folder", current, username);
    if (grant && (grant.role === role || (role === "editor" && grant.role === "viewer"))) return true;
    const folder = await env.DB.prepare("SELECT parent_id as parentId FROM folders WHERE id = ?").bind(current).first();
    current = folder?.parentId || null;
  }
  return false;
}

async function nextVersionNumber(env, fileId) {
  const row = await env.DB.prepare("SELECT COALESCE(MAX(version_number), 0) + 1 as nextVersion FROM file_versions WHERE file_id = ?")
    .bind(fileId)
    .first();
  return row?.nextVersion || 1;
}

function otpCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export default {
  async fetch(request, env) {
    const corsOrigin = getCorsOrigin(request, env);
    if (request.method === "OPTIONS") {
      return text("", {
        status: 204,
        headers: {
          "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
          "access-control-allow-headers": "content-type, authorization",
        },
      }, corsOrigin);
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "");
    const actor = await getActor(request, env);

    try {
      if (request.method === "GET" && path === "/health") {
        return json({ ok: true }, {}, corsOrigin);
      }

      if (request.method === "GET" && path === "/api/me") {
        return json({ user: actor.user, role: actor.role }, {}, corsOrigin);
      }

      if (request.method === "POST" && path === "/api/auth/signup") {
        const body = await request.json();
        const email = String(body.email || "").trim();
        const password = String(body.password || "");
        if (!email || !password) return json({ error: "missing credentials" }, { status: 400 }, corsOrigin);
        const exists = await env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(email).first();
        if (exists) return json({ error: "user exists" }, { status: 409 }, corsOrigin);
        const salt = uuid();
        const hash = await derivePasswordHash(password, salt);
        const role = email === "owner" ? "owner" : "viewer";
        const id = uuid();
        await env.DB.prepare("INSERT INTO users (id, username, password_salt, password_hash, email, mobile, email_verified, mobile_verified, role) VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?)")
          .bind(id, email, salt, hash, email, "", role)
          .run();
        const token = await signSession({ user: email, role }, env);
        return json(
          { user: email, role, sessionToken: token },
          {
            status: 201,
            headers: {
              "set-cookie": sessionCookie(token, url.protocol === "https:"),
            },
          },
          corsOrigin
        );
      }

      if (request.method === "POST" && path === "/api/auth/login") {
        const body = await request.json();
        const email = String(body.email || "").trim();
        const password = String(body.password || "");
        const user = await env.DB.prepare("SELECT username, password_salt as salt, password_hash as hash, role FROM users WHERE username = ?").bind(email).first();
        if (!user) return json({ error: "invalid credentials" }, { status: 401 }, corsOrigin);
        const hash = await derivePasswordHash(password, user.salt);
        if (hash !== user.hash) return json({ error: "invalid credentials" }, { status: 401 }, corsOrigin);
        const token = await signSession({ user: user.username, role: user.role }, env);
        return json(
          { user: user.username, role: user.role, sessionToken: token },
          {
            headers: {
              "set-cookie": sessionCookie(token, url.protocol === "https:"),
            },
          },
          corsOrigin
        );
      }

      if (request.method === "POST" && path === "/api/auth/logout") {
        return json(
          { ok: true },
          {
            headers: {
              "set-cookie": `nova_session=; Path=/; Max-Age=0; HttpOnly; SameSite=None${url.protocol === "https:" ? "; Secure" : ""}`,
            },
          },
          corsOrigin
        );
      }

      if (request.method === "GET" && path === "/api/bootstrap") {
        const folders = await env.DB.prepare("SELECT id, parent_id as parentId, name, created_at as createdAt FROM folders ORDER BY name").all();
        const files = await env.DB.prepare(
          "SELECT id, folder_id as folderId, name, mime_type as mimeType, size_bytes as sizeBytes, r2_key as r2Key, created_at as createdAt, updated_at as updatedAt, starred, shared, trashed, content, permission, share_token as shareToken FROM files ORDER BY created_at DESC"
        ).all();
        const grants = await env.DB.prepare("SELECT id, resource_type as resourceType, resource_id as resourceId, username, role FROM grants").all();
        const sharedDrives = await env.DB.prepare("SELECT id, name, created_by as createdBy, created_at as createdAt FROM shared_drives").all();
        return json({ folders: folders.results, files: files.results, grants: grants.results, sharedDrives: sharedDrives.results }, {}, corsOrigin);
      }

      if (request.method === "GET" && path === "/api/folders") {
        const result = await env.DB.prepare("SELECT id, parent_id as parentId, name, created_at as createdAt FROM folders ORDER BY name").all();
        return json(result.results, {}, corsOrigin);
      }

      if (request.method === "POST" && path === "/api/folders") {
        if (actor.user === "guest") return json({ error: "forbidden" }, { status: 403 }, corsOrigin);
        const body = await request.json();
        const folder = {
          id: body.id || uuid(),
          parentId: body.parentId || "root",
          name: body.name,
        };
        await env.DB.prepare("INSERT INTO folders (id, parent_id, name) VALUES (?, ?, ?)")
          .bind(folder.id, folder.parentId, folder.name)
          .run();
        return json(folder, { status: 201 }, corsOrigin);
      }

      if (request.method === "PUT" && path.startsWith("/api/folders/")) {
        if (actor.user === "guest") return json({ error: "forbidden" }, { status: 403 }, corsOrigin);
        const id = path.split("/").pop();
        const body = await request.json();
        await env.DB.prepare("UPDATE folders SET name = ?, parent_id = ? WHERE id = ?")
          .bind(body.name, body.parentId, id)
          .run();
        return json({ ok: true }, {}, corsOrigin);
      }

      if (request.method === "DELETE" && path.startsWith("/api/folders/")) {
        if (actor.user === "guest") return json({ error: "forbidden" }, { status: 403 }, corsOrigin);
        const id = path.split("/").pop();
        await env.DB.prepare("DELETE FROM folders WHERE id = ?").bind(id).run();
        return json({ ok: true });
      }

      if (request.method === "GET" && path === "/api/files") {
        const folderId = url.searchParams.get("folderId");
        const trashed = url.searchParams.get("trashed");
        if (trashed === "true") {
          const result = await env.DB.prepare(
            "SELECT id, folder_id as folderId, name, mime_type as mimeType, size_bytes as sizeBytes, r2_key as r2Key, created_at as createdAt, updated_at as updatedAt, starred, shared, trashed, content, permission, share_token as shareToken FROM files WHERE trashed = 1 ORDER BY created_at DESC"
          ).all();
          return json(result.results, {}, corsOrigin);
        }
        const query = folderId
          ? "SELECT id, folder_id as folderId, name, mime_type as mimeType, size_bytes as sizeBytes, r2_key as r2Key, created_at as createdAt, updated_at as updatedAt, starred, shared, trashed, content, permission, share_token as shareToken FROM files WHERE folder_id = ? ORDER BY created_at DESC"
          : "SELECT id, folder_id as folderId, name, mime_type as mimeType, size_bytes as sizeBytes, r2_key as r2Key, created_at as createdAt, updated_at as updatedAt, starred, shared, trashed, content, permission, share_token as shareToken FROM files ORDER BY created_at DESC";
        const stmt = folderId ? env.DB.prepare(query).bind(folderId) : env.DB.prepare(query);
        const result = await stmt.all();
        return json(result.results, {}, corsOrigin);
      }

      if (request.method === "GET" && path.startsWith("/api/files/") && path.endsWith("/download")) {
        const id = path.split("/")[3];
        const row = await env.DB.prepare(
          "SELECT id, folder_id as folderId, name, mime_type as mimeType, r2_key as r2Key FROM files WHERE id = ?"
        ).bind(id).first();
        if (!row) return json({ error: "not found" }, { status: 404 }, corsOrigin);
        const grant = await getGrant(env, "file", id, actor.user);
        if (!canDownload(actor) && !(grant && roleRank(grant.role) >= roleRank("manager"))) {
          return json({ error: "forbidden" }, { status: 403 }, corsOrigin);
        }
        const object = await env.FILES.get(row.r2Key);
        if (!object) return json({ error: "not found" }, { status: 404 }, corsOrigin);
        return new Response(object.body, {
          status: 200,
          headers: {
            "content-type": row.mimeType || "application/octet-stream",
            "content-disposition": `attachment; filename="${row.name.replace(/"/g, '\\"')}"`,
            "access-control-allow-origin": corsOrigin,
            "access-control-allow-credentials": "true",
          },
        });
      }

      if (request.method === "GET" && path.startsWith("/api/files/") && path.endsWith("/preview")) {
        const id = path.split("/")[3];
        const row = await env.DB.prepare(
          "SELECT id, folder_id as folderId, name, mime_type as mimeType, r2_key as r2Key FROM files WHERE id = ?"
        ).bind(id).first();
        if (!row) return json({ error: "not found" }, { status: 404 }, corsOrigin);
        const queryActor = await getQueryActor(url, env);
        if (queryActor.user === "guest" && actor.user === "guest") return json({ error: "forbidden" }, { status: 403 }, corsOrigin);
        const object = await env.FILES.get(row.r2Key);
        if (!object) return json({ error: "not found" }, { status: 404 }, corsOrigin);
        return new Response(object.body, {
          status: 200,
          headers: {
            "content-type": row.mimeType || "application/octet-stream",
            "access-control-allow-origin": corsOrigin,
            "access-control-allow-credentials": "true",
          },
        });
      }

      if (request.method === "GET" && path.startsWith("/api/files/")) {
        const id = path.split("/").pop();
        const row = await env.DB.prepare(
          "SELECT id, folder_id as folderId, name, mime_type as mimeType, size_bytes as sizeBytes, r2_key as r2Key, created_at as createdAt, updated_at as updatedAt, starred, shared, trashed, content, permission, share_token as shareToken FROM files WHERE id = ?"
        ).bind(id).first();
        if (!row) return json({ error: "not found" }, { status: 404 }, corsOrigin);
        const grant = await getGrant(env, "file", id, actor.user);
        const folderGrant = await hasFolderGrant(env, row.folderId, actor.user, "viewer");
        if (actor.user === "guest" || (actor.role === "viewer" && !grant && !row.shared && !folderGrant)) return json({ error: "forbidden" }, { status: 403 }, corsOrigin);
        return json(row, {}, corsOrigin);
      }

      if (request.method === "GET" && path.startsWith("/api/share/")) {
        const token = path.split("/").pop();
        const row = await env.DB.prepare(
          "SELECT id, folder_id as folderId, name, mime_type as mimeType, size_bytes as sizeBytes, r2_key as r2Key, created_at as createdAt, updated_at as updatedAt, starred, shared, trashed, content, permission, share_token as shareToken FROM files WHERE share_token = ?"
        ).bind(token).first();
        if (!row) return json({ error: "not found" }, { status: 404 }, corsOrigin);
        return json(row, {}, corsOrigin);
      }

      if (request.method === "POST" && path === "/api/files") {
        if (!canWrite(actor)) return json({ error: "forbidden" }, { status: 403 }, corsOrigin);
        const form = await request.formData();
        const file = form.get("file");
        const folderId = form.get("folderId") || "root";
        if (!(file instanceof File)) return json({ error: "file is required" }, { status: 400 }, corsOrigin);

        const id = uuid();
        const r2Key = `${folderId}/${id}-${file.name}`;
        await env.FILES.put(r2Key, file.stream(), {
          httpMetadata: { contentType: file.type || "application/octet-stream" },
        });

        await env.DB.prepare(
          "INSERT INTO files (id, folder_id, name, mime_type, size_bytes, r2_key, starred, shared, trashed, content, permission, share_token) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, ?, 'view', '')"
        ).bind(id, folderId, file.name, file.type || "application/octet-stream", file.size, r2Key, "").run();

        return json({ id, folderId, name: file.name, mimeType: file.type, sizeBytes: file.size, r2Key }, { status: 201 }, corsOrigin);
      }

      if (request.method === "DELETE" && path.startsWith("/api/files/")) {
        if (!canWrite(actor)) return json({ error: "forbidden" }, { status: 403 }, corsOrigin);
        const id = path.split("/").pop();
        const row = await env.DB.prepare("SELECT r2_key as r2Key FROM files WHERE id = ?").bind(id).first();
        if (!row) return json({ error: "not found" }, { status: 404 }, corsOrigin);
        await env.FILES.delete(row.r2Key);
        await env.DB.prepare("DELETE FROM files WHERE id = ?").bind(id).run();
        return json({ ok: true }, {}, corsOrigin);
      }

      if (request.method === "PUT" && path.startsWith("/api/files/")) {
        const id = path.split("/").pop();
        const body = await request.json();
        const current = await env.DB.prepare("SELECT permission, shared FROM files WHERE id = ?").bind(id).first();
        if (!current) return json({ error: "not found" }, { status: 404 }, corsOrigin);
        const grant = await getGrant(env, "file", id, actor.user);
        if (!canWrite(actor)) return json({ error: "forbidden" }, { status: 403 }, corsOrigin);
        await env.DB.prepare(
          "UPDATE files SET name = COALESCE(?, name), folder_id = COALESCE(?, folder_id), starred = COALESCE(?, starred), shared = COALESCE(?, shared), trashed = COALESCE(?, trashed), content = COALESCE(?, content), permission = COALESCE(?, permission), share_token = COALESCE(?, share_token), updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).bind(body.name ?? null, body.folderId ?? null, body.starred ?? null, body.shared ?? null, body.trashed ?? null, body.content ?? null, body.permission ?? null, body.shareToken ?? null, id).run();
        return json({ ok: true }, {}, corsOrigin);
      }

      if (request.method === "POST" && path === "/api/grants") {
        const body = await request.json();
        if (!body.resourceType || !body.resourceId || !body.username || !body.role) return json({ error: "missing grant fields" }, { status: 400 }, corsOrigin);
        if (!canGrantRole(actor, body.role)) return json({ error: "forbidden" }, { status: 403 }, corsOrigin);
        const id = uuid();
        await env.DB.prepare(
          "INSERT INTO grants (id, resource_type, resource_id, username, role) VALUES (?, ?, ?, ?, ?)"
        ).bind(id, body.resourceType, body.resourceId, body.username, body.role).run();
        return json({ id }, { status: 201 }, corsOrigin);
      }

      if (request.method === "GET" && path === "/api/files/versions") {
        const fileId = url.searchParams.get("fileId");
        const result = await env.DB.prepare(
          "SELECT id, file_id as fileId, version_number as versionNumber, content, created_by as createdBy, created_at as createdAt FROM file_versions WHERE file_id = ? ORDER BY version_number DESC"
        ).bind(fileId).all();
        return json(result.results, {}, corsOrigin);
      }

      if (request.method === "POST" && path === "/api/files/comments") {
        const body = await request.json();
        if (!body.fileId || !body.body) return json({ error: "missing comment fields" }, { status: 400 }, corsOrigin);
        const id = uuid();
        await env.DB.prepare("INSERT INTO comments (id, file_id, username, body) VALUES (?, ?, ?, ?)")
          .bind(id, body.fileId, actor.user, body.body)
          .run();
        return json({ id }, { status: 201 }, corsOrigin);
      }

      if (request.method === "GET" && path === "/api/files/comments") {
        const fileId = url.searchParams.get("fileId");
        const result = await env.DB.prepare(
          "SELECT id, file_id as fileId, username, body, created_at as createdAt FROM comments WHERE file_id = ? ORDER BY created_at ASC"
        ).bind(fileId).all();
        return json(result.results, {}, corsOrigin);
      }

      if (request.method === "POST" && path === "/api/shared-drives") {
        if (!canGrantRole(actor, body.role)) return json({ error: "forbidden" }, { status: 403 }, corsOrigin);
        const body = await request.json();
        const id = uuid();
        await env.DB.prepare("INSERT INTO shared_drives (id, name, created_by) VALUES (?, ?, ?)")
          .bind(id, body.name, actor.user)
          .run();
        return json({ id }, { status: 201 }, corsOrigin);
      }

      if (request.method === "POST" && path === "/api/shared-drives/members") {
        if (!canWrite(actor)) return json({ error: "forbidden" }, { status: 403 }, corsOrigin);
        const body = await request.json();
        const id = uuid();
        await env.DB.prepare("INSERT INTO shared_drive_members (id, shared_drive_id, username, role) VALUES (?, ?, ?, ?)")
          .bind(id, body.sharedDriveId, body.username, body.role || "viewer")
          .run();
        return json({ id }, { status: 201 }, corsOrigin);
      }

      if (request.method === "POST" && path === "/api/files/restore-version") {
        const body = await request.json();
        const version = await env.DB.prepare("SELECT file_id as fileId, content FROM file_versions WHERE file_id = ? AND version_number = ?")
          .bind(body.fileId, body.versionNumber)
          .first();
        if (!version) return json({ error: "not found" }, { status: 404 }, corsOrigin);
        await env.DB.prepare("UPDATE files SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
          .bind(version.content, body.fileId)
          .run();
        return json({ ok: true }, {}, corsOrigin);
      }

      if (request.method === "POST" && path === "/api/files/versions") {
        const body = await request.json();
        if (!body.fileId || typeof body.content !== "string") return json({ error: "missing version fields" }, { status: 400 }, corsOrigin);
        const versionNumber = await nextVersionNumber(env, body.fileId);
        const id = uuid();
        await env.DB.prepare("INSERT INTO file_versions (id, file_id, version_number, content, created_by) VALUES (?, ?, ?, ?, ?)")
          .bind(id, body.fileId, versionNumber, body.content, actor.user)
          .run();
        return json({ id, versionNumber }, { status: 201 }, corsOrigin);
      }

      return json({ error: "not found" }, { status: 404 }, corsOrigin);
    } catch (error) {
      return json({ error: error.message }, { status: 500 }, corsOrigin);
    }
  },
};
