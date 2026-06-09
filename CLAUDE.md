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

## Firestore collections

### `topics/{id}`
Task threads. Fields: `title`, `archived`, `entries[]`, `createdAt`

### `leads/{id}`
Sales leads. Thread structure + lead-specific fields: `company`, `first_name`, `email`, `contact`, `segment`, `stage`, `location`, `sqft`, `leaseLength`, `moveIn`, `unit`, `unit_sf`, `dock`, `rate`, `included_items`, `alt_option`, `is_importer`, `current_step`, `last_touch_date`, `next_due_date`, `seq_status`, `pending_email` (written by n8n when email ready to approve)

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

## Email sequencer (n8n workflows 1-3)
Separate from availability. For sending 5-touch follow-up emails to leads. See `n8n/SETUP.md`. Not yet activated/tested end-to-end.

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
    templates.json
    SETUP.md
```

---

## Quick reference — webhook URLs
- Availability sync: `https://plain-credit-5962.jchoustin91.workers.dev/webhook/availability-sync`
- Add location: `https://plain-credit-5962.jchoustin91.workers.dev/webhook/add-location`
- n8n base: `https://ailinker.item.com`
