# Do or Wait — Project Brief for Claude

## What this is
A web app for Justin Cho (Justin.Cho@cubework.com) at Cubework. Three tabs:
1. **Tasks** — DO/WAIT topic threads (digital sticky note system)
2. **Leads** — Sales pipeline for leasing prospects, same DO/WAIT thread model  
3. **🏭 Avail** — Real-time availability dashboard for Cubework warehouse locations

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

**Waitlist fields** (a lead can be put on the waitlist to watch for matching space): `wl_on` (bool), `wl_regions` (array of state codes, e.g. `["CA"]`), `wl_type` (`any`/`WH`/`OFFICE`/`DOCK`/`TRAILER`), `wl_sf_min`, `wl_sf_max`. The "⏳ Waitlist" lead filter shows only `wl_on` leads. On an expanded waitlisted lead, **🔎 Check matches** (`checkWaitlist(leadId)`) scans `availMap` client-side for available-or-hold units in the watched region(s) matching type + size, and renders the hits inline (`renderWaitlistBlock`). No n8n involved — it reads the already-synced availability data.

### `availability/{propId}`
Written by n8n after syncing each property's SharePoint file. Fields: `property`, `address`, `yardi_url`, `sharepoint_url`, `sheet_last_modified`, `synced_at`, `wh{}`, `office{}`, `dock{}`, `parking{}`, `units[]`, `pa{name,phone,email}`

Each entry in `units[]` (parsed from the BOT tab): `unit`, `type` (WH/OFFICE/DOCK/TRAILER), `sf`, `status`, `tenant`, `owner`, `phone`, `email`, `poc`, `notes`, `available` (bool), `hold` (bool). owner/phone/email/poc/notes come from BOT-tab cols 6-10 and are null when blank.

### `config/properties`
One document. Contains `properties` array — each entry:
```
id, driveId, itemId, property, address, yardi_url, sharepoint_url,
available_statuses (string, comma-separated e.g. "Vacant,"),
hold_statuses (string, comma-separated e.g. "HOLD,Hold")
```
Note: `available_statuses` and `hold_statuses` are NOT yet added to Pellissier or Banana Fontana entries — need to add manually in Firestore Console.

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
→ Save config → [NOT YET connected to Save PA or to availability sync]
```

**Save PA to availability** node exists but is disconnected from the main flow.

---

## What needs to be fixed in n8n (priority order)

### 1. Connect Add Location chain to trigger availability sync
After `Save config`, wire: `Save config → Save PA to availability → Get property config`  
This makes adding a location also immediately sync its availability data.

### 2. Parse + build patch — ✅ DONE (rewritten 2026-06-08)
The sync reads the licensee tab. **Tab names vary** ("BOT - NEW ACTIVE LICENSEE" at Pellissier, "BOT - Active Licensee Lists" at Reyes, etc.), so "Pick data sheet" matches by PATTERN — first worksheet whose name contains "LICENSEE", then "ALL UNITS", then starts-with "BOT", else sheet[0]. (Exact-name matching was the bug that left Reyes with zero units — it fell back to the wrong sheet.) The parser was rewritten to handle the real variations found in the live CA sheets:

- **Type normalization** — buckets units whether the sheet uses codes (`WH`/`OFFICE`/`DOCK`/`TRAILER`, e.g. Pellissier) or words (`Warehouse`/`Office`/`Dedicated`/`Shared`/`Trailer/Truck`/`Small Vehicle`, e.g. Reyes/Walnut). The OLD code only matched `WH`, so spelled-out sheets summed to **zero** units per category — that was the core bug.
- **Broad unit pattern** `/^[A-Z]{1,5}\d{1,4}(?:[A-Z]|-[A-Z0-9]{1,3})?$/i` — matches `A1`, `A01`, `A12B`, `A31-A`, `B01-A`, `C01-A`, `R101`, `DOCK01`, `DOCK 14`, `DD01`, `P01`.
- **A unit on hold counts as available**: `isHold = status/tenant contains "hold"`; `available = (status === 'vacant') || isHold`. Hold is kept as a separate boolean only for display (the Hold pill + notes), but holds are bucketed as available everywhere (summaries + filters).

Full node code: **`n8n/parse_build_patch.node.js`** (paste into the node's JS Code field). Tested against real Pellissier / Reyes / Walnut rows — every category returns correct non-zero counts and all edge-case unit IDs are captured. The reference copy `4_availability_sync.json` (node `av-009`) is already updated to match.

### 3. ~~Update "Build updated config" code~~ — NO LONGER NEEDED
The parser self-normalizes statuses, so per-location `available_statuses`/`hold_statuses` config is obsolete. Skip.

### 4. Update "Find property" code
Current code tries `$('Prep PA patch')` which no longer exists. Replace with:
```javascript
const propId = $('Webhook').first().json.body?.propId 
            || $('Build updated config').first().json?.propId 
            || '';
```

### 5. ~~Add `available_statuses`/`hold_statuses` to Firestore entries~~ — NO LONGER NEEDED
Obsolete: the rewritten parser normalizes statuses itself, so no per-location status fields are required.

### Source-sheet finding (2026-06-08)
All CA PA Weekly Report workbooks share a consistent **`BOT - NEW ACTIVE LICENSEE`** tab (Layout A: `Unit # | Unit Type | Unit SF | Unit status | Company Name | ...`, header repeats per Warehouse/Office/Dock/Parking section). This is the canonical data source — NOT the Site Plan / parking-summary tabs (those vary per location and are floor-plan art). The earlier idea of building per-workbook "AppData" formula tabs is unnecessary: the BOT tab already IS the standard. Note: Yardi rent-roll exports (`_validated_` files) are clean too but Yardi is being discontinued, so do not depend on them.

---

## Current locations
| propId | Property | Notes |
|--------|----------|-------|
| `pellissier-2720` | 2720 Pellissier, City of Industry | Working. R-units = OFFICE. DOCK units = DOCK |
| `11179-banana-fontana` | 11179 Banana, Fontana | Added. DD-units = DOCK. Parser now handles DD01-DD14 (fixed 2026-06-08) |

### Banana Fontana unit structure (from SharePoint)
- WH: A01-A09, B01-B05, C01-C03, D01-D04, E01-E07
- OFFICE: R01-R08
- DOCK: DD01-DD14
- PARKING: P01+

---

## App structure (index.html key functions)
- `renderAvailability()` — loops `availMap`, calls `renderLocCard()` per property
- `renderLocCard(propId, d)` — collapsible card. Collapsed shows: availability chips, PA name+phone, Yardi/SP links, ⟳ refresh
- `renderLocBody(propId, d)` — expanded: stats grid, filter chips (Available/Occupied/All, default Available via `availFilter[propId]`; no Hold filter — holds are available), per-section unit row lists (WH/Office/Dock; Parking is count-only in the stats grid), floor plan. Rows are compact; clicking a row expands tenant/owner/phone/email/poc/notes. `isAvail(u) = u.available || u.hold`.
- `setAvailFilter(propId, f, ev)` — sets the unit filter and re-renders the body
- `toggleUnitDetail(key, ev)` — expands/collapses a unit's detail panel
- `renderFloorplans(propId)` — SVG floorplan. Currently only `pellissier-2720` has one. Banana Fontana needs one built.
- `triggerAvailSync(propId)` — POSTs `{ propId }` to Cloudflare Worker
- `submitAddLocation()` — POSTs full location payload to Cloudflare Worker
- `LOCATION_PRESETS` — quick-fill buttons in Add Location modal. Add entries here for each new location.
- unit rows (inside `renderLocBody`) — show a status pill (Available/Occupied/Hold) driven by the `hold`/`available` booleans, not by status text

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
  n8n/
    4_availability_sync.json   ← reference copy (actual edits done in n8n UI)
    5_add_location.json        ← reference copy
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
