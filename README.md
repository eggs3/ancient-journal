# A Fallen Journal

A free, gothic-Victorian journal for tracking your plans, progress, and goals in *Fallen London* (or anywhere else). Worn parchment pages, handwriting fonts, a page-flip animation when you turn between entries, rich text formatting, folders, and search by title/date/content.

**Cost forever: $0.** It's a static site (hosted free on GitHub Pages) that stores your entries as JSON inside your own GitHub repo (also free), written to directly from your browser using a personal access token. No server, no database, no subscription.

## What's in this folder

```
index.html          the whole app shell
css/style.css        all styling / the parchment-and-leather look
js/github.js          talks to the GitHub API (read/write your entries)
js/app.js             journal logic: CRUD, search, folders, page flip
data/entries.json     where your entries live (starts with one sample entry)
```

## One-time setup (about 5 minutes)

### 1. Create the repository
1. On GitHub, click **New repository**.
2. Name it anything (e.g. `fallen-london-journal`). Public or private both work fine.
3. Create it, then upload every file in this folder to it, **keeping the folder structure** (`css/`, `js/`, and `data/` must stay as subfolders). The easiest way: on the repo page, use **Add file → Upload files** and drag the whole folder in, or use `git` from the command line if you're comfortable with it.

### 2. Turn on GitHub Pages
1. In your new repo, go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **Deploy from a branch**.
3. Branch: `main`, folder: `/ (root)`. Save.
4. GitHub will give you a URL like `https://yourname.github.io/fallen-london-journal/` within a minute or two. That's your journal's permanent address — bookmark it.

### 3. Create a personal access token (this is what lets the app save entries)
1. Go to your GitHub photo (top right) → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Give it a name like "Fallen Journal".
3. Under **Repository access**, choose **Only select repositories** and pick this one repo. (Never grant a token access to all your repos for something like this.)
4. Under **Permissions → Repository permissions**, find **Contents** and set it to **Read and write**. Everything else can stay "No access."
5. Generate the token and **copy it immediately** — GitHub only shows it once.

### 4. Connect the journal
1. Open your journal's GitHub Pages URL.
2. Click **⚙ connect to your archive** on the cover.
3. Enter your GitHub username, the repo name, branch (`main`), and paste the token.
4. Click **Seal the pact**. If it connects, you're in.

The token is stored only in your own browser's local storage — it is never written into the repo or visible to anyone else. If you ever use a new browser or device, just repeat step 4 with the same token (or generate a new one).

## Using it

- **New entry**: click *+ new entry*, pick a date, an optional folder, a title, and write. Use the toolbar for bold/italic/underline, headings, bullet or numbered lists, and quotes.
- **Edit**: open an entry, click *✒ edit*.
- **Delete**: open an entry, click *🗑 tear out* (asks for confirmation — it's permanent).
- **Search**: the search box on the left filters by title, date, or any word in the entry. The dropdown next to it filters by folder.
- Every save/delete commits straight to `data/entries.json` in your GitHub repo, so your entries are backed up in git history forever, and viewable/editable from any device by connecting with the same token.

## Notes & limits

- This is intentionally simple: no image uploads, no tagging beyond one folder per entry, no offline mode. If GitHub is unreachable, the journal will tell you rather than silently failing.
- Because saving means one commit per change, GitHub's standard API rate limits apply (5,000 requests/hour for an authenticated token) — miles more than a personal journal will ever use.
- Want to peek at your raw data or back it up elsewhere? It's always readable at `data/entries.json` in your repo, or via each commit in the repo's history.
