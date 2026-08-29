/* ============================================================
   app.js — journal UI logic, CRUD, search, and page-flip effect
   ============================================================ */

let state = {
  entries: [],      // loaded from GitHub
  filtered: [],      // after search/folder filter
  activeId: null,
  mode: "empty",     // empty | view | edit
  loaded: false
};

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

// ---------- screen helpers ----------
function showScreen(id){
  $$(".screen").forEach(s => s.classList.add("hidden"));
  $("#" + id).classList.remove("hidden");
}

// ---------- simple HTML sanitizer for entry bodies ----------
// Allows a small formatting subset; strips scripts/styles/event handlers/links-to-js.
function sanitizeHtml(html){
  const allowed = new Set(["B","I","U","STRONG","EM","UL","OL","LI","BR","P","DIV","SPAN","H3","BLOCKQUOTE"]);
  const tmp = document.createElement("div");
  tmp.innerHTML = html;

  (function clean(node){
    Array.from(node.childNodes).forEach(child => {
      if(child.nodeType === 1){
        if(!allowed.has(child.tagName)){
          // unwrap disallowed tag, keep its children/text
          while(child.firstChild) node.insertBefore(child.firstChild, child);
          node.removeChild(child);
          return;
        }
        // strip all attributes (no onclick, style w/ url(), etc.)
        Array.from(child.attributes).forEach(a => child.removeAttribute(a.name));
        clean(child);
      } else if(child.nodeType !== 3){
        node.removeChild(child);
      }
    });
  })(tmp);

  return tmp.innerHTML;
}

function plainText(html){
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || "";
}

function uid(){
  return "e_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,8);
}

function formatDateDisplay(iso){
  if(!iso) return "";
  const [y,m,d] = iso.split("-").map(Number);
  const dt = new Date(y, (m||1)-1, d||1);
  return dt.toLocaleDateString(undefined, { year:"numeric", month:"long", day:"numeric" });
}

// ---------- rendering ----------
function renderFolderOptions(){
  const folders = Array.from(new Set(state.entries.map(e => (e.folder||"").trim()).filter(Boolean))).sort();
  const folderFilter = $("#folderFilter");
  const currentVal = folderFilter.value;
  folderFilter.innerHTML = '<option value="">all folders</option>' +
    folders.map(f => `<option value="${escapeAttr(f)}">${escapeHtml(f)}</option>`).join("");
  folderFilter.value = folders.includes(currentVal) ? currentVal : "";

  const datalist = $("#folderOptions");
  datalist.innerHTML = folders.map(f => `<option value="${escapeAttr(f)}">`).join("");
}

function escapeHtml(s){
  return (s||"").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function escapeAttr(s){ return escapeHtml(s); }

function applyFilters(){
  const q = ($("#searchInput").value || "").trim().toLowerCase();
  const folder = $("#folderFilter").value;

  state.filtered = state.entries.filter(e => {
    if(folder && (e.folder||"") !== folder) return false;
    if(!q) return true;
    const hay = [
      e.title || "",
      formatDateDisplay(e.date).toLowerCase(),
      e.date || "",
      plainText(e.bodyHtml || "")
    ].join(" ").toLowerCase();
    return hay.includes(q);
  });

  // newest first
  state.filtered.sort((a,b) => (b.date||"").localeCompare(a.date||"") || (b.createdAt||"").localeCompare(a.createdAt||""));
  renderEntryList();
}

function renderEntryList(){
  const list = $("#entryList");
  if(state.filtered.length === 0){
    list.innerHTML = `<div class="entry-list-empty">No pages found. The archive awaits its first entry.</div>`;
    return;
  }
  list.innerHTML = state.filtered.map(e => `
    <div class="entry-item ${e.id === state.activeId ? "active" : ""}" data-id="${e.id}">
      <div class="ei-date">${escapeHtml(formatDateDisplay(e.date))}</div>
      <div class="ei-title">${escapeHtml(e.title || "(untitled page)")}</div>
      ${e.folder ? `<div class="ei-folder">${escapeHtml(e.folder)}</div>` : ""}
    </div>
  `).join("");

  $$(".entry-item").forEach(el => {
    el.addEventListener("click", () => openEntry(el.dataset.id));
  });
}

function setMode(mode){
  state.mode = mode;
  $("#emptyState").classList.toggle("hidden", mode !== "empty");
  $("#entryView").classList.toggle("hidden", mode !== "view");
  $("#entryEditor").classList.toggle("hidden", mode !== "edit");
}

function flipPage(cb){
  const rp = $("#rightPage");
  rp.classList.remove("page-flipping");
  // force reflow to restart animation
  void rp.offsetWidth;
  rp.classList.add("page-flipping");
  setTimeout(() => {
    cb && cb();
  }, 250); // swap content mid-flip
  rp.addEventListener("animationend", function handler(){
    rp.classList.remove("page-flipping");
    rp.removeEventListener("animationend", handler);
  });
}

function openEntry(id){
  const entry = state.entries.find(e => e.id === id);
  if(!entry) return;
  flipPage(() => {
    state.activeId = id;
    $("#viewDate").textContent = formatDateDisplay(entry.date);
    $("#viewFolder").textContent = entry.folder || "";
    $("#viewFolder").style.display = entry.folder ? "inline-block" : "none";
    $("#viewTitle").textContent = entry.title || "(untitled page)";
    $("#viewBody").innerHTML = entry.bodyHtml || "";
    setMode("view");
    renderEntryList();
  });
}

function startNewEntry(){
  flipPage(() => {
    state.activeId = null;
    $("#editDate").value = new Date().toISOString().slice(0,10);
    $("#editFolder").value = "";
    $("#editTitle").value = "";
    $("#editBody").innerHTML = "";
    setMode("edit");
    $("#editTitle").focus();
  });
}

function startEditEntry(){
  const entry = state.entries.find(e => e.id === state.activeId);
  if(!entry) return;
  $("#editDate").value = entry.date || new Date().toISOString().slice(0,10);
  $("#editFolder").value = entry.folder || "";
  $("#editTitle").value = entry.title || "";
  $("#editBody").innerHTML = entry.bodyHtml || "";
  setMode("edit");
}

async function saveCurrentEntry(){
  const date = $("#editDate").value || new Date().toISOString().slice(0,10);
  const folder = $("#editFolder").value.trim();
  const title = $("#editTitle").value.trim();
  const bodyHtml = sanitizeHtml($("#editBody").innerHTML);
  const now = new Date().toISOString();

  let entry;
  if(state.activeId){
    entry = state.entries.find(e => e.id === state.activeId);
    entry.date = date; entry.folder = folder; entry.title = title; entry.bodyHtml = bodyHtml;
    entry.updatedAt = now;
  } else {
    entry = { id: uid(), date, folder, title, bodyHtml, createdAt: now, updatedAt: now };
    state.entries.push(entry);
    state.activeId = entry.id;
  }

  await persist(`Journal entry: ${title || entry.date}`);
  renderFolderOptions();
  applyFilters();
  openEntry(entry.id);
}

async function deleteCurrentEntry(){
  const entry = state.entries.find(e => e.id === state.activeId);
  if(!entry) return;
  if(!confirm(`Tear out "${entry.title || "this page"}" forever? This cannot be undone.`)) return;

  state.entries = state.entries.filter(e => e.id !== entry.id);
  state.activeId = null;
  await persist(`Delete entry: ${entry.title || entry.date}`);
  renderFolderOptions();
  applyFilters();
  flipPage(() => setMode("empty"));
}

async function persist(message){
  setSyncStatus("sealing the archive...");
  try{
    await GitHub.saveEntries(state.entries, message);
    setSyncStatus("saved to the archive ✓");
  }catch(err){
    setSyncStatus("");
    alert("Could not save to GitHub: " + err.message);
    throw err;
  }
}

function setSyncStatus(text){
  const el = $("#syncStatus");
  el.textContent = text;
  if(text){
    clearTimeout(setSyncStatus._t);
    setSyncStatus._t = setTimeout(() => { el.textContent = ""; }, 4000);
  }
}

// ---------- loading from GitHub ----------
async function loadJournal(){
  setSyncStatus("opening the strongbox...");
  try{
    const { entries } = await GitHub.fetchEntries();
    state.entries = entries || [];
    state.loaded = true;
    renderFolderOptions();
    applyFilters();
    setMode("empty");
    setSyncStatus("archive loaded ✓");
    showScreen("journal");
  }catch(err){
    setSyncStatus("");
    alert("Could not reach your archive: " + err.message + "\n\nCheck your connection settings.");
    showScreen("settings");
  }
}

// ---------- settings screen ----------
function populateSettingsForm(){
  const cfg = GitHub.getConfig();
  if(cfg){
    $("#cfgOwner").value = cfg.owner || "";
    $("#cfgRepo").value = cfg.repo || "";
    $("#cfgBranch").value = cfg.branch || "main";
    $("#cfgToken").value = cfg.token || "";
  }
}

async function handleSaveConfig(){
  const owner = $("#cfgOwner").value.trim();
  const repo = $("#cfgRepo").value.trim();
  const branch = $("#cfgBranch").value.trim() || "main";
  const token = $("#cfgToken").value.trim();
  const statusEl = $("#cfgStatus");

  if(!owner || !repo || !token){
    statusEl.textContent = "Owner, repo, and token are all required.";
    return;
  }

  GitHub.saveConfig({ owner, repo, branch, token });
  statusEl.textContent = "Testing the connection...";
  try{
    await GitHub.testConnection();
    statusEl.textContent = "Connection sealed! Opening your journal...";
    setTimeout(loadJournal, 500);
  }catch(err){
    statusEl.textContent = "Failed: " + err.message;
  }
}

// ---------- wiring ----------
function init(){
  $("#openBtn").addEventListener("click", () => {
    if(GitHub.isConfigured()) loadJournal();
    else { populateSettingsForm(); showScreen("settings"); }
  });
  $("#settingsBtnCover").addEventListener("click", () => { populateSettingsForm(); showScreen("settings"); });
  $("#settingsBtnJournal").addEventListener("click", () => { populateSettingsForm(); showScreen("settings"); });
  $("#cfgCancel").addEventListener("click", () => showScreen(GitHub.isConfigured() ? "journal" : "cover"));
  $("#cfgSave").addEventListener("click", handleSaveConfig);

  $("#searchInput").addEventListener("input", applyFilters);
  $("#folderFilter").addEventListener("change", applyFilters);

  $("#newEntryBtn").addEventListener("click", startNewEntry);
  $("#editBtn").addEventListener("click", startEditEntry);
  $("#deleteBtn").addEventListener("click", deleteCurrentEntry);
  $("#saveEntryBtn").addEventListener("click", saveCurrentEntry);
  $("#cancelEditBtn").addEventListener("click", () => {
    if(state.activeId) openEntry(state.activeId);
    else flipPage(() => setMode("empty"));
  });

  $$(".toolbar button").forEach(btn => {
    btn.addEventListener("click", () => {
      $("#editBody").focus();
      document.execCommand(btn.dataset.cmd, false, btn.dataset.value || null);
    });
  });

  // auto-open if already configured (convenience)
  if(GitHub.isConfigured()){
    // stay on cover; user clicks OPEN to enter (keeps the ritual feel + lets token be wrong without surprise)
  }
}

document.addEventListener("DOMContentLoaded", init);
