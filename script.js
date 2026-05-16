const STORAGE_KEY = "nova-drive-prototype-v1";
const SESSION_KEY = "nova-drive-session-token";
const isLocalHost =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  window.location.hostname === "::1";
const API_BASE =
  window.NOVA_API_BASE ||
  document.querySelector('meta[name="api-base"]')?.content ||
  (isLocalHost ? "http://127.0.0.1:8787" : window.location.origin);

const defaultState = {
  view: "all",
  sortAsc: true,
  sortMode: "name",
  filterMode: "all",
  search: "",
  currentRole: "viewer",
  currentUser: "guest",
  activeFolderId: "root",
  activeDriveId: null,
  activeFileId: null,
  selectedFileIds: [],
  files: [
    { id: "f1", name: "Brand Guidelines.pdf", type: "PDF", size: "2.4 MB", modified: "Today", folderId: "design", starred: true, shared: true, trashed: false, content: "Brand guidelines draft. Use approved logo, spacing, and typography.", permission: "view", shareToken: "guidelines-1" },
    { id: "f2", name: "Roadmap Q3.xlsx", type: "Sheet", size: "1.1 MB", modified: "Yesterday", folderId: "strategy", starred: false, shared: true, trashed: false, content: "Q3 roadmap milestones and status.", permission: "comment", shareToken: "roadmap-1" },
    { id: "f3", name: "Launch Video.mp4", type: "Video", size: "86 MB", modified: "2 days ago", folderId: "media", starred: true, shared: false, trashed: false, content: "Video preview unavailable in prototype.", permission: "view", shareToken: "" },
    { id: "f4", name: "Meeting Notes.docx", type: "Doc", size: "380 KB", modified: "Today", folderId: "docs", starred: false, shared: false, trashed: false, content: "Meeting notes and action items.", permission: "edit", shareToken: "" },
    { id: "f5", name: "Product Mockup.fig", type: "Design", size: "14 MB", modified: "3 days ago", folderId: "design", starred: true, shared: true, trashed: false, content: "Design mockup preview: header, cards, and detail panel.", permission: "view", shareToken: "mockup-1" },
  ],
  grants: [],
  sharedDrives: [],
  comments: [],
  versions: [],
  folders: [
    { id: "root", name: "All Files", parentId: null, color: "#2f6bff" },
    { id: "design", name: "Design", parentId: "root", color: "#2cc58a" },
    { id: "strategy", name: "Strategy", parentId: "root", color: "#ffbf3c" },
    { id: "media", name: "Media", parentId: "root", color: "#7a5cff" },
    { id: "docs", name: "Docs", parentId: "root", color: "#ff7d4d" },
  ],
};

const els = {
  authScreen: document.getElementById("authScreen"),
  authStatus: document.getElementById("authStatus"),
  storageText: document.getElementById("storageText"),
  storageFill: document.getElementById("storageFill"),
  folderStrip: document.getElementById("folderStrip"),
  treeList: document.getElementById("treeList"),
  treeHomeBtn: document.getElementById("treeHomeBtn"),
  fileGrid: document.getElementById("fileGrid"),
  detailsView: document.getElementById("detailsView"),
  folderCount: document.getElementById("folderCount"),
  fileCount: document.getElementById("fileCount"),
  pageTitle: document.getElementById("pageTitle"),
  pageSubtitle: document.getElementById("pageSubtitle"),
  folderCrumb: document.getElementById("folderCrumb"),
  backBtn: document.getElementById("backBtn"),
  searchInput: document.getElementById("searchInput"),
  dropzone: document.getElementById("dropzone"),
  dropHint: document.getElementById("dropHint"),
  fileInput: document.getElementById("fileInput"),
  sortBtn: document.getElementById("sortBtn"),
  filterBtn: document.getElementById("filterBtn"),
  sortModeBtn: document.getElementById("sortModeBtn"),
  renameBtn: document.getElementById("renameBtn"),
  moveBtn: document.getElementById("moveBtn"),
  deleteBtn: document.getElementById("deleteBtn"),
  previewPane: document.getElementById("previewPane"),
  shareBtn: document.getElementById("shareBtn"),
  shareStatus: document.getElementById("shareStatus"),
  permissionSelect: document.getElementById("permissionSelect"),
  shareLink: document.getElementById("shareLink"),
  inviteUser: document.getElementById("inviteUser"),
  inviteRole: document.getElementById("inviteRole"),
  inviteResource: document.getElementById("inviteResource"),
  inviteBtn: document.getElementById("inviteBtn"),
  driveCount: document.getElementById("driveCount"),
  driveName: document.getElementById("driveName"),
  createDriveBtn: document.getElementById("createDriveBtn"),
  driveList: document.getElementById("driveList"),
  refreshCommentsBtn: document.getElementById("refreshCommentsBtn"),
  commentList: document.getElementById("commentList"),
  commentInput: document.getElementById("commentInput"),
  postCommentBtn: document.getElementById("postCommentBtn"),
  saveVersionBtn: document.getElementById("saveVersionBtn"),
  versionList: document.getElementById("versionList"),
  accessLabel: document.getElementById("accessLabel"),
  authEmail: document.getElementById("authEmail"),
  authPass: document.getElementById("authPass"),
  authEmailSide: document.getElementById("authEmailSide"),
  authPassSide: document.getElementById("authPassSide"),
  signupBtn: document.getElementById("signupBtn"),
  loginBtn: document.getElementById("loginBtn"),
  loginBtnSide: document.getElementById("loginBtnSide"),
  logoutBtn: document.getElementById("logoutBtn"),
  healthStatus: document.getElementById("healthStatus"),
  healthText: document.getElementById("healthText"),
  healthBtn: document.getElementById("healthBtn"),
  contextMenu: document.getElementById("contextMenu"),
  bulkBar: document.getElementById("bulkBar"),
  bulkLabel: document.getElementById("bulkLabel"),
  bulkMoveBtn: document.getElementById("bulkMoveBtn"),
  bulkTrashBtn: document.getElementById("bulkTrashBtn"),
  bulkRestoreBtn: document.getElementById("bulkRestoreBtn"),
  bulkDeleteBtn: document.getElementById("bulkDeleteBtn"),
};

const contextState = {
  type: null,
  id: null,
  x: 0,
  y: 0,
};

const state = loadState();
let useRemote = false;
let isAuthenticated = false;
let sessionToken = localStorage.getItem(SESSION_KEY) || "";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return { ...structuredClone(defaultState), ...parsed };
  } catch {
    return structuredClone(defaultState);
  }
}

function fileFromApi(file) {
  return {
    id: file.id,
    name: file.name,
    type: file.mimeType?.split("/")?.[1]?.toUpperCase() || "File",
    size: `${Math.max(file.sizeBytes / 1024 / 1024, 0.1).toFixed(1)} MB`,
    modified: "Today",
    folderId: file.folderId,
    starred: !!file.starred,
    shared: !!file.shared,
    trashed: !!file.trashed,
    content: file.content || "",
    permission: file.permission || "view",
    shareToken: file.shareToken || "",
    r2Key: file.r2Key,
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function apiFetch(path, options = {}) {
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers = {
    ...(options.headers || {}),
  };
  if (sessionToken) headers.authorization = `Bearer ${sessionToken}`;
  if (!isFormData && !headers["content-type"]) headers["content-type"] = "application/json";
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });
  if (!response.ok) throw new Error(`API ${response.status}`);
  return response;
}

function bytesFromSize(size) {
  const match = /^([\d.]+)\s*(KB|MB|GB)$/i.exec(size);
  if (!match) return 0;
  const value = Number(match[1]);
  const unit = match[2].toUpperCase();
  return unit === "GB" ? value * 1024 : unit === "MB" ? value : value / 1024;
}

function iconColor(type) {
  const colors = { PDF: "#2f6bff", Sheet: "#2cc58a", Video: "#ff7d4d", Doc: "#7a5cff", Design: "#ffbf3c" };
  return colors[type] || "#64748b";
}

function folderIcon(name) {
  return name.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase();
}

function getFolderById(id) {
  return state.folders.find((folder) => folder.id === id);
}

function getChildren(folderId) {
  return state.folders.filter((folder) => folder.parentId === folderId);
}

function getFolderDepth(folderId) {
  let depth = 0;
  let current = getFolderById(folderId);
  while (current?.parentId) {
    depth += 1;
    current = getFolderById(current.parentId);
  }
  return depth;
}

function getPath(folderId) {
  const path = [];
  let current = getFolderById(folderId);
  while (current) {
    path.unshift(current);
    current = current.parentId ? getFolderById(current.parentId) : null;
  }
  return path;
}

function getParentOptions(excludeId = null) {
  return state.folders.filter((folder) => folder.id !== excludeId).map((folder) => `${folder.id}: ${folder.name}`).join("\n");
}

function syncSelection() {
  state.selectedFileIds = state.selectedFileIds.filter((id) => state.files.some((file) => file.id === id));
  if (state.selectedFileIds.length === 1) state.activeFileId = state.selectedFileIds[0];
}

function canEditFile(file) {
  return ["owner", "manager", "editor"].includes(state.currentRole) || file?.permission === "edit";
}

function canDownloadFile(file) {
  return ["owner", "manager"].includes(state.currentRole) || file?.permission === "download";
}

function canManageAccess() {
  return ["owner", "manager"].includes(state.currentRole);
}

function canCreateContent() {
  return ["owner", "manager", "editor"].includes(state.currentRole);
}

function getVisibleFiles() {
  return [...state.files]
    .filter((file) => {
      const inSearch =
        !state.search ||
        file.name.toLowerCase().includes(state.search) ||
        file.type.toLowerCase().includes(state.search);
      const inView =
        state.view === "all" ||
        (state.view === "starred" && file.starred) ||
        (state.view === "shared" && file.shared) ||
        (state.view === "recent" && ["Today", "Yesterday", "2 days ago"].includes(file.modified)) ||
        (state.view === "trash" && file.trashed);
      const passesFilter =
        state.filterMode === "all" ||
        (state.filterMode === "docs" && ["PDF", "Doc", "Sheet"].includes(file.type)) ||
        (state.filterMode === "media" && ["Video", "Image", "Design"].includes(file.type)) ||
        (state.filterMode === "shared" && file.shared);
      if (state.view !== "trash" && file.trashed) return false;
      const inFolder = state.activeFolderId === "root" || file.folderId === state.activeFolderId;
      return inSearch && inView && inFolder && passesFilter;
    })
    .sort((a, b) => {
      const dir = state.sortAsc ? 1 : -1;
      if (state.sortMode === "modified") return dir * a.modified.localeCompare(b.modified);
      if (state.sortMode === "type") return dir * a.type.localeCompare(b.type);
      return dir * a.name.localeCompare(b.name);
    });
}

function getActivityFeed() {
  const comments = (state.comments || []).map((item) => ({
    kind: "comment",
    title: item.username,
    body: item.body,
    stamp: item.createdAt || "",
  }));
  const versions = (state.versions || []).map((item) => ({
    kind: "version",
    title: `Version ${item.versionNumber}`,
    body: item.createdBy || "Snapshot saved",
    stamp: item.createdAt || "",
  }));
  return [...comments, ...versions].sort((a, b) => String(b.stamp).localeCompare(String(a.stamp)));
}

function updateFolderCounts() {
  for (const folder of state.folders) {
    folder.count = folder.id === "root" ? state.files.length : state.files.filter((file) => file.folderId === folder.id).length;
  }
}

function render() {
  syncSelection();
  updateFolderCounts();
  const visibleFiles = getVisibleFiles();
  const visibleFolders = getChildren(state.activeFolderId);
  const activityFeed = getActivityFeed();
  const storageUsedMb = state.files.reduce((sum, file) => sum + bytesFromSize(file.size), 0);
  const storageUsedGb = storageUsedMb / 1024;
  const storagePercent = Math.min((storageUsedMb / (15 * 1024)) * 100, 100);
  const activeFolder = getFolderById(state.activeFolderId) || getFolderById("root");
  const path = getPath(state.activeFolderId);

  els.storageText.textContent = `${storageUsedGb.toFixed(1)} GB of 15 GB`;
  els.storageFill.style.width = `${storagePercent}%`;
  els.folderCount.textContent = `${visibleFolders.length} folders`;
  els.fileCount.textContent = `${visibleFiles.length} files`;
  els.pageTitle.textContent =
    state.view === "shared-drives" ? "Shared drives" :
    state.view === "activity" ? "Activity" :
    activeFolder?.name || "My Drive";
  els.pageSubtitle.textContent =
    state.view === "shared-drives"
      ? "Browse team spaces and jump into the drive you need."
      : state.view === "activity"
        ? "Track comments and version snapshots across your files."
        : state.activeFolderId === "root"
          ? "Browse folders, create new files, and keep everything persisted in the browser."
          : `Inside ${activeFolder?.name || "folder"} - create files here or open a subfolder.`;
  els.folderCrumb.textContent = `Current folder: ${path.map((item) => item.name).join(" / ") || "All Files"}`;
  els.backBtn.disabled = state.activeFolderId === "root";
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === state.view));

  els.folderStrip.innerHTML = state.view === "shared-drives"
    ? state.sharedDrives
        .map(
          (drive) => `
            <div class="folder-card ${drive.id === state.activeDriveId ? "active" : ""}" data-drive="${drive.id}">
              <div class="folder-top">
                <div class="folder-icon" style="background:#7a5cff">${folderIcon(drive.name)}</div>
                <strong>${drive.name}</strong>
                <span>Drive</span>
              </div>
              <div class="folder-meta">Created by ${drive.createdBy}</div>
            </div>
          `
        )
        .join("") || `<div class="file-meta">No shared drives yet.</div>`
    : state.view === "activity"
      ? activityFeed
          .map(
            (item) => `
              <div class="folder-card" data-activity="${item.kind}">
                <div class="folder-top">
                  <div class="folder-icon" style="background:${item.kind === "comment" ? "#2cc58a" : "#2f6bff"}">${item.kind === "comment" ? "C" : "V"}</div>
                  <strong>${item.title}</strong>
                  <span>${item.stamp || ""}</span>
                </div>
                <div class="folder-meta">${item.body}</div>
              </div>
            `
          )
          .join("") || `<div class="file-meta">No activity yet.</div>`
      : visibleFolders
    .map(
      (folder) => `
        <div class="folder-card ${folder.id === state.activeFolderId ? "active" : ""}" data-folder="${folder.id}">
          <div class="folder-top">
            <div class="folder-icon" style="background:${folder.color}">${folderIcon(folder.name)}</div>
            <strong>${folder.name}</strong>
            <span>${folder.count || 0}</span>
            <button class="folder-menu-btn" type="button" data-folder-menu="${folder.id}">⋮</button>
          </div>
          <div class="folder-meta">Open folder</div>
        </div>
      `
    )
    .join("") || `<div class="file-meta">No subfolders here yet.</div>`;

  els.treeList.innerHTML = state.folders
    .filter((folder) => folder.id !== "root")
    .map((folder) => {
      const depth = getFolderDepth(folder.id);
      return `
        <div class="tree-item ${folder.id === state.activeFolderId ? "active" : ""}" data-tree-folder="${folder.id}" style="margin-left:${depth * 10}px">
          <div class="tree-name"><span class="folder-icon" style="width:28px;height:28px;border-radius:10px;background:${folder.color}">${folderIcon(folder.name)}</span><span>${folder.name}</span></div>
          <button class="tree-menu-btn" type="button" data-tree-menu="${folder.id}">⋮</button>
        </div>
      `;
    })
    .join("") || `<div class="file-meta">No folders yet.</div>`;

  els.fileGrid.innerHTML = state.view === "shared-drives"
    ? `<div class="file-meta">Select a drive from the list to view details.</div>`
    : state.view === "activity"
      ? `<div class="file-meta">Activity is shown in the folder strip above. Open a file to see comments and versions.</div>`
      : visibleFiles
    .map(
      (file) => `
        <article class="file-card ${file.id === state.activeFileId ? "active" : ""} ${state.selectedFileIds.includes(file.id) ? "selected" : ""}" data-file="${file.id}" draggable="true">
          <input class="file-check" type="checkbox" data-select-file="${file.id}" ${state.selectedFileIds.includes(file.id) ? "checked" : ""} />
          <div class="file-icon" style="background:${iconColor(file.type)}">${file.type[0]}</div>
          <div class="file-title">${file.name}</div>
          <div class="file-row">
            <span>${file.type}</span>
            <span>${file.size}</span>
          </div>
          <div class="file-meta">${getFolderById(file.folderId)?.name || "Unknown"} &middot; ${file.modified}</div>
        </article>
      `
    )
    .join("") || `<div class="file-meta">No files match the current filter.</div>`;

  const activeFile = state.files.find((file) => file.id === state.activeFileId) || visibleFiles[0];
  if (activeFile) state.activeFileId = activeFile.id;
  els.deleteBtn.textContent = state.view === "trash" ? "Delete Forever" : "Trash";
  const hasSelection = state.selectedFileIds.length > 0;
  els.bulkBar.hidden = !hasSelection;
  els.bulkLabel.textContent = `${state.selectedFileIds.length} selected`;
  els.renameBtn.disabled = hasSelection || !canEditFile(activeFile);
  els.moveBtn.disabled = hasSelection || !canEditFile(activeFile);
  els.deleteBtn.disabled = hasSelection || (!activeFile && state.activeFolderId === "root") || !canEditFile(activeFile);
  els.bulkRestoreBtn.hidden = state.view !== "trash";
  els.bulkTrashBtn.hidden = state.view === "trash";
  els.bulkDeleteBtn.hidden = state.view !== "trash";
  els.sortModeBtn.textContent = state.sortMode === "name" ? "Name" : state.sortMode === "modified" ? "Modified" : "Type";
  els.filterBtn.textContent = state.filterMode === "all" ? "Filters" : `Filter: ${state.filterMode}`;
  els.accessLabel.textContent = `${state.currentUser} (${state.currentRole})`;
  els.driveCount.textContent = `${state.sharedDrives.length}`;
  els.driveList.innerHTML = state.sharedDrives.map((drive) => `<button class="detail-item" type="button" data-drive="${drive.id}"><div class="detail-label">${drive.name}</div><div class="detail-value">Created by ${drive.createdBy}</div></button>`).join("") || `<div class="detail-item"><div class="detail-label">Empty</div><div class="detail-value">No shared drives yet.</div></div>`;
  els.commentList.innerHTML = state.comments.map((comment) => `<div class="detail-item"><div class="detail-label">${comment.username}</div><div class="detail-value">${comment.body}</div></div>`).join("") || `<div class="detail-item"><div class="detail-label">Empty</div><div class="detail-value">No comments yet.</div></div>`;
  els.versionList.innerHTML = state.versions.map((version) => `<div class="detail-item"><div class="detail-label">Version ${version.versionNumber}</div><div class="detail-value">${version.createdAt || ""}</div></div>`).join("") || `<div class="detail-item"><div class="detail-label">Empty</div><div class="detail-value">No versions yet.</div></div>`;
  els.previewPane.innerHTML = activeFile
    ? `
      <div class="preview-title">${activeFile.name}</div>
      <div class="preview-meta">${activeFile.type} · ${activeFile.modified} · ${getFolderById(activeFile.folderId)?.name || "Unknown"}</div>
      ${
        ["PDF", "Doc", "Sheet"].includes(activeFile.type)
          ? `<textarea id="previewEditor" class="preview-editor">${activeFile.content || ""}</textarea><button class="secondary-btn preview-save" id="previewSaveBtn" type="button">Save Content</button>`
          : `<div>${activeFile.content || "No preview content available."}</div>`
      }
    `
    : `<div class="preview-empty">Select a file to preview its content here.</div>`;
  els.shareStatus.textContent = activeFile
    ? activeFile.shared
      ? `Shared with permission: ${activeFile.permission || "view"}`
      : "Not shared"
    : "Not shared";
  els.permissionSelect.value = activeFile?.permission || "view";
  els.shareLink.value = activeFile?.shareToken ? `${location.origin}/share/${activeFile.shareToken}` : "";
  els.inviteUser.disabled = !activeFile && state.activeFolderId === "root";
  els.inviteRole.disabled = !activeFile && state.activeFolderId === "root";
  els.inviteResource.value = state.activeFolderId === "root" ? "file" : "folder";
  els.inviteBtn.disabled = !activeFile && state.activeFolderId === "root";
  document.getElementById("uploadBtn").disabled = !canCreateContent();
  document.getElementById("createDocBtn").disabled = !canCreateContent();
  document.getElementById("newFileBtn").disabled = !canCreateContent();
  document.getElementById("newFolderBtn").disabled = !canCreateContent();
  els.shareBtn.disabled = !canManageAccess();
  els.permissionSelect.disabled = !canManageAccess();
  els.inviteBtn.disabled = !canManageAccess() && !activeFile && state.activeFolderId === "root";
  els.inviteRole.disabled = !canManageAccess() && !activeFile && state.activeFolderId === "root";

  els.detailsView.innerHTML = activeFile
    ? `
      <div class="detail-item"><div class="detail-label">Name</div><div class="detail-value">${activeFile.name}</div></div>
      <div class="detail-item"><div class="detail-label">Type</div><div class="detail-value">${activeFile.type}</div></div>
      <div class="detail-item"><div class="detail-label">Folder</div><div class="detail-value">${getFolderById(activeFile.folderId)?.name || "Unknown"}</div></div>
      <div class="detail-item"><div class="detail-label">Modified</div><div class="detail-value">${activeFile.modified}</div></div>
      <div class="detail-item"><div class="detail-label">Size</div><div class="detail-value">${activeFile.size}</div></div>
      <div class="detail-item"><div class="detail-label">Shared</div><div class="detail-value">${activeFile.shared ? "Yes" : "No"}</div></div>
      <div class="detail-item"><div class="detail-label">Trash</div><div class="detail-value">${activeFile.trashed ? "In Trash" : "Active"}</div></div>
    `
    : `<div class="detail-item"><div class="detail-label">Empty</div><div class="detail-value">Select a file to see details.</div></div>`;

  saveState();
  hideContextMenu();
}

function showContextMenu(type, id, x, y) {
  contextState.type = type;
  contextState.id = id;
  contextState.x = x;
  contextState.y = y;
  els.contextMenu.hidden = false;
  els.contextMenu.style.left = `${Math.min(x, window.innerWidth - 200)}px`;
  els.contextMenu.style.top = `${Math.min(y, window.innerHeight - 240)}px`;
  const isTrash = state.view === "trash";
  els.contextMenu.querySelector('[data-action="download"]').hidden = type !== "file" || !canDownloadFile(state.files.find((item) => item.id === id));
  els.contextMenu.querySelector('[data-action="trash"]').hidden = isTrash;
  els.contextMenu.querySelector('[data-action="restore"]').hidden = !isTrash;
  els.contextMenu.querySelector('[data-action="delete"]').hidden = !isTrash;
}

function hideContextMenu() {
  els.contextMenu.hidden = true;
  contextState.type = null;
  contextState.id = null;
}

function openFolderMenu(folderId, x = 0, y = 0) {
  contextState.type = "folder";
  contextState.id = folderId;
  contextState.x = x;
  contextState.y = y;
  els.contextMenu.hidden = false;
  els.contextMenu.style.left = `${Math.min(x || 24, window.innerWidth - 220)}px`;
  els.contextMenu.style.top = `${Math.min(y || 24, window.innerHeight - 280)}px`;
  const isTrash = state.view === "trash";
  els.contextMenu.querySelector('[data-action="download"]').hidden = true;
  els.contextMenu.querySelector('[data-action="trash"]').hidden = isTrash;
  els.contextMenu.querySelector('[data-action="restore"]').hidden = !isTrash;
  els.contextMenu.querySelector('[data-action="delete"]').hidden = !isTrash;
}

async function persistFileUpdate(id, patch) {
  if (!useRemote) {
    const file = state.files.find((item) => item.id === id);
    if (file) Object.assign(file, patch);
    render();
    return;
  }
  await apiFetch(`/api/files/${id}`, { method: "PUT", body: JSON.stringify(patch) });
  await loadRemoteState();
}

async function persistFolderUpdate(id, patch) {
  if (!useRemote) {
    const folder = state.folders.find((item) => item.id === id);
    if (folder) Object.assign(folder, patch);
    render();
    return;
  }
  await apiFetch(`/api/folders/${id}`, { method: "PUT", body: JSON.stringify(patch) });
  await loadRemoteState();
}

async function refreshFileThreads(fileId) {
  const [commentsRes, versionsRes] = await Promise.all([
    apiFetch(`/api/files/comments?fileId=${encodeURIComponent(fileId)}`).then((r) => r.json()),
    apiFetch(`/api/files/versions?fileId=${encodeURIComponent(fileId)}`).then((r) => r.json()),
  ]);
  state.comments = commentsRes || [];
  state.versions = versionsRes || [];
  render();
}

async function loadRemoteState() {
  try {
    const me = await apiFetch("/api/me").then((r) => r.json());
    state.currentUser = me.user || "guest";
    state.currentRole = me.role || "viewer";
    isAuthenticated = !!me.user && me.user !== "guest";
    if (!isAuthenticated) {
      throw new Error("Not signed in.");
    }
    useRemote = true;
    if (els.authStatus) els.authStatus.textContent = `Signed in as ${state.currentUser}.`;
  } catch (error) {
    useRemote = false;
    showAuth(error.message || "Unable to load your account. Please sign in again.");
  }
}

async function loadDriveData() {
  try {
    const response = await apiFetch("/api/bootstrap");
    const data = await response.json();
    state.folders = data.folders.length ? data.folders : structuredClone(defaultState.folders);
    state.files = (data.files || []).map(fileFromApi);
    state.grants = data.grants || [];
    state.sharedDrives = data.sharedDrives || [];
    useRemote = true;
    render();
  } catch (error) {
    if (els.authStatus) els.authStatus.textContent = error.message || "Signed in, but drive data could not be loaded.";
  }
}

async function checkHealth() {
  try {
    const result = await fetch(`${API_BASE}/health`).then((r) => r.json());
    const ok = !!result?.ok;
    els.healthStatus.textContent = ok ? "online" : "degraded";
    els.healthText.textContent = ok ? "Worker API is reachable." : "Worker API responded, but not healthy.";
  } catch {
    els.healthStatus.textContent = "offline";
    els.healthText.textContent = "Worker API could not be reached.";
  }
}

async function debugAuthProbe() {
  try {
    const me = await apiFetch("/api/me").then((r) => r.json());
    if (els.authStatus) els.authStatus.textContent = `API says you are ${me.user || "guest"} (${me.role || "viewer"}).`;
  } catch (error) {
    if (els.authStatus) els.authStatus.textContent = error.message || "Auth probe failed.";
  }
}

function getAuthValues() {
  const email = (els.authEmail?.value || els.authEmailSide?.value || "").trim();
  const password = els.authPass?.value || els.authPassSide?.value || "";
  return { email, password };
}

function syncAuthInputs(email, password) {
  if (els.authEmail) els.authEmail.value = email;
  if (els.authEmailSide) els.authEmailSide.value = email;
  if (els.authPass) els.authPass.value = password;
  if (els.authPassSide) els.authPassSide.value = password;
}

function showApp() {
  isAuthenticated = true;
  if (els.authScreen) els.authScreen.hidden = true;
}

function showAuth(message = "Sign in to continue.") {
  isAuthenticated = false;
  if (els.authStatus) els.authStatus.textContent = message;
  if (els.authScreen) els.authScreen.hidden = false;
}

function createFile(name, folderId) {
  const extension = name.includes(".") ? name.split(".").pop().toUpperCase() : "TXT";
  const folder = getFolderById(folderId) || getFolderById("root");
  const id = `f${Date.now()}`;
  state.files.unshift({
    id,
    name,
    type: extension,
    size: "12 KB",
    modified: "Today",
    folderId: folder.id,
    starred: false,
    shared: false,
    trashed: false,
  });
  state.activeFileId = id;
  state.selectedFileIds = [id];
  state.activeFolderId = folder.id;
  render();
}

function createFolder(parentId) {
  const name = prompt("Folder name:", "New Folder");
  if (!name) return;
  const id = `${name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;
  state.folders.push({
    id,
    name,
    parentId,
    color: "#2f6bff",
  });
  state.activeFolderId = id;
  render();
}

async function createRemoteFolder(name, parentId) {
  const response = await apiFetch("/api/folders", {
    method: "POST",
    body: JSON.stringify({ name, parentId }),
  });
  return response.json().catch(() => ({}));
}

async function uploadRemoteFiles(files, folderId) {
  const uploads = [...files].map((file) => {
    const form = new FormData();
    form.append("file", file);
    form.append("folderId", folderId);
    return apiFetch("/api/files", { method: "POST", body: form });
  });
  await Promise.all(uploads);
}

document.addEventListener("click", (event) => {
  if (!event.target.closest("#contextMenu")) hideContextMenu();
  const folderMenuBtn = event.target.closest("[data-folder-menu], [data-tree-menu]");
  if (folderMenuBtn) {
    event.stopPropagation();
    openFolderMenu(folderMenuBtn.dataset.folderMenu || folderMenuBtn.dataset.treeMenu, event.clientX, event.clientY);
    return;
  }
  const nav = event.target.closest(".nav-item");
  if (nav) {
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
    nav.classList.add("active");
    state.view = nav.dataset.view;
    if (state.view === "trash") state.activeFolderId = "root";
    if (state.view === "shared-drives" || state.view === "activity") state.activeFolderId = "root";
    render();
    return;
  }

  const drive = event.target.closest("[data-drive]");
  if (drive) {
    state.activeDriveId = drive.dataset.drive;
    state.view = "shared-drives";
    render();
    return;
  }

  const folder = event.target.closest("[data-folder]");
  if (folder) {
    if (state.view === "shared-drives" || state.view === "activity") return;
    state.activeFolderId = folder.dataset.folder;
    render();
    return;
  }

  const treeFolder = event.target.closest("[data-tree-folder]");
  if (treeFolder) {
    if (state.view === "shared-drives" || state.view === "activity") return;
    state.activeFolderId = treeFolder.dataset.treeFolder;
    render();
    return;
  }

  const crumb = event.target.closest("[data-crumb]");
  if (crumb) {
    state.activeFolderId = crumb.dataset.crumb;
    render();
    return;
  }

  const file = event.target.closest("[data-file]");
  if (file) {
    state.activeFileId = file.dataset.file;
    if (!event.metaKey && !event.ctrlKey) state.selectedFileIds = [file.dataset.file];
    render();
  }
});

document.addEventListener("contextmenu", (event) => {
  const file = event.target.closest("[data-file]");
  const folder = event.target.closest("[data-tree-folder], [data-folder]");
  if (!file && !folder) return;
  event.preventDefault();
  const target = file || folder;
  showContextMenu(file ? "file" : "folder", target.dataset.file || target.dataset.treeFolder || target.dataset.folder, event.clientX, event.clientY);
});

els.contextMenu.addEventListener("click", async (event) => {
  const action = event.target.closest("button")?.dataset.action;
  if (!action || !contextState.id) return;
  const file = state.files.find((item) => item.id === contextState.id);
  const folder = getFolderById(contextState.id);

  if (action === "open") {
    if (file) state.activeFileId = file.id;
    if (folder) state.activeFolderId = folder.id;
    render();
    return;
  }

  if (action === "download" && file) {
    try {
      const response = await apiFetch(`/api/files/${file.id}/download`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      showAuth(error.message || "Download failed.");
    }
    hideContextMenu();
    return;
  }

  if (action === "rename") {
    if (file) {
      const name = prompt("Rename file:", file.name);
      if (name) await persistFileUpdate(file.id, { name });
    } else if (folder && folder.id !== "root") {
      const name = prompt("Rename folder:", folder.name);
      if (name) await persistFolderUpdate(folder.id, { name, parentId: folder.parentId });
    }
    hideContextMenu();
    return;
  }

  if (action === "new-subfolder" && folder) {
    const name = prompt("Subfolder name:", "New Folder");
    if (name) {
      try {
        await createRemoteFolder(name, folder.id);
        await loadDriveData();
      } catch (error) {
        showAuth(error.message || "Failed to create subfolder.");
      }
    }
    hideContextMenu();
    return;
  }

  if (action === "move" && file) {
    const choice = prompt(`Move to folder id:\n${getParentOptions(file.folderId)}`, file.folderId);
    if (choice) {
      const target = choice.split(":")[0].trim();
      if (getFolderById(target)) await persistFileUpdate(file.id, { folderId: target });
    }
    hideContextMenu();
    return;
  }

  if (action === "trash" && file) {
    await persistFileUpdate(file.id, { trashed: true });
    hideContextMenu();
    return;
  }

  if (action === "share" && folder) {
    const name = prompt("Share label:", folder.name);
    if (name) {
      await apiFetch("/api/shared-drives", {
        method: "POST",
        body: JSON.stringify({ name }),
      }).catch(() => {});
    }
    hideContextMenu();
    return;
  }

  if (action === "access" && folder) {
    const username = prompt("Grant access to username/email:", "");
    const role = prompt("Role (viewer/editor/manager):", "viewer");
    if (username && role) {
      await apiFetch("/api/grants", {
        method: "POST",
        body: JSON.stringify({
          resourceType: "folder",
          resourceId: folder.id,
          username,
          role,
        }),
      });
      await loadRemoteState();
    }
    hideContextMenu();
    return;
  }

  if (action === "restore" && file) {
    await persistFileUpdate(file.id, { trashed: false });
    hideContextMenu();
    return;
  }

  if (action === "delete" && file) {
    if (confirm(`Delete file "${file.name}" forever?`)) {
      if (useRemote) {
        await apiFetch(`/api/files/${file.id}`, { method: "DELETE" });
        await loadRemoteState();
      } else {
        state.files = state.files.filter((item) => item.id !== file.id);
        state.activeFileId = null;
        render();
      }
    }
    hideContextMenu();
  }
});

els.backBtn.addEventListener("click", () => {
  const current = getFolderById(state.activeFolderId);
  if (current?.parentId) {
    state.activeFolderId = current.parentId;
    render();
  }
});

els.treeHomeBtn.addEventListener("click", () => {
  state.activeFolderId = "root";
  render();
});

els.folderCrumb.addEventListener("click", () => {
  const path = getPath(state.activeFolderId);
  if (path.length > 1) {
    const parent = path[path.length - 2];
    state.activeFolderId = parent.id;
    render();
  }
});

document.getElementById("sortBtn").addEventListener("click", () => {
  state.sortAsc = !state.sortAsc;
  els.sortBtn.textContent = state.sortAsc ? "Sort by Name" : "Sort by Name Desc";
  render();
});

els.sortModeBtn.addEventListener("click", () => {
  state.sortMode = state.sortMode === "name" ? "modified" : state.sortMode === "modified" ? "type" : "name";
  render();
});

els.filterBtn.addEventListener("click", () => {
  state.filterMode = state.filterMode === "all" ? "docs" : state.filterMode === "docs" ? "media" : state.filterMode === "media" ? "shared" : "all";
  render();
});

document.getElementById("createDocBtn").addEventListener("click", () => {
  const name = prompt("Document name:", "Untitled Doc.txt");
  if (!name) return;
  if (!canCreateContent()) return showAuth("Editor access required to create documents.");
  if (!useRemote) return createFile(name, state.activeFolderId);
  const file = new File([name], name, { type: "text/plain" });
  const form = new FormData();
  form.append("file", file);
  form.append("folderId", state.activeFolderId);
  apiFetch("/api/files", { method: "POST", body: form })
    .then(() => loadDriveData())
    .catch((error) => {
      showAuth(error.message || "Failed to create document.");
    });
});

document.getElementById("newFileBtn").addEventListener("click", () => {
  const name = prompt("File name:", "New File.txt");
  if (!name) return;
  if (!canCreateContent()) return showAuth("Editor access required to upload files.");
  if (!useRemote) return createFile(name, state.activeFolderId);
  const file = new File([name], name, { type: "text/plain" });
  const form = new FormData();
  form.append("file", file);
  form.append("folderId", state.activeFolderId);
  apiFetch("/api/files", { method: "POST", body: form })
    .then(() => loadDriveData())
    .catch((error) => {
      showAuth(error.message || "Failed to upload file.");
    });
});

document.getElementById("newFolderBtn").addEventListener("click", () => {
  const name = prompt("Folder name:", "New Folder");
  if (!name) return;
  if (!canCreateContent()) return showAuth("Editor access required to create folders.");
  if (!useRemote) return createFolder(state.activeFolderId);
  createRemoteFolder(name, state.activeFolderId)
    .then(() => loadDriveData())
    .catch((error) => {
      showAuth(error.message || "Failed to create folder.");
    });
});

els.renameBtn.addEventListener("click", async () => {
  const file = state.files.find((item) => item.id === state.activeFileId);
  const folder = getFolderById(state.activeFolderId);
  if (file) {
    const name = prompt("Rename file:", file.name);
    if (!name) return;
    await persistFileUpdate(file.id, { name });
    return;
  }
  if (folder && folder.id !== "root") {
    const name = prompt("Rename folder:", folder.name);
    if (!name) return;
    await persistFolderUpdate(folder.id, { name, parentId: folder.parentId });
  }
});

els.moveBtn.addEventListener("click", async () => {
  const file = state.files.find((item) => item.id === state.activeFileId);
  if (!file) return;
  const choice = prompt(`Move to folder id:\n${getParentOptions(file.folderId)}`, file.folderId);
  if (!choice) return;
  const target = choice.split(":")[0].trim();
  if (!getFolderById(target)) return;
  await persistFileUpdate(file.id, { folderId: target });
});

els.shareBtn.addEventListener("click", async () => {
  const file = state.files.find((item) => item.id === state.activeFileId);
  if (!file) return;
  file.shared = true;
  file.permission = els.permissionSelect.value;
  file.shareToken = file.shareToken || `${file.id}-${Date.now()}`;
  await persistFileUpdate(file.id, { shared: true, permission: file.permission, shareToken: file.shareToken });
  render();
});

els.inviteBtn.addEventListener("click", async () => {
  const file = state.files.find((item) => item.id === state.activeFileId);
  const folder = getFolderById(state.activeFolderId);
  if (!file && !folder) return;
  const username = els.inviteUser.value.trim();
  const role = els.inviteRole.value;
  const resourceType = els.inviteResource.value;
  if (!username) return;
  await apiFetch("/api/grants", {
    method: "POST",
    body: JSON.stringify({
      resourceType,
      resourceId: resourceType === "folder" ? folder.id : file.id,
      username,
      role,
    }),
  });
  await loadRemoteState();
});

els.createDriveBtn.addEventListener("click", async () => {
  const name = els.driveName.value.trim();
  if (!name) return;
  await apiFetch("/api/shared-drives", { method: "POST", body: JSON.stringify({ name }) });
  await loadRemoteState();
});

els.postCommentBtn.addEventListener("click", async () => {
  const file = state.files.find((item) => item.id === state.activeFileId);
  const body = els.commentInput.value.trim();
  if (!file || !body) return;
  await apiFetch("/api/files/comments", { method: "POST", body: JSON.stringify({ fileId: file.id, body }) });
  els.commentInput.value = "";
  await refreshFileThreads(file.id);
});

els.refreshCommentsBtn.addEventListener("click", async () => {
  const file = state.files.find((item) => item.id === state.activeFileId);
  if (!file) return;
  await refreshFileThreads(file.id);
});

els.saveVersionBtn.addEventListener("click", async () => {
  const file = state.files.find((item) => item.id === state.activeFileId);
  const editor = document.getElementById("previewEditor");
  if (!file || !editor) return;
  file.content = editor.value;
  await persistFileUpdate(file.id, { content: editor.value });
  await apiFetch("/api/files/versions", {
    method: "POST",
    body: JSON.stringify({ fileId: file.id, content: editor.value }),
  });
  await refreshFileThreads(file.id);
});

els.permissionSelect.addEventListener("change", async () => {
  const file = state.files.find((item) => item.id === state.activeFileId);
  if (!file) return;
  file.permission = els.permissionSelect.value;
  await persistFileUpdate(file.id, { shared: file.shared, permission: file.permission });
  render();
});

els.signupBtn.addEventListener("click", async () => {
  const { email, password } = getAuthValues();
  if (!email || !password) return;
  els.authStatus.textContent = "Creating account...";
  try {
    const response = await fetch(`${API_BASE}/api/auth/signup`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Signup failed (${response.status})`);
    if (data.sessionToken) {
      sessionToken = data.sessionToken;
      localStorage.setItem(SESSION_KEY, sessionToken);
    }
    syncAuthInputs(email, password);
    showApp();
    await debugAuthProbe();
    await loadRemoteState();
    await loadDriveData();
  } catch (error) {
    showAuth(error.message || "Signup failed.");
  }
});

els.loginBtn.addEventListener("click", async () => {
  const { email, password } = getAuthValues();
  if (!email || !password) return;
  els.authStatus.textContent = "Signing in...";
  try {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Login failed (${response.status})`);
    if (data.sessionToken) {
      sessionToken = data.sessionToken;
      localStorage.setItem(SESSION_KEY, sessionToken);
    }
    syncAuthInputs(email, password);
    showApp();
    await debugAuthProbe();
    await loadRemoteState();
    await loadDriveData();
  } catch (error) {
    showAuth(error.message || "Login failed.");
  }
});

els.verifyEmailBtn?.addEventListener("click", async () => {
  const { username } = getAuthValues();
  const otp = els.verifyEmailOtp?.value?.trim();
  if (!username || !otp) return;
  const response = await fetch(`${API_BASE}/api/auth/verify`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: sessionToken ? `Bearer ${sessionToken}` : "" },
    body: JSON.stringify({ username, channel: "email", otp }),
  });
  const data = await response.json().catch(() => ({}));
  if (els.otpStatus) els.otpStatus.textContent = response.ok ? "Email verified." : data.error || "Email verification failed.";
});

els.verifyMobileBtn?.addEventListener("click", async () => {
  const { username } = getAuthValues();
  const otp = els.verifyMobileOtp?.value?.trim();
  if (!username || !otp) return;
  const response = await fetch(`${API_BASE}/api/auth/verify`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: sessionToken ? `Bearer ${sessionToken}` : "" },
    body: JSON.stringify({ username, channel: "mobile", otp }),
  });
  const data = await response.json().catch(() => ({}));
  if (els.otpStatus) els.otpStatus.textContent = response.ok ? "Mobile verified." : data.error || "Mobile verification failed.";
});

els.loginBtnSide?.addEventListener("click", () => els.loginBtn.click());

els.logoutBtn.addEventListener("click", async () => {
  await fetch(`${API_BASE}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
    headers: sessionToken ? { authorization: `Bearer ${sessionToken}` } : {},
  });
  state.currentUser = "guest";
  state.currentRole = "viewer";
  sessionToken = "";
  localStorage.removeItem(SESSION_KEY);
  showAuth("Signed out.");
});

els.healthBtn.addEventListener("click", checkHealth);

document.addEventListener("click", async (event) => {
  const saveBtn = event.target.closest("#previewSaveBtn");
  if (!saveBtn) return;
  const file = state.files.find((item) => item.id === state.activeFileId);
  const editor = document.getElementById("previewEditor");
  if (!file || !editor) return;
  file.content = editor.value;
  await persistFileUpdate(file.id, { content: editor.value });
});

document.addEventListener("dblclick", async (event) => {
  const fileCard = event.target.closest("[data-file]");
  if (!fileCard) return;
  const file = state.files.find((item) => item.id === fileCard.dataset.file);
  if (!file || !file.trashed) return;
  if (!confirm(`Restore "${file.name}" from Trash?`)) return;
  await persistFileUpdate(file.id, { trashed: false });
});

document.addEventListener("change", (event) => {
  const checkbox = event.target.closest("[data-select-file]");
  if (!checkbox) return;
  const fileId = checkbox.dataset.selectFile;
  if (checkbox.checked) {
    if (!state.selectedFileIds.includes(fileId)) state.selectedFileIds.push(fileId);
  } else {
    state.selectedFileIds = state.selectedFileIds.filter((id) => id !== fileId);
  }
  state.activeFileId = fileId;
  render();
});

els.deleteBtn.addEventListener("click", async () => {
  const file = state.files.find((item) => item.id === state.activeFileId);
  const folder = getFolderById(state.activeFolderId);
  if (file) {
    if (state.view === "trash") {
      if (!confirm(`Delete file "${file.name}" forever?`)) return;
      if (useRemote) {
        await apiFetch(`/api/files/${file.id}`, { method: "DELETE" });
        await loadRemoteState();
      } else {
        state.files = state.files.filter((item) => item.id !== file.id);
        state.activeFileId = null;
        render();
      }
      return;
    }
    if (!confirm(`Move file "${file.name}" to trash?`)) return;
    if (useRemote) {
      await persistFileUpdate(file.id, { trashed: true });
      await loadRemoteState();
    } else {
      file.trashed = true;
      state.activeFileId = null;
      render();
    }
    return;
  }
  if (folder && folder.id !== "root") {
    if (!confirm(`Delete folder "${folder.name}"? Files inside will remain unless moved manually.`)) return;
    if (useRemote) {
      await apiFetch(`/api/folders/${folder.id}`, { method: "DELETE" });
      await loadRemoteState();
    } else {
      state.folders = state.folders.filter((item) => item.id !== folder.id);
      state.activeFolderId = "root";
      render();
    }
  }
});

async function applyBulk(patch, hardDelete = false) {
  const ids = [...state.selectedFileIds];
  if (!ids.length) return;
  if (hardDelete) {
    if (!confirm(`Delete ${ids.length} files forever?`)) return;
    if (useRemote) {
      for (const id of ids) await apiFetch(`/api/files/${id}`, { method: "DELETE" });
      await loadRemoteState();
    } else {
      state.files = state.files.filter((item) => !ids.includes(item.id));
      state.selectedFileIds = [];
      state.activeFileId = null;
      render();
    }
    return;
  }

  if (useRemote) {
    for (const id of ids) await persistFileUpdate(id, patch);
    state.selectedFileIds = [];
    render();
    return;
  }

  for (const id of ids) {
    const file = state.files.find((item) => item.id === id);
    if (file) Object.assign(file, patch);
  }
  state.selectedFileIds = [];
  render();
}

els.bulkTrashBtn.addEventListener("click", () => applyBulk({ trashed: true }));
els.bulkRestoreBtn.addEventListener("click", () => applyBulk({ trashed: false }));
els.bulkDeleteBtn.addEventListener("click", () => applyBulk({}, true));
els.bulkMoveBtn.addEventListener("click", async () => {
  const choice = prompt(`Move selected files to folder id:\n${getParentOptions()}`);
  if (!choice) return;
  const target = choice.split(":")[0].trim();
  if (!getFolderById(target)) return;
  await applyBulk({ folderId: target });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hideContextMenu();
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
    event.preventDefault();
    state.selectedFileIds = getVisibleFiles().map((file) => file.id);
    render();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    els.searchInput.focus();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
    event.preventDefault();
    state.filterMode = state.filterMode === "all" ? "docs" : "all";
    render();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "e") {
    event.preventDefault();
    els.renameBtn.click();
  }
});

document.addEventListener("dragstart", (event) => {
  const fileCard = event.target.closest("[data-file]");
  if (!fileCard) return;
  fileCard.classList.add("dragging");
  event.dataTransfer.setData("text/plain", fileCard.dataset.file);
});

document.addEventListener("dragend", (event) => {
  const fileCard = event.target.closest("[data-file]");
  if (fileCard) fileCard.classList.remove("dragging");
  document.querySelectorAll(".dropzone, .tree-item").forEach((el) => el.classList.remove("file-drop-target", "drop-target"));
});

document.addEventListener("dragover", (event) => {
  const target = event.target.closest("[data-tree-folder], [data-folder]");
  if (!target) return;
  event.preventDefault();
  target.classList.add(target.matches("[data-tree-folder]") ? "drop-target" : "file-drop-target");
});

document.addEventListener("dragleave", (event) => {
  const target = event.target.closest("[data-tree-folder], [data-folder]");
  if (!target) return;
  target.classList.remove(target.matches("[data-tree-folder]") ? "drop-target" : "file-drop-target");
});

document.addEventListener("drop", async (event) => {
  const target = event.target.closest("[data-tree-folder], [data-folder]");
  if (!target) return;
  event.preventDefault();
  target.classList.remove(target.matches("[data-tree-folder]") ? "drop-target" : "file-drop-target");
  const fileId = event.dataTransfer.getData("text/plain");
  const file = state.files.find((item) => item.id === fileId);
  const folderId = target.dataset.treeFolder || target.dataset.folder;
  if (!file || !folderId || file.folderId === folderId) return;
  await persistFileUpdate(file.id, { folderId });
});

let dragSelectStart = null;
document.addEventListener("mousedown", (event) => {
  const fileCard = event.target.closest("[data-file]");
  if (!fileCard || event.button !== 0 || event.target.closest(".file-check")) return;
  dragSelectStart = fileCard.dataset.file;
});

document.addEventListener("mouseup", () => {
  dragSelectStart = null;
});

document.addEventListener("mouseover", (event) => {
  if (!dragSelectStart) return;
  const fileCard = event.target.closest("[data-file]");
  if (!fileCard) return;
  const ids = getVisibleFiles().map((file) => file.id);
  const startIndex = ids.indexOf(dragSelectStart);
  const endIndex = ids.indexOf(fileCard.dataset.file);
  if (startIndex < 0 || endIndex < 0) return;
  const [min, max] = [Math.min(startIndex, endIndex), Math.max(startIndex, endIndex)];
  state.selectedFileIds = ids.slice(min, max + 1);
  render();
});

document.getElementById("uploadBtn").addEventListener("click", () => els.fileInput.click());
els.fileInput.addEventListener("change", () => {
  if (!canCreateContent()) {
    showAuth("Editor access required to upload files.");
    els.fileInput.value = "";
    return;
  }
  if (!useRemote) {
    for (const file of els.fileInput.files) {
      state.files.unshift({
        id: `${Date.now()}-${file.name}`,
        name: file.name,
        type: file.name.split(".").pop()?.toUpperCase() || "File",
        size: `${Math.max(file.size / 1024 / 1024, 0.1).toFixed(1)} MB`,
        modified: "Today",
        folderId: state.activeFolderId,
        starred: false,
        shared: false,
        trashed: false,
      });
    }
    state.activeFileId = state.files[0]?.id || null;
    state.selectedFileIds = state.activeFileId ? [state.activeFileId] : [];
    render();
    return;
  }
  uploadRemoteFiles(els.fileInput.files, state.activeFolderId)
    .then(() => loadDriveData())
    .catch((error) => {
      showAuth(error.message || "Failed to upload file.");
    });
});

els.searchInput.addEventListener("input", (event) => {
  state.search = event.target.value.trim().toLowerCase();
  render();
});

["dragenter", "dragover"].forEach((type) => {
  els.dropzone.addEventListener(type, (event) => {
    event.preventDefault();
    els.dropzone.classList.add("dragover");
    els.dropHint.textContent = "Release to add files to this folder.";
  });
});

["dragleave", "drop"].forEach((type) => {
  els.dropzone.addEventListener(type, (event) => {
    event.preventDefault();
    els.dropzone.classList.remove("dragover");
    els.dropHint.textContent = "Drag and drop files here to add them to your drive.";
  });
});

els.dropzone.addEventListener("drop", (event) => {
  const dropped = [...event.dataTransfer.files];
  if (!canCreateContent()) {
    showAuth("Editor access required to upload files.");
    return;
  }
  if (useRemote) {
    uploadRemoteFiles(dropped, state.activeFolderId)
      .then(() => loadDriveData())
      .catch((error) => {
        showAuth(error.message || "Failed to upload dropped files.");
      });
    return;
  }
  for (const file of dropped) {
    state.files.unshift({
      id: `${Date.now()}-${file.name}`,
      name: file.name,
      type: file.name.split(".").pop()?.toUpperCase() || "File",
      size: `${Math.max(file.size / 1024 / 1024, 0.1).toFixed(1)} MB`,
      modified: "Today",
      folderId: state.activeFolderId,
      starred: false,
      shared: false,
      trashed: false,
    });
  }
  state.activeFileId = state.files[0]?.id || null;
  state.selectedFileIds = state.activeFileId ? [state.activeFileId] : [];
  render();
});

loadRemoteState();
checkHealth();
