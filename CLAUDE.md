# Do or Wait — Project Brief for Claude

## What this is
A web app for Justin Cho (Justin.Cho@cubework.com) at Cubework. Tabs:
1. **Tasks** — DO/WAIT topic threads (digital sticky note system)
2. **Leads** — Sales pipeline for leasing prospects, same DO/WAIT thread model  
3. **📞 Playbook** — (existing sales playbook view)
4. **🏭 Avail** — Real-time availability dashboard for Cubework warehouse locations
5. **💡 Notes** — Ideas/issues notebook (two editable fields per note, filter by date created)

Deployed at: https://justinchore.github.io/do-or-wait/
Source: `C:\Users\jcho\Documents\Claude\Projects\do_or_wait\index.html` (single HTML file, push to GitHub to deploy)

---

## Tech stack
- **Frontend**: Single `index.html` — vanilla JS, no framework, no build step
- **Database**: Firebase Firestore (project: `do-or-wait`, open rules — no auth required)
- **Storage**: Firebase Storage (voice notes, file attachments)
- **Automation**: n8n at `https://ailinker.item.com` (self-hosted, behind nginx)
- **CORS proxy**: Cloudflare Worker at `https://plain-credit-5962.jchoustin91.workers.dev` (proxies app → n8n with correct CORS headers)
- **Microsoft OAuth2**: Azure app `n8n-cubework`, n8n credential named `Microsoft account 3` (oAuth2Api: `n8n-cubework`). Scope must include `offline_access`.

---

## Architecture decision — stay vanilla single-file (revisit at triggers)
**Decided 2026-06-10.** Keep `index.html` as one vanilla-JS file with **no framework and no build step**. The push-to-GitHub-Pages deploy simplicity and the ease of editing a single file (incl. by Claude) outweigh the developer-comfort wins a framework would bring. Do **not** migrate to React/Vite or introduce a bundler on a whim.

**When adding any new feature, keep this in mind and weigh whether we've hit a trigger to reconsider:**
- The file is getting hard to navigate / tooling strains on its size (watch line count — it's the real signal, not the framework itself). First move if so: split the JS into a few **native ES modules** (still no build), not a framework.
- Another developer joins the project.
- The `window.*`-exposure footgun (see the ES-module gotcha below) or the manual `esc()` string-templating start causing **repeat** bugs.

**If we ever do migrate**, the chosen path is **Preact + htm loaded from a CDN** — components + reactivity while preserving the zero-build, push-to-deploy workflow. Not full React-with-a-bundler.

**Deferred feature ideas (revisit at the Preact migration):**
- Side-by-side card comparison (open two cards at once). Cards are currently **accordion** (single-open) via `toggleCard` / `toggleLeadCard` — opening one collapses the rest. Multi-open + a comparison layout is cleaner to build with components than with the current string-templating.

---

## Firestore collections

### `topics/{id}`
Task threads. Fields: `title`, `archived`, `entries[]`, `createdAt`

### `leads/{id}`
Sales leads. Thread structure + lead-specific fields: `company`, `first_name`, `email`, `contact`, `phone`, `segment`, `stage`, `location`, `sqft`, `leaseLength`, `moveIn`, `unit`, `unit_sf`, `dock`, `rate`, `included_items`, `alt_option`, `is_importer`, `current_step`, `last_touch_date`, `next_due_date`, `seq_status`, `pending_email` (written by n8n when email ready to approve)

**Follow-up fields** (written by the n8n Follow-up Scanner — workflow 6 — from Outlook/Graph): `last_contact_date` (YYYY-MM-DD of the most recent email to/from the lead, either direction), `days_since_contact` (int), `followup_contacted` (bool — false if no email history was found and the date fell back to lead creation), `followup_due` (bool — true at ≥3 days), `followup_checked_at` (ISO of last scan), `followup_snooze_until` (YYYY-MM-DD — set by the app's "Snooze" button, suppresses the lead until that date). The app **does not depend on the scanner having run**: `contactInfo(lead)` recomputes "days since contact" client-side as the most recent of `last_contact_date` / `last_touch_date` / the last thread entry, falling back to `createdAt`. The scanner just keeps the Outlook-derived signal fresh.

**Waitlist fields** (a lead can be put on the waitlist to watch for matching space): `wl_on` (bool), `wl_locations` (array of propIds to watch), `wl_type` (`any`/`WH`/`OFFICE`/`DOCK`/`TRAILER`), `wl_sf_min`, `wl_sf_max`. The "⏳ Waitlist" lead filter shows only `wl_on` leads. The modal sets `wl_on`/type/size; **locations are chosen on the lead card** via `renderWaitlistBlock` — a collapsible block (`wlCollapsed` Set, `wlToggleCollapse`) with a "＋ Add location…" dropdown of current `availMap` locations and removable chips (`wlAddLocation`/`wlRemoveLocation`, which persist + re-render). Matches compute inline every render via `wlMatches(lead)` (available-or-hold units in the chosen locations matching type + size) — no button, the list updates live as you add/remove locations. All client-side against synced availability; no n8n.

### `notes/{id}`
Ideas/issues notebook (💡 Notes tab). Fields: `why` (text — "Why does this issue matter?"), `fix` (text — "What's the fix?"), `createdAt`, `updatedAt`, `_deleted` (soft-delete flag). Notes have a **view mode** (read-only, shows Created + Edited dates, with Edit/Delete buttons) and an **edit mode** (textareas + Save/Cancel). `editingNotes` Set tracks which note ids are open for editing; `editNote`/`cancelNote`/`saveIdeaNote` toggle it. New notes open straight into edit mode. The tab has a Newest/Oldest sort and a "Since" date filter on `createdAt`.

### `availability/{propId}`
Written by n8n after syncing each property's SharePoint file. Fields: `property`, `address`, `yardi_url`, `sharepoint_url`, `sheet_last_modified`, `synced_at`, `wh{}`, `office{}`, `dock{}`, `parking{}`, `units[]`, `pa{name,phone,email}`, `ownership` (`own`/`lease`/`''`), `lease_expiration` (YYYY-MM-DD).

**App-edited fields survive sync**: `pa`, `ownership`, and `lease_expiration` are written directly from the app via Firestore REST PATCH and are NOT in the sync's `updateMask`, so re-syncs don't clobber them. `ownership`/`lease_expiration` are set via the Ownership modal (`openEditOwnership`/`saveOwnership`); the collapsed location card shows an ownership badge (🏢 Owned / 📄 Leased · exp date, red if expired) that opens the modal on click.

Each entry in `units[]` (parsed from the BOT tab): `unit`, `type` (WH/OFFICE/DOCK/TRAILER), `sf`, `status`, `tenant`, `owner`, `phone`, `email`, `poc`, `notes`, `available` (bool), `hold` (bool). owner/phone/email/poc/notes come from BOT-tab cols 6-10 and are null when blank.

### `config/properties`
One document. Contains a `properties` array — each entry:
```
id, driveId, itemId, property, address, yardi_url, sharepoint_url
```
(Some older entries also carry `available_statuses`/`hold_statuses` strings — these are **obsolete and ignored**; the parser normalizes statuses itself. The Add Location form still shows those fields but they have no effect.)

---

## n8n — ACTUAL current workflow state (both workflows combined in one file)

### Availability Sync chain
Triggered by: **Webhook** (path: `availability-sync`, receives `{ propId }`)
```
Webhook → Get property config → Find property → Get file metadata1 
→ Merge metadata → List worksheets1 → Pick data sheet 
→ Read sheet data1 → Parse + build patch → Write to Firestore1 [dead end]
```

### Add Location chain  
Triggered by: **Webhook1** (path: `add-location`, receives full location payload)
```
Webhook1 → Parse URL + generate ID → Resolve SharePoint file 
→ Extract file IDs → Read current config → Build updated config 
→ Save config → Save PA to availability → Get property config (→ continues into the sync chain)
```
Adding a location now also immediately syncs its availability — `Save PA to availability` writes the PA name/phone/email onto the availability doc and then feeds into the sync chain's `Get property config`.

---

## n8n changes (all applied 2026-06-08 — authoritative export: `n8n/5_add_location.json`)

### 1. Connect Add Location chain to sync — ✅ DONE
`Save config → Save PA to availability → Get property config` is wired, so adding a location immediately syncs it.

### 2. Parse + build patch — ✅ DONE (rewritten 2026-06-08)
The sync reads the licensee tab. **Tab names vary** ("BOT - NEW ACTIVE LICENSEE" at Pellissier, "BOT - Active Licensee Lists" at Reyes, etc.), so "Pick data sheet" matches by PATTERN — first worksheet whose name contains "LICENSEE", then "ALL UNITS", then starts-with "BOT", else sheet[0]. (Exact-name matching was the bug that left Reyes with zero units — it fell back to the wrong sheet.) The parser was rewritten to handle the real variations found in the live CA sheets:

- **Type normalization** — buckets units whether the sheet uses codes (`WH`/`OFFICE`/`DOCK`/`TRAILER`, e.g. Pellissier) or words (`Warehouse`/`Office`/`Dedicated`/`Shared`/`Trailer/Truck`/`Small Vehicle`, e.g. Reyes/Walnut). The OLD code only matched `WH`, so spelled-out sheets summed to **zero** units per category — that was the core bug.
- **Broad unit pattern** `/^[A-Z]{1,5}\d{1,4}(?:[A-Z]|-[A-Z0-9]{1,3})?$/i` — matches `A1`, `A01`, `A12B`, `A31-A`, `B01-A`, `C01-A`, `R101`, `DOCK01`, `DOCK 14`, `DD01`, `P01`.
- **A unit on hold counts as available**: `isHold = status/tenant contains "hold"`; `available = (status === 'vacant') || isHold`. Hold is kept as a separate boolean only for display (the Hold pill + notes), but holds are bucketed as available everywhere (summaries + filters).

Full node code: **`n8n/parse_build_patch.node.js`** (paste into the node's JS Code field). Tested against real Pellissier / Reyes / Walnut rows — every category returns correct non-zero counts and all edge-case unit IDs are captured. The reference copy `4_availability_sync.json` (node `av-009`) is already updated to match.

### 3. ~~Update "Build updated config" code~~ — NO LONGER NEEDED
The parser self-normalizes statuses, so per-location `available_statuses`/`hold_statuses` config is obsolete. Skip.

### 4. Fix "Find property" code — ✅ DONE
The dead `$('Prep PA patch')` reference is gone. Because "Find property" now runs from BOTH the availability-sync webhook AND the add-location tail (only one of those nodes executes per run), the propId lookup reads each inside try/catch so the unexecuted node doesn't throw:
```javascript
let propId = '';
try { propId = $('Webhook').first().json.body?.propId || ''; } catch (e) {}
if (!propId) { try { propId = $('Build updated config').first().json?.propId || ''; } catch (e) {} }
if (!propId) throw new Error('No propId found');
```
Also fixed: "Save PA to availability" was writing a literal `"="` into the PA fields — its jsonBody was rebuilt as a single `JSON.stringify({...})` expression.

### 5. ~~Add `available_statuses`/`hold_statuses` to Firestore entries~~ — NO LONGER NEEDED
Obsolete: the rewritten parser normalizes statuses itself, so no per-location status fields are required.

### Source-sheet finding (2026-06-08)
All CA PA Weekly Report workbooks share a consistent **`BOT - NEW ACTIVE LICENSEE`** tab (Layout A: `Unit # | Unit Type | Unit SF | Unit status | Company Name | ...`, header repeats per Warehouse/Office/Dock/Parking section). This is the canonical data source — NOT the Site Plan / parking-summary tabs (those vary per location and are floor-plan art). The earlier idea of building per-workbook "AppData" formula tabs is unnecessary: the BOT tab already IS the standard. Note: Yardi rent-roll exports (`_validated_` files) are clean too but Yardi is being discontinued, so do not depend on them.

---

## Current locations
| propId | Property | Notes |
|--------|----------|-------|
| `pellissier-2720` | 2720 Pellissier, City of Industry | Tab uses short type codes (WH/OFFICE/DOCK/TRAILER). R-units = OFFICE |
| `11179-banana-fontana` | 11179 Banana, Fontana | DD-units = DOCK. Parser handles DD01-DD14 |
| `reyes-compton` | Reyes, Rancho Dominguez | Licensee tab is named "BOT - Active Licensee Lists" — pattern match handles it; types spelled out (Warehouse/Office/Dedicated/Trailer) |
| `218-machlin-walnut` | 218 Machlin Ct, Walnut | single-digit (A1) + 3-digit office (R101) unit IDs |

More CA locations (Terminal West Sac, Fresno, Airport Ontario, La Mirada) are being onboarded via the Add Location flow; quick-fill entries live in `LOCATION_PRESETS`. SharePoint links for the CA set are in `sharepoint_location_links.txt`.

### Banana Fontana unit structure (from SharePoint)
- WH: A01-A09, B01-B05, C01-C03, D01-D04, E01-E07
- OFFICE: R01-R08
- DOCK: DD01-DD14
- PARKING: P01+

---

## App structure (index.html key functions)
- `renderAvailability()` — renders a search box + location cards **grouped by state**. `stateOf(d)` parses the 2-letter state from the address (`, ST 99999`); groups are labeled via `STATE_NAMES`, "Other" last.
- `onAvailSearch(v)` / `applyAvailSearch()` — Avail search box; live-filters cards by name/address/id and hides empty state groups (toggles `display`, no re-render, so it stays snappy)
- `removeLocation(propId, ev)` — Remove button at the bottom of an expanded card; confirms, strips the entry from `config/properties`, deletes the `availability/{propId}` doc (card vanishes via onSnapshot). Direct Firestore, no n8n; does NOT touch the SharePoint sheet
- `renderLocCard(propId, d)` — collapsible card. Collapsed shows: availability chips, PA name+phone, Yardi/SP links, ⟳ refresh
- `renderLocBody(propId, d)` — expanded: stats grid, filter chips (Available/Occupied/All, default Available via `availFilter[propId]`; no Hold filter — holds are available), per-section unit row lists (WH/Office/Dock; Parking is count-only in the stats grid), floor plan. Rows are compact; clicking a row expands tenant/owner/phone/email/poc/notes. `isAvail(u) = u.available || u.hold`.
- `setAvailFilter(propId, f, ev)` — sets the unit filter and re-renders the body
- `toggleUnitDetail(key, ev)` — expands/collapses a unit's detail panel
- `renderFloorplans(propId)` — SVG floorplan. Currently only `pellissier-2720` has one. Banana Fontana needs one built.
- `triggerAvailSync(propId)` — POSTs `{ propId }` to Cloudflare Worker
- `submitAddLocation()` — POSTs full location payload to Cloudflare Worker
- `LOCATION_PRESETS` — quick-fill buttons in Add Location modal. Add entries here for each new location.
- unit rows (inside `renderLocBody`) — show a status pill (Available/Occupied/Hold) driven by the `hold`/`available` booleans, not by status text
- **Leads** have drag-to-reorder like Tasks (`leadDragStart/Over/Drop`, `order` field, `byOrder` sort), plus `toggleHideWaitlist()` — the "Hide ⏳" toggle in the Leads filter row that drops `wl_on` leads from the Do/Wait board (except when the ⏳ Waitlist filter is active).

### Gotcha — function exposure (ES module scope)
The `<script type="module">` means functions are NOT global. Any function referenced from an inline `onclick=`/`ondrag*=`/`oninput=` attribute MUST be added to the `window.* = ...` block near the bottom of the module, or it throws "X is not defined" at click time. (This caused the original drag bug — the handlers existed but weren't exposed.) When adding a new inline handler, always add the matching `window.` line.

## Floorplan SVGs (in renderFloorplans function)
- `pellissier-2720`: warehouse (D01-D05, B01, C01-C05, A01-A02) + office (R01-R09)  
- `11179-banana-fontana`: NOT YET BUILT — needs SVG for A01-E07 WH, R01-R08 OFFICE

---

## Follow-up model — DECIDED 2026-06-10: scanner only, sequencer OFF
Justin's rule is simple: **"no correspondence in 3 days → follow up,"** where correspondence = Outlook email (either direction) **OR** any thread update he logs. That's the **Follow-up Scanner (workflow 6)** + the 🔔 Follow-ups tab, and it's the ONLY follow-up mechanism we run. The 5-touch sequencer (workflows 1–3) is intentionally **left off** — it fires on a fixed cadence regardless of whether you've been in contact, which produces exactly the "false" notifications Justin wants to avoid. **In n8n, run only workflow 6** (plus the unrelated availability workflow 5). Do **not** activate 1/2/3. The sequencer docs below are kept only in case that decision is ever revisited.

## Email sequencer (n8n workflows 1-3) — MANUAL-SEND model (currently OFF — see decision above)
Separate from availability. A 5-touch follow-up cadence. **Sending is manual** (Justin sends from his own Outlook) to avoid needing the `Mail.Send` Graph scope:
- **Activate workflows 1 + 3 only; workflow 2 stays OFF.**
- **Workflow 1** (`1_queue_checker.json`, 8am daily) drafts the next due touch and writes `pending_email` to the lead — Firestore only, no Graph. Fires for `seq_status === 'active'` leads (new leads default to `active`, so they auto-enroll) with an email and `next_due_date <= today`, up to 5 touches.
- **App** renders the draft (`renderEmailPreview`) with **✉️ Open in email** (`openSequencerEmail` → `mailto:`) and **✓ Mark sent** (`markTouchSent` → advances the cadence client-side: sets `current_step`, `last_touch_date`, `next_due_date` per `SEQ_CADENCE = {1:4,2:6,3:7,4:9}`, `seq_status` active/closed, clears `pending_email`). Plus Snooze/Skip. This replaced the old "Approve & Send" button (which wrote `seq_status='send_approved'` for workflow 2). All handlers exposed on `window.*`.
- **Workflow 3** (`3_reply_detector.json`, every 30 min, read-only `Mail.Read`) flips a replying lead to `seq_status='replied'`, removing it from the queue.
- **Workflow 2** (`2_send_trigger.json`) = the auto-sender; **unused** unless `Mail.Send` is later granted. To enable full auto-send: grant `Mail.Send` + admin consent, activate workflow 2, and swap the app's two send buttons back to one "Approve & Send". See `n8n/SETUP.md`.

## Follow-up Scanner (n8n workflow 6)
The follow-up system Justin actually asked for: surface "leads that haven't been contacted in 3 days." Separate from (and simpler than) the 5-touch sequencer — it never sends anything, it only **measures last contact from Outlook and flags cold leads**.

- **`n8n/6_followup_scanner.json`** — runs daily at 7am (cron `0 7 * * *`). Reads all `leads` from Firestore, filters in code to open/contactable leads (has email; not archived; stage not won/lost; `seq_status` ≠ `replied`; not snoozed), then for each lead queries Microsoft Graph `GET /users/{OUTLOOK_USER_ID}/messages?$search="participants:<email>"` and takes the newest `receivedDateTime`/`sentDateTime` across the hits (captures both directions, all folders). Writes `last_contact_date`, `days_since_contact`, `followup_due`, `followup_contacted`, `followup_checked_at` back to the lead. Reuses the **same two credentials** as the other workflows: `Microsoft OAuth2 — Cubework Outlook` and `Google Service Account — do-or-wait`, plus the `OUTLOOK_USER_ID` env var. No new credentials.
  - Graph note: `$search` can't be combined with `$orderby`, so it fetches the top 25 relevance-ranked hits and takes the max date in code — fine for a single correspondent. If a lead has zero email history, the date falls back to `createdAt` and `followup_contacted` is set false.
  - **splitInBatches v3 wiring**: the loop body hangs off output **index 1** ("loop"); output 0 ("done") is intentionally empty. (Workflow 3's loop wires the body to index 0 — that ordering is the older convention; follow the v3 ordering used here.)

### In-app surface (index.html, Leads tab)
- **`🔔 Follow-ups` filter button** (`#followup-filter-btn`, `setLeadFilter('followup')`) with a count badge of due leads.
- **Reminder banner** (`#followup-banner`) above the board: shows "N leads have gone quiet for 3+ days" with a "Review follow-ups →" button. Hidden when the Follow-ups filter is already active or nothing is due.
- **`🔔 Nd cold` chip** on each due lead card (or "no contact yet").
- **Suggested-message block** (`renderFollowupBlock`) inside a due lead's thread (only when there's no `pending_email` from the sequencer): one of 3 lightweight merge templates in `FOLLOWUP_MSGS` (Check-in / Value-add / Break-up), with **↻ cycle template** (`cycleFollowupTpl`), **✉️ Open in email** (`openFollowupEmail`, builds a `mailto:`), **📋 Copy** (`copyFollowupMsg`), and **Snooze 3 days** (`snoozeFollowup`, sets `followup_snooze_until`).
- Core logic: `FOLLOWUP_DAYS` (=3), `isFollowupDue(lead)`, `contactInfo(lead)`. All new inline handlers are exposed in the `window.*` block (per the ES-module gotcha).

### Quick-log call/text/met (launch + log in one tap)
Each active lead card shows a compact button row (`renderLeadCard` → `quickLog`): **📞 Call** / **💬 Text** when `lead.phone` is set (else a **📞 Add number** button that opens edit), plus **🤝 Met** and **📥 Inbound** (logged when a lead calls/texts *you* — manual, since a personal cell's calls/iMessages aren't readable by any API). `logTouch(leadId, kind, e)` appends a dated thread entry (`📞 Called` / `💬 Texted` / `🤝 Met` / `📥 They reached out`). Outbound kinds (call/text/met) log as type `wait` (you reached out, awaiting reply); **`inbound` logs as type `do`** (they reached out → ball's in your court, surfaces in the Do column). It then opens the card (accordion) so the outcome note is one tap away via 📝 Note, persists, then for call/text hands off to `tel:`/`sms:` (digits sanitized from `lead.phone`). This launches the dialer / Messages (iMessage on Apple) AND logs the touch in the same tap — which also resets that lead's 3-day follow-up clock (calls/texts are invisible to the Outlook scanner). New `phone` field added to the lead modal (`lf-phone`). `logTouch` is exposed on `window.*`. Note: `tel:`/`sms:` only do something on a device with a phone/Messages handler (iPhone, or Mac via Continuity) — the log still records on any platform.

---

## File locations
```
do_or_wait/
  index.html            ← entire app (push to GitHub to deploy)
  CLAUDE.md             ← this file
  sharepoint_location_links.txt ← SharePoint URLs for the CA locations (input for presets)
  n8n/
    5_add_location.json        ← AUTHORITATIVE combined live workflow (both the availability-sync
                                  and add-location chains). Import THIS into n8n. Edit by hand here
                                  (the bash mount is read-only) or in the n8n UI, then re-export.
    parse_build_patch.node.js  ← clean paste-ready copy of the "Parse + build patch" node code
    4_availability_sync.json   ← older reference copy of just the sync chain (redundant — 5_add_location.json supersedes it)
    1_queue_checker.json       ← email sequencer
    2_send_trigger.json
    3_reply_detector.json
    6_followup_scanner.json    ← Follow-up Scanner: flags leads cold 3+ days (Outlook/Graph → Firestore). No sending.
    templates.json
    SETUP.md
```

---

## Quick reference — webhook URLs
- Availability sync: `https://plain-credit-5962.jchoustin91.workers.dev/webhook/availability-sync`
- Add location: `https://plain-credit-5962.jchoustin91.workers.dev/webhook/add-location`
- n8n base: `https://ailinker.item.com`
