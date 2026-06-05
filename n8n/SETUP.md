# n8n Email Sequencer — Setup Guide
Cubework Fontana · 5-touch follow-up cadence

---

## Files in this folder

| File | Purpose |
|------|---------|
| `1_queue_checker.json` | Runs at 8am daily. Finds leads due for a touch, renders the template, writes `pending_email` to Firestore. |
| `2_send_trigger.json` | Runs every 5 min. Finds leads you approved (`seq_status = send_approved`), sends via Outlook, updates the lead. |
| `3_reply_detector.json` | Runs every 30 min. Checks your inbox for emails from active prospects, marks them as replied. |
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
5. API permissions → Add: `Mail.Send`, `Mail.Read` → **Grant admin consent**

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

### Test workflow 2 (send trigger)
1. In the app, tap **Approve & Send** on the test lead
2. Wait up to 5 minutes (or manually trigger workflow 2)
3. Confirm the email arrived in the test inbox
4. Confirm the lead in Firestore shows `current_step = 1`, `last_touch_date = today`, `pending_email` is gone

### Test workflow 3 (reply detector)
1. Reply to the test email from the prospect address
2. Manually trigger workflow 3
3. Confirm the lead flips to `seq_status = replied` and drops out of the queue

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
