# n8n Email Sequencer — Setup Guide
Cubework Fontana · 5-touch follow-up cadence

---

## ⚠️ Sending model: MANUAL (current)

Justin sends from his own Outlook — n8n does **not** send mail. This avoids needing the `Mail.Send` Graph permission (admin consent). Practically:

- **Activate workflows 1 and 3 only.** Do **NOT** activate workflow 2.
- **Workflow 1** drafts the next touch on cadence and writes `pending_email` to the lead (Firestore only — no Graph).
- In the app, each queued draft shows **✉️ Open in email** (opens the touch in your Outlook via `mailto:`) and **✓ Mark sent** (records the touch and schedules the next one — the cadence math that workflow 2 used to do now runs client-side). **Snooze** / **Skip** also available.
- **Workflow 3** watches your inbox (read-only `Mail.Read`) and flips a lead to `replied`, which pulls it out of the queue.
- **Graph permission needed: just `Mail.Read`** (for workflow 3, same scope the Follow-up Scanner uses). `Mail.Send` is **not** required in this model.

> Workflow 2 (`2_send_trigger.json`) is kept in the repo for if you later decide to auto-send. To switch to full auto-send: grant `Mail.Send` + admin consent (SETUP Step 2), activate workflow 2, and change the app's email-preview buttons back to a single "Approve & Send" (writes `seq_status = send_approved`, which workflow 2 picks up). Until then, leave it off.

---

## Files in this folder

| File | Purpose |
|------|---------|
| `1_queue_checker.json` | Runs at 8am daily. Finds leads due for a touch, renders the template, writes `pending_email` to Firestore. |
| `2_send_trigger.json` | Runs every 5 min. Finds leads you approved (`seq_status = send_approved`), sends via Outlook, updates the lead. |
| `3_reply_detector.json` | Runs every 30 min. Checks your inbox for emails from active prospects, marks them as replied. |
| `6_followup_scanner.json` | Runs at 7am daily. Scans Outlook for the last email to/from each open lead, writes `days_since_contact` / `followup_due` to Firestore. **Does not send anything** — it just powers the app's 🔔 Follow-ups view. |
| `7_pricing_sync.json` | Runs at 6am daily. Reads the master price sheet (Sales_US site, `New Master List_ Price.xlsx`, tab `New Price Sheet 2026`) via the Graph workbook API and writes the parsed rate card to Firestore `pricing/current`. Powers the app's 💲 Pricing tab. |
| `templates.json` | Reference copy of the 5 email templates (the actual templates are embedded in workflow 1's Code node). |

---

## Step 1 — Firebase Service Account

You need a Google service account with Firestore access. The Firebase project ID is `do-or-wait`.

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → do-or-wait → Project Settings → Service accounts
2. Click **Generate new private key** → download the JSON file
3. In n8n: **Credentials → New → Google Service Account API**
   - Upload/paste the service account JSON
   - Name it exactly: `Google Service Account — do-or-wait`
4. After creating, find the credential ID in n8n and replace all `REPLACE_WITH_CREDENTIAL_ID` values in the three JSON files

---

## Step 2 — Microsoft Graph API (Outlook)

You need an Azure app registration that can send email and read inbox.

### Azure setup
1. Go to [portal.azure.com](https://portal.azure.com) → Azure Active Directory → App registrations → New registration
2. Name: `n8n-cubework-sequencer`, Supported account types: Single tenant
3. After creating: copy the **Application (client) ID** and **Directory (tenant) ID**
4. Certificates & secrets → New client secret → copy the value immediately
5. API permissions → Add: `Mail.Read` (required) and `Mail.Send` (**only if** you switch to full auto-send — not needed for the manual model above) → **Grant admin consent**

### n8n credential
1. n8n → Credentials → New → **Microsoft OAuth2 API**
   - Client ID: (from step 3)
   - Client Secret: (from step 4)
   - Tenant ID: (from step 3)
   - Scope: `https://graph.microsoft.com/.default`
   - Grant Type: Client Credentials
   - Name it: `Microsoft OAuth2 — Cubework Outlook`
2. Replace all `REPLACE_WITH_CREDENTIAL_ID` values in the JSON files

### Environment variable
Set `OUTLOOK_USER_ID` in n8n's environment variables (Settings → Environment variables):
```
OUTLOOK_USER_ID = justin.cho@cubework.com
```
This is the mailbox n8n will send FROM and read inbox from.

---

## Step 3 — Import workflows

In n8n:
1. Workflows → Import from file
2. Import `1_queue_checker.json`, then `2_send_trigger.json`, then `3_reply_detector.json`
3. In each workflow, open each HTTP Request node and confirm the credential is mapped correctly
4. **Activate all three workflows**

---

## Step 4 — Test before going live

### Test workflow 1 (queue checker)
1. Create a test lead in the app with `seq_status = active`, `next_due_date = today`, and a real email address
2. In n8n, open workflow 1 → click **Test workflow** (runs once manually)
3. Confirm the lead in Firestore now has a `pending_email` field
4. Confirm it appears in the app with the 📧 badge

### Test the send step (manual model — no workflow 2)
1. In the app, the test lead now shows the draft with **✉️ Open in email** and **✓ Mark sent**
2. Tap **Open in email** → confirm Outlook opens with the touch pre-filled (To / Subject / Body). Send it yourself.
3. Tap **✓ Mark sent** → confirm the lead in Firestore shows `current_step = 1`, `last_touch_date = today`, `next_due_date = today + 4 days`, and `pending_email` is gone.

*(Only if you later enable full auto-send via workflow 2: tap a single "Approve & Send", wait up to 5 min, and confirm the email arrives and the same fields update automatically.)*

### Test workflow 3 (reply detector)
1. Reply to the test email from the prospect address
2. Manually trigger workflow 3
3. Confirm the lead flips to `seq_status = replied` and drops out of the queue

---

## Follow-up Scanner (workflow 6) — the "cold in 3 days" system

This is the lightweight follow-up tracker (separate from the 5-touch sequencer above). It reuses the **same two credentials** you already set up — no new Azure app or service account needed.

### Import & activate
1. Workflows → Import from file → `6_followup_scanner.json`
2. Open the two **HTTP Request** nodes that hit Firestore (`Get all leads`, `Write follow-up flags`) and confirm they map to `Google Service Account — do-or-wait` (replace `REPLACE_WITH_CREDENTIAL_ID`).
3. Open `Latest message for lead` and confirm it maps to `Microsoft OAuth2 — Cubework Outlook`.
4. Confirm `OUTLOOK_USER_ID` is set (same env var workflows 2–3 use).
5. **Activate** the workflow. It runs at 7am daily; use **Test workflow** to run it on demand.

### Graph permission note
The scanner reads mail via `GET /users/{OUTLOOK_USER_ID}/messages?$search="participants:<email>"`. The `Mail.Read` application permission you already granted covers this — no extra scope.

### Test
1. Make sure a lead has a real `email` and that you've exchanged (or not) email with that address.
2. Run **Test workflow**. In Firestore, the lead should now carry `days_since_contact`, `followup_due`, `last_contact_date`, `followup_contacted`, `followup_checked_at`.
3. In the app's Leads tab, leads at ≥3 days show the **🔔 Follow-ups** count, the reminder banner, and a suggested-message block. (These also appear without the scanner — the app computes days-since-contact client-side — but the scanner makes it reflect real Outlook activity, including emails you sent outside the app.)

### Tuning the threshold
The 3-day rule lives in two places: `FOLLOWUP_DAYS` near the bottom of the scanner's `Compute days since contact` Code node, and `const FOLLOWUP_DAYS = 3;` in `index.html`. Change both to match.

---

## Pricing Sync (workflow 7) — the 💲 Pricing tab

Reads the national price sheet from SharePoint and writes it to Firestore `pricing/current`. Reuses the same two credentials as the others — no new ones.

### Import & activate
1. Workflows → Import from file → `7_pricing_sync.json`
2. Map `Read price sheet` → `Microsoft OAuth2 — Cubework Outlook`; map `Write pricing to Firestore` → `Google Service Account — do-or-wait` (replace `REPLACE_WITH_CREDENTIAL_ID`).
3. **Activate.** Runs 6am daily; use **Test workflow** to run on demand.

### Graph permission note — IMPORTANT
This file lives on the **Sales_US** SharePoint site (the availability sync reads the *PropertyManagement* site). The Azure app needs read access to Sales_US:
- If it has **`Files.Read.All` / `Sites.Read.All`** (application) with admin consent → already covered.
- If it's locked to specific sites (`Sites.Selected`) → grant the app access to the Sales_US site.

If `Read price sheet` returns 403/itemNotFound, this is why. The driveId/itemId and worksheet name are baked into the node's URL; if the sheet is renamed or moved, update them there.

### How the app uses it
The 💲 Pricing tab reads `pricing/current` live. Until the first sync runs, it shows the bundled snapshot from `pricing-seed.js` (labeled "snapshot"); once the sync writes the doc it flips to "live". To refresh the snapshot fallback, regenerate `pricing-seed.js` from the master xlsx.

---

## Cadence reference

| Touch sent | Days until next |
|-----------|----------------|
| 1 | 4 days |
| 2 | 6 days |
| 3 | 7 days |
| 4 | 9 days |
| 5 | — (final touch, seq_status → closed) |

---

## Firestore fields written by n8n

| Field | Written by | Meaning |
|-------|-----------|---------|
| `pending_email` | Workflow 1 | Draft email object. App shows approval UI when present. |
| `seq_status` | App (approve/skip/snooze) + Workflow 2 + Workflow 3 | `active` / `send_approved` / `replied` / `snoozed` / `closed` |
| `current_step` | Workflow 2 | Touch number just sent (1–5) |
| `last_touch_date` | Workflow 2 | YYYY-MM-DD of last send |
| `next_due_date` | Workflow 2 | YYYY-MM-DD when next touch is due |
| `replied_at` | Workflow 3 | ISO timestamp of detected reply |

---

## Email template merge variables

All variables available in templates:

| Variable | Source field |
|----------|-------------|
| `{{first_name}}` | `lead.first_name` |
| `{{company}}` | `lead.company` |
| `{{unit}}` | `lead.unit` |
| `{{unit_sf}}` | `lead.unit_sf` |
| `{{rate}}` | `lead.rate` |
| `{{included_items}}` | `lead.included_items` |
| `{{location}}` | `lead.location` |
| `{{alt_option}}` | `lead.alt_option` |
| `{{dock_line}}` | Auto: ", dock-high access" if `lead.dock = true` |
| `{{importer_line}}` | Auto: Cubeship pitch if `lead.is_importer = true` |
| `{{alt_sentence}}` | Auto: "I also have X if..." if alt_option is set |

To edit templates, open workflow 1 in n8n → **Render template** node → edit the `TEMPLATES` array in the code.
