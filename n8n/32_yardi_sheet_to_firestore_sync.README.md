# Workflow 32 — Yardi Sheet → Firestore Lead Sync

Closes the loop on `yardi_export.py` (the Playwright/Selenium script on Justin's
work laptop, `C:\Users\jcho\Desktop\cloud_dodge\yardi_export.py`). That script logs
into Yardi Deal Manager, exports today's deals filtered to Justin's name, and
overwrites the Google Sheet at `1HeI-r8YxnvZqWSYCARiy_nFB6eZZyv7NMRyMmkOS848`
(sheet1/gid 0) with the day's rows. This workflow reads that same Sheet and
creates any new-looking row as a Firestore lead — the second half of "script
writes to Sheet, n8n writes Sheet to Firestore" that Justin asked for
2026-08-10/11 ("Let's go n8n").

## How it works

Webhook `yardi-sheet-sync` (POST, fire-and-forget — `responseMode: onReceived`,
matching how the Python script calls it: a 10s-timeout POST it doesn't wait on)
→ **Get Sheet Metadata** (raw `spreadsheets.get` call, `fields=sheets.properties`
— fetches every tab's gid + title) → **Resolve Sheet Tab (gid 0)** (Code node —
finds the tab whose `sheetId === 0`, i.e. the one `yardi_export.py` writes to via
gspread's `sh.sheet1`, and pulls its real title; gspread never tells us that
title directly, and the values API needs it, not the gid) → **Read Sheet Values**
(raw `values.get` call against that resolved title, `valueRenderOption:
UNFORMATTED_VALUE`) → **Grid to Records** (Code node — turns the raw 2D grid into
one object per row keyed by the header row, which is always row 1 here since
`yardi_export.py`'s own `write_rows_to_sheet()` already stripped Yardi's
title/blank rows before writing) → **Parse Rows** (Code node — pulls email/phone
out of the single `TENANT CONTACT` string via regex, same approach the Python
script itself uses; rows with no extractable email are dropped here, not synced)
→ **Query Firestore for existing email** (Firestore `runQuery` against the
`leads` collection, exact match on `email`) → **Check Match** (Code node —
normalizes the `runQuery` response array into a `matched` boolean) → **IF no
existing lead** → **Create Lead** (POSTs to the existing LIVE `firestore-write`
webhook, workflow 20's generic writer — same path every other promote-to-lead
action in this app already uses) or **Skip (already exists)**.

New leads land with `stage: 'lead'`, `yardi_milestone` set from the Sheet's `SUB
STAGE` column, and a `notes` field prefixed `"From Yardi: ..."` carrying whatever
was in `LAST ACTIVITY COMMENT` — so a lead created this way is visibly
attributable to the sync, not indistinguishable from one Justin entered by hand.

## Why raw HTTP Request nodes instead of the native Google Sheets node

First draft of this workflow used n8n's native `n8n-nodes-base.googleSheets`
node. Two problems surfaced before it ever got imported:

1. That node defaults to OAuth2 authentication unless its `authentication`
   parameter is explicitly set to `serviceAccount` — a service-account
   credential silently doesn't bind correctly without that, and this project
   has never used that node before, so there was no prior working example to
   copy the setting from.
2. Its resource-locator addressed the tab by gid, but the raw Sheets API (used
   under the hood either way) actually needs the tab's *title* for a
   values read — and gspread's `sh.sheet1` (what the Python script writes
   through) never tells us what that title actually is.

Rather than ship something with an unverified auth mode, this was rebuilt as
plain HTTP Request nodes using `predefinedCredentialType: googleApi` — the
*exact* pattern already proven live everywhere else in this project (every
Firestore read/write in workflows 6/17/19/20 and now here). The extra
"Get Sheet Metadata" / "Resolve Sheet Tab" nodes exist specifically to look up
the tab's real title from its gid, so nothing here has to guess whether the
tab is still literally named "Sheet1".

## Setup (not yet imported — nothing here has run live)

1. **New credential needed.** In n8n, create a **Google Service Account**
   ("Google API") credential named "Yardi Export Service Account", using the
   same `google_service_account.json` key already on the work laptop
   (`windmill-yardi-export@windmill-505120.iam.gserviceaccount.com`). This is a
   *different* service account than `Firebase_SDK_do_or_wait` — it's the one
   already shared as Editor on the target Sheet, not the one with Firestore
   access.
2. **Set the credential's scope to include Sheets read access** — e.g.
   `https://www.googleapis.com/auth/spreadsheets.readonly` (or the broader
   `.../auth/spreadsheets` if write access is ever wanted later). This is
   easy to miss and will fail as a 403 on the very first "Get Sheet Metadata"
   call if the scope only covers what `Firebase_SDK_do_or_wait`'s credential
   was scoped for (Firestore, not Sheets) — these are two separate
   credentials for a reason, don't reuse one for the other.
3. Rebind both "Get Sheet Metadata" and "Read Sheet Values" to that new
   credential.
4. Confirm `Firebase_SDK_do_or_wait` (already bound by id, `7IVvQuErxEJPoaMY`)
   has Firestore **read** access, not just write — this is the first time
   anything in this project asks it to `runQuery`. A silently-failing read
   would look identical to "no existing lead" and create duplicate leads.
5. Import as a **new** workflow — `yardi-sheet-sync` is a fresh webhook path,
   no conflict with anything already active.
6. Activate.
7. **Live test before trusting it**: run `yardi_export.py` once (or manually
   add a test row to the Sheet with a fake-but-realistic email), POST to
   `https://plain-credit-5962.jchoustin91.workers.dev/webhook/yardi-sheet-sync`,
   and check Firestore for the new `leads/{id}` doc. Then run it again with the
   same row unchanged and confirm the second run correctly skips (no duplicate
   lead) — that's the actual dedup behavior this workflow exists for.

## Design notes / tradeoffs

- **Dedup is exact match only (email, or phone when there's no email) — no
  fuzzy name matching.** Decided 2026-08-11 after the manual Yardi-vs-Firestore
  backfill comparison turned up a real false-positive risk (a "Mark Lopez"
  match that was actually two different leads). A row with neither an
  extractable email nor phone is left out of the sync entirely rather than
  guessed at by name — it just stays visible in the Sheet for a manual look.
- **Phone-only contacts (updated 2026-08-13).** Yardi's "Tenant Direct"
  contact type is sometimes phone-only, no email — found live on a real lead
  ("Luis F.", `TENANT CONTACT` = `"Luis F.\nTenant Direct\n4706365654\n"`).
  The original version required an email to sync at all and silently dropped
  anything without one — not even left for manual review. Parse Rows now
  syncs a row if it has *either* an email or a phone; the dedup query falls
  back to a `phone_digits` field (digits-only, no punctuation) when there's
  no email. Every lead this workflow creates now gets `phone_digits` set
  alongside `phone`, specifically so same-day re-syncs (the watcher can
  re-run `yardi_export.py` multiple times a day, and each run re-exports
  every deal created that day, not just the newest) correctly dedupe against
  a phone-only lead this workflow already created earlier that day.
  Caveat: leads entered by hand (not through this workflow) won't have a
  `phone_digits` field and may store `phone` with punctuation, so a
  phone-only row could theoretically fail to match a true pre-existing
  duplicate among older, manually-entered leads. Same class of tradeoff
  already accepted for email-only exact-match dedup above — worth a manual
  glance if a phone-only lead looks like it might already exist by another
  name.
- **No "wider window" self-healing.** An earlier design considered re-checking
  a few days back in case a lead's contact got added *after* the lead itself
  (Yardi leads can exist before a contact is attached). Justin explicitly cut
  this ("Forget the contact created after - its done at the same time") — this
  workflow only ever looks at whatever `yardi_export.py` currently has written
  to the Sheet (today's deals, at the time of that run).
- **Phone is captured but not used for dedup** — only `email` is queried
  against Firestore. If phone-based dedup is ever wanted, add a second
  `runQuery` (or an `OR` compositeFilter) rather than assuming this one
  covers it.
- **Fire-and-forget from the script's side.** `yardi_export.py` POSTs to this
  webhook after a successful Sheet write, non-fatally (wrapped in try/except,
  10s timeout) — so a slow or failed sync never breaks the Sheet write, which
  is the part that actually has to succeed every run. Worst case, workflow 32
  can always be triggered manually from n8n against whatever's currently in
  the Sheet.
- **Reuses workflow 20 rather than writing Firestore directly** for the create
  step, same as every other promote-to-lead path in the app — one write path
  to keep consistent instead of a second bespoke Firestore write here.
