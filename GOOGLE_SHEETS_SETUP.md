# Wire form leads to a Google Sheet

A 2-minute setup. No backend, no auth, no costs. Each lead becomes a row in a sheet you own.

## 1 — Create the sheet
1. Open https://sheets.google.com → **+ Blank**
2. Rename it to **"Growvate Leads"** (top-left, click "Untitled spreadsheet")

## 2 — Open Apps Script
1. In the sheet, menu: **Extensions → Apps Script**
2. A new tab opens with an empty `Code.gs` file
3. **Delete everything** in the editor
4. Open `google-sheets/apps-script.gs` from this repo (or [view on GitHub](https://github.com/Jeebz-a/growvate-landing/blob/main/google-sheets/apps-script.gs))
5. **Copy/paste the entire contents** into the Apps Script editor
6. Rename the project (top-left of Apps Script) to **"Growvate Lead Capture"**
7. Save: **⌘ S** (or Ctrl+S)

## 3 — Deploy as a web app
1. Top right: **Deploy → New deployment**
2. Click the ⚙️ gear icon next to "Select type" → **Web app**
3. Fill in:
   - **Description:** `Growvate lead capture`
   - **Execute as:** `Me (your-email@gmail.com)`
   - **Who has access:** `Anyone` ← important
4. Click **Deploy**

## 4 — Authorize
Google will prompt for permission since the script writes to your sheet.

1. Click **Authorize access**
2. Pick the same Google account
3. ⚠️ You'll see a **"Google hasn't verified this app"** screen — this is normal for any private script
   - Click **Advanced**
   - Click **Go to Growvate Lead Capture (unsafe)**
   - Click **Allow**
4. You'll land on a page with the **Web app URL** — copy it. Looks like:
   ```
   https://script.google.com/macros/s/AKfycb.../exec
   ```

## 5 — Test it
Paste the URL into a browser tab. You should see:
> `Growvate lead endpoint is live ✦ 2026-...`

If yes, it's working.

## 6 — Plug the URL into the site
1. Open `script.js`
2. Near the top, find:
   ```js
   const LEAD_ENDPOINT = 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';
   ```
3. Replace the placeholder with your URL
4. Save, commit, push:
   ```bash
   cd ~/Desktop/growvate-landing
   git add script.js
   git commit -m "Wire lead form to Google Sheets endpoint"
   git push
   vercel --prod
   ```

## 7 — Verify end-to-end
1. Open https://growvate-landing.vercel.app/#resources
2. Click **Download free PDF**
3. Fill in the form → Submit
4. Switch to your Google Sheet — a new row appears with name, email, use type, timestamp, etc.

The first submission also writes the header row automatically and styles it.

---

## Notes & gotchas

- **You must re-deploy** if you edit the Apps Script. Use **Deploy → Manage deployments → ✏️ edit → Version: New version → Deploy**. The URL stays the same.
- **Rate limit:** Apps Script gives ~20k executions/day on free Google accounts. Plenty for landing-page leads.
- **No CORS issues:** the site sends as `text/plain` so the browser doesn't need a preflight.
- **Privacy:** Apps Script doesn't expose source IPs, so we don't capture them. If you want IPs, route through a Vercel serverless function instead — let me know.
- **Email notifications:** to get emailed on every new lead, add this to the bottom of `doPost` before the `return`:
  ```js
  MailApp.sendEmail(
    'you@example.com',
    'New Growvate lead: ' + data.name,
    `Resource: ${data.resource}\nEmail: ${data.email}\nUse type: ${data.useType}`
  );
  ```

## When it stops working

- Check the Apps Script project → **Executions** (left sidebar) — every POST appears with its outcome
- If you see `Authorization required` errors, re-deploy with Execute as: Me + Anyone access
- If the URL returns 404, the deployment was deleted — make a new one
