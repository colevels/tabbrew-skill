---
name: tabbrew-html-upload
description: Send an HTML file (plan doc, report, viewer) to TabBrew so it can be opened from the TabBrew sidepanel Docs view. Use when the user says "send this to tabbrew", "push this html to tabbrew", "upload this doc to tabbrew", "ส่งเข้า tabbrew", or any close paraphrase about getting an HTML file into TabBrew.
---

# Send an HTML file to TabBrew (Docs view)

Two modes — **cloud is the default**:

- **cloud** (default): uploads the content to private cloud storage (GCS),
  viewable via short-lived signed URLs from any machine. Max 2 MB.
- **local**: registers the file's absolute path only; the file stays on this
  machine and TabBrew opens it as `file://`. Use only when the user explicitly
  says local / keep-on-this-machine / dev — it requires a dev build of the
  extension with "Allow access to file URLs" enabled; the Chrome Web Store
  build is cloud-only.

Base URL: `https://www.tabbrew.com` — if the user says local/dev, use
`http://localhost:3000`.

1. Read the upload token from `~/.config/tabbrew/upload-token` (trim whitespace).
   If the file is missing, stop and tell the user: generate a token at
   https://www.tabbrew.com/profile ("Generate upload token") and save it with
   `mkdir -p ~/.config/tabbrew && echo '<token>' > ~/.config/tabbrew/upload-token && chmod 600 ~/.config/tabbrew/upload-token`.

2. Pick a short human-readable title from the doc's purpose (e.g. "Auth refactor
   plan"), not the filename.

   **cloud mode** — upload the content (max 2 MB):

   ```bash
   curl -sS -X POST "<base>/api/v1/html_files/upload" \
     -H "x-upload-token: $(tr -d '[:space:]' < ~/.config/tabbrew/upload-token)" \
     -F "file=@<path>;type=text/html" \
     -F "title=<short human title>"
   ```

   **local mode** — register the absolute path (no upload):

   ```bash
   curl -sS -X POST "<base>/api/v1/html_files/local" \
     -H "x-upload-token: $(tr -d '[:space:]' < ~/.config/tabbrew/upload-token)" \
     -H "content-type: application/json" \
     -d '{"path":"<absolute path>","title":"<short human title>"}'
   ```

3. On success (`{"success":true,...}`) tell the user the title and that the doc
   is in the TabBrew sidepanel under **Docs**. For cloud mode print the returned
   `url` — a permanent owner-only view link (requires being logged in to
   tabbrew.com in the browser). For local mode also print the `file://` link
   (URL-encode spaces); note that opening from TabBrew needs "Allow access to
   file URLs" enabled for the extension.

4. On 401 the token is missing or was rotated — point the user back to step 1.
   On 413 (cloud) the file exceeds 2 MB — slim the file, or offer local mode if
   the user is on a dev setup.
