/* ============================================================
   github.js — thin wrapper around the GitHub Contents API
   used as the free, permanent storage backend for entries.
   ============================================================ */

const DATA_PATH = "data/entries.json";
const CONFIG_KEY = "flj_github_config"; // {owner, repo, branch, token}

const GitHub = {

  getConfig(){
    try{
      const raw = localStorage.getItem(CONFIG_KEY);
      return raw ? JSON.parse(raw) : null;
    }catch(e){ return null; }
  },

  saveConfig(cfg){
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  },

  clearConfig(){
    localStorage.removeItem(CONFIG_KEY);
  },

  isConfigured(){
    const c = this.getConfig();
    return !!(c && c.owner && c.repo && c.token);
  },

  _apiBase(cfg){
    return `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${DATA_PATH}`;
  },

  _headers(cfg){
    return {
      "Authorization": `Bearer ${cfg.token}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    };
  },

  // Unicode-safe base64 encode/decode
  _b64encode(str){
    const bytes = new TextEncoder().encode(str);
    let binary = "";
    bytes.forEach(b => binary += String.fromCharCode(b));
    return btoa(binary);
  },
  _b64decode(b64){
    const binary = atob(b64.replace(/\n/g, ""));
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  },

  /**
   * Fetch entries.json from the repo.
   * Returns { entries: [...], sha: "..." }.
   * If the file does not yet exist, creates it (empty array) and returns it.
   */
  async fetchEntries(){
    const cfg = this.getConfig();
    if(!cfg) throw new Error("Not configured");
    const branch = cfg.branch || "main";
    const url = `${this._apiBase(cfg)}?ref=${encodeURIComponent(branch)}&t=${Date.now()}`;
    const res = await fetch(url, { headers: this._headers(cfg) });

    if(res.status === 404){
      // First run: create the data file.
      const created = await this._createEmptyFile();
      return created;
    }
    if(!res.ok){
      throw new Error(await this._describeError(res));
    }
    const json = await res.json();
    let entries = [];
    try{
      entries = JSON.parse(this._b64decode(json.content));
    }catch(e){
      entries = [];
    }
    return { entries, sha: json.sha };
  },

  async _createEmptyFile(){
    const cfg = this.getConfig();
    const branch = cfg.branch || "main";
    const res = await fetch(this._apiBase(cfg), {
      method: "PUT",
      headers: this._headers(cfg),
      body: JSON.stringify({
        message: "Initialize journal archive",
        content: this._b64encode("[]"),
        branch
      })
    });
    if(!res.ok) throw new Error(await this._describeError(res));
    const json = await res.json();
    return { entries: [], sha: json.content.sha };
  },

  /**
   * Write the full entries array back to GitHub.
   * Always re-fetches the current sha first to avoid clobbering
   * changes made from another device.
   */
  async saveEntries(entries, message){
    const cfg = this.getConfig();
    if(!cfg) throw new Error("Not configured");
    const branch = cfg.branch || "main";

    // Get latest sha
    const current = await this.fetchEntries();

    const res = await fetch(this._apiBase(cfg), {
      method: "PUT",
      headers: this._headers(cfg),
      body: JSON.stringify({
        message: message || "Update journal entries",
        content: this._b64encode(JSON.stringify(entries, null, 2)),
        sha: current.sha,
        branch
      })
    });
    if(!res.ok) throw new Error(await this._describeError(res));
    const json = await res.json();
    return json.content.sha;
  },

  async testConnection(){
    await this.fetchEntries();
    return true;
  },

  async _describeError(res){
    let detail = "";
    try{
      const j = await res.json();
      detail = j.message || "";
    }catch(e){}
    if(res.status === 401) return "The token was rejected. Check it was copied correctly.";
    if(res.status === 403) return "Access denied — check the token has Contents: Read & write on this repository. " + detail;
    if(res.status === 404) return "Repository not found — check the owner and repo name. " + detail;
    if(res.status === 409) return "Someone else (or another device) changed the archive at the same moment. Please try saving again.";
    return `GitHub error ${res.status}: ${detail}`;
  }
};
