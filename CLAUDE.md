# Do or Wait — Project Brief for Claude

## What this is
A web app for Justin Cho (Justin.Cho@cubework.com) at Cubework. Tabs:
1. **Tasks** — DO/WAIT topic threads (digital sticky note system)
2. **Leads** — Sales pipeline for leasing prospects, same DO/WAIT thread model  
3. **📞 Playbook** — cold-call flow script + a searchable **Battle Cards** quick-reference at the top (`PLAYBOOK_CARDS` / `renderPlaybookCards`): Triple-A value, objection rebuttals, vs-traditional-lease, pricing quick-ref, what's-included, TCO story, sell-by-decision-maker, products, taglines — distilled from the Cubework Sales Playbook `_kb` (in the `Sales/` project folder). Collapsible; searching auto-expands matches.
4. **🏭 Avail** — Real-time availability dashboard for Cubework warehouse locations. Has an **⬇ Export JSON** button (toolbar) that opens a location-picker modal (`openAvailExport` / `doAvailExport`, overlay `#availexp-overlay`): choose which sites to include, then it **always syncs-first for client-fresh data** — it POSTs `AVAIL_WEBHOOK` (n8n workflow 4) per chosen location, waits for the Firestore write-back by polling each doc's `synced_at` against a pre-trigger baseline (deadline scales with location count, capped 5 min), then pulls a `getDocsFromServer` snapshot and downloads the selected docs as `do-or-wait-availability-YYYY-MM-DD.json` (array of `{_id, ...doc}`, same shape the listener consumes). Locations whose sync doesn't confirm in time are still exported (last-known) with a ⚠ note in the modal status.
5. **💲 Pricing** — National rate card (read-only). Searchable table grouped by state; click a row to expand full pricing detail. Reads `pricing/current` (n8n-synced), falls back to `pricing-seed.js` snapshot.
6. **💡 Notes** — Ideas/issues notebook (two editable fields per note, filter by date created)

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

**Follow-up fields** (written by the n8n Follow-up Scanner — workflow 6 — from Outlook/Graph): `last_contact_date` (YYYY-MM-DD of the most recent email to/from the lead), `last_contact_dir` (`out`/`in` — direction of that newest email: `in` = received from the lead, `out` = we sent it), `days_since_contact` (int), `followup_contacted` (bool — false if no email history was found and the date fell back to lead creation), `followup_due` (bool — true at ≥3 **business** days **and** `last_contact_dir==='out'`), `followup_checked_at` (ISO of last scan), `followup_snooze_until` (YYYY-MM-DD — set by the app's "Snooze" button, suppresses the lead until that date).

**Update categories (decided 2026-06-10).** Each lead thread entry has a `kind`: `note` (internal — "talked to Kevin", "looked into locations"; **NOT** counted as contact), or a contact brief `email`/`call`/`text`/`met`/`inbound` (counts). The ＋ Update modal shows a category picker for leads (`#m-kind-row`, `pickKind`/`syncKindUI`, state `mSelKind`, default `note`); quick-log buttons set the kind directly. `contactInfo` only counts brief entries (kind ∈ email/call/text/met/inbound) **plus legacy entries with no `kind`** (grandfathered as contact so existing leads' clocks don't recalculate); `kind==='note'` is skipped. So the follow-up clock = days since your last real lead contact, ignoring internal notes. (`✉️ Email` briefs use your typed text for now; reading the actual email is a later upgrade, gated on the scanner being live.)

**Follow-ups are OUTBOUND-COLD only (decided 2026-06-10).** A lead is a follow-up only when its *most-recent* contact was **outbound** (you reached out) and it's been ≥3 days. If the latest contact was **inbound** (an email received from them, or a 📥 Inbound log), the ball's in your court — that's a separate "needs-reply" job (not yet built; those leads sit in the **Do** column via the inbound log's `type:'do'`). `contactInfo(lead)` computes the most-recent contact across `last_contact_date`(+`last_contact_dir`) / `last_touch_date`(out) / thread entries — counting only contact briefs (`kind==='note'` skipped; legacy no-`kind` entries grandfathered as contact), each carrying `dir` (`out` for 📞/💬/✉️, `in` for 📥). It returns `{days, bizDays, date, contacted, dir}`; `isFollowupDue` requires `dir==='out'` **and** `bizDays >= FOLLOWUP_DAYS` (business days — see weekends note below). The app **does not depend on the scanner having run** — it works off your updates immediately; the scanner just folds in live Outlook email (with direction) once running.

**Waitlist fields** (a lead can be put on the waitlist to watch for matching space): `wl_on` (bool), `wl_locations` (array of propIds to watch), `wl_type` (`any`/`WH`/`OFFICE`/`DOCK`/`TRAILER`), `wl_sf_min`, `wl_sf_max`. The "⏳ Waitlist" lead filter shows only `wl_on` leads. The modal sets `wl_on`/type/size; **locations are chosen on the lead card** via `renderWaitlistBlock` — a collapsible block (`wlCollapsed` Set, `wlToggleCollapse`) with a "＋ Add location…" dropdown of current `availMap` locations and removable chips (`wlAddLocation`/`wlRemoveLocation`, which persist + re-render). Matches compute inline every render via `wlMatches(lead)` (available-or-hold units in the chosen locations matching type + size) — no button, the list updates live as you add/remove locations. All client-side against synced availability; no n8n.

### `notes/{id}`
Ideas/issues notebook (💡 Notes tab). Fields: `why` (text — "Why does this issue matter?"), `fix` (text — "What's the fix?"), `createdAt`, `updatedAt`, `_deleted` (soft-delete flag). Notes have a **view mode** (read-only, shows Created + Edited dates, with Edit/Delete buttons) and an **edit mode** (textareas + Save/Cancel). `editingNotes` Set tracks which note ids are open for editing; `editNote`/`cancelNote`/`saveIdeaNote` toggle it. New notes open straight into edit mode. The tab has a Newest/Oldest sort and a "Since" date filter on `createdAt`.

### `availability/{propId}`
Written by n8n after syncing each property's SharePoint file. Fields: `property`, `address`, `yardi_url`, `sharepoint_url`, `sheet_last_modified`, `synced_at`, `wh{}`, `office{}`, `dock{}`, `parking{}`, `units[]`, `pa{name,phone,email}`, `ownership` (`own`/`lease`/`''`), `lease_expiration` (YYYY-MM-DD).

**App-edited fields survive sync**: `pa`, `ownership`, and `lease_expiration` are written directly from the app via Firestore REST PATCH and are NOT in the sync's `updateMask`, so re-syncs don't clobber them. `ownership`/`lease_expiration` are set via the Ownership modal (`openEditOwnership`/`saveOwnership`); the collapsed location card shows an ownership badge (🏢 Owned / 📄 Leased · exp date, red if expired) that opens the modal on click.

Each entry in `units[]` (parsed from the BOT tab): `unit`, `type` (WH/OFFICE/DOCK/TRAILER), `sf`, `status`, `tenant`, `owner`, `phone`, `email`, `poc`, `notes`, `available` (bool), `hold` (bool). owner/phone/email/poc/notes come from BOT-tab cols 6-10 and are null when blank.

### `pricing/current`
One document — the national rate card. Written by the **n8n Pricing Sync (workflow 7)** from the SharePoint master price sheet (`New Master List_ Price.xlsx`, tab `New Price Sheet 2026`, on the **Sales_US** site). Fields: `rows` (array of per-location maps), `updatedAt`, `source`, `count`. Each row map: `state, city, address, sub2k, r2_5k, r5k, r5k_12mo, office_mo, office, dock, desk, virtual, truck, small_veh, wifi, annual, deposit, dp_office, dp_wh, dp_xdock, studio, conf, event, amenities, special` (blank fields omitted; per-SF tiers numeric, ranges/"n/a" as strings). The **💲 Pricing tab** reads this; if absent it falls back to the bundled snapshot in `pricing-seed.js`. (Decided to use n8n because the sheet changes often — same rationale as availability.) The sheet's **Special Pricing** column (negotiation notes, e.g. "$1.45 for 6mo, 1st month free for 12mo") and **Amenities** are captured as `special`/`amenities` and render full-width (line breaks preserved) in a row's expanded detail; rows with `special` show a 💬 badge. NOT captured: Excel cell *comments* (price-change history / stray notes) — they aren't part of the cell values, so neither the snapshot parse nor the Graph sync reads them.

### `renewals/current`
One document — the per-tenant lease-renewal / expiration tracker. Written by the **n8n Renewals Sync (workflow 10)** from the Google Sheet renewal tracker (`gid 844109688`, link-viewable; read via its CSV `export?format=csv` URL — no Graph/creds for the read). Fields: `rows` (array of per-unit maps), `updatedAt`, `source`, `count`. Each row map: `property` (sheet's name, e.g. "CA Walnut" / "COI Pellissier 2720 (128)"), `unit`, `tenant`, `lease_type`, `amendment` (Renewal/Original Lease/Expansion/HoldOver), `end_date` (YYYY-MM-DD), `decision` (the "Increase Reason" outcome: Same Rate / Market Price / $0.10 Increase Only / 4% + $0.10 Increase Only / DO NOT RENEW / Pause Renewal / Renewed / New Office Rate — may be blank for not-yet-processed rows), `stage` (email lifecycle: Sent PI Email / Sent No Increase Email / DO NOT RENEW), `remarks` (joined Remarks/Additional/Retention notes), `monthly_rent`. Multi-unit sheet rows ("C09, C10") are **exploded into one record per unit** by the parser.

**Parsing nuance:** the sheet's right-hand columns drift (merged header cells), so the parser reads the stable left block by header NAME and resolves `decision`/`stage` by scanning each row against a known vocabulary (position-independent). The sheet stacks **two blocks**: the active cohort (decision + stage populated, real July end-dates) and a coded roster (`(818)` property / `(t000###)` tenant codes, uniform 7/31 placeholder-ish end-date, blank decision = not yet processed). Both are kept; they cover **disjoint units** per building (verified — no overlap), and blank `decision` renders as "—" so unprocessed rows read as preliminary. Node parser: **`n8n/parse_renewals.node.js`** (paste-ready copy of the Code-node JS).

**App surface (Avail tab, occupied unit rows):** `renewalsForLoc(propId, d)` builds a Map of unit-id→record for a location by matching the sheet `property`'s **place token** (`renewalPlace()` strips the `(code)`, a leading region prefix like `CA`/`COI`/`TX`, and trailing numbers → "pellissier"/"banana"/"walnut"…) against the location's `property + address` (substring, token ≥4 chars). Records WITH a decision win over blank ones. Each occupied unit row shows a color-coded `renewalBadge` (📅 exp date; amber ≤90 days, red if expired or DO NOT RENEW); the expand panel adds Lease ends / Renewal status / stage / remarks. Memoized via `renewalVer`/`_renewalLocCache`; the `renewals/current` listener bumps the version and re-renders. **Matching is heuristic** — only synced CA/COI locations match today; nationwide rows for un-onboarded sites simply don't display, and a new location matches automatically once its place name aligns. No snapshot fallback (unlike pricing).

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
- `renderAvailability()` — renders a search box + **sort toggle** + location cards **grouped by state (region)**. `stateOf(d)` parses the 2-letter state from the address (`, ST 99999`); groups are labeled via `STATE_NAMES`, "Other" last.
- **Sort by availability (added 2026-06-17).** `availSort` (`'sf'` default | `'name'`), toggled by `setAvailSort(key)` (re-renders). `availSfTotal(d)` = **total available square footage = warehouse `wh.avail_sf` + office `office.avail_sf`** (counted separately, summed; dock/parking excluded). When `availSort==='sf'`: regions are ordered by their total available sq ft (desc, "Other" last) and locations within each region by `availSfTotal` (desc, name tiebreak) — so the site with the most availability sits at the very top. `'name'` = the old A–Z order. Each region header shows a green `N sf avail` total. This is the "generate the site with the most availability" feature — it's a live sort of the Avail tab, not a separate report.
- `onAvailSearch(v)` / `applyAvailSearch()` — Avail search box; live-filters cards by name/address/id and hides empty state groups (toggles `display`, no re-render, so it stays snappy)
- `removeLocation(propId, ev)` — Remove button at the bottom of an expanded card; confirms, strips the entry from `config/properties`, deletes the `availability/{propId}` doc (card vanishes via onSnapshot). Direct Firestore, no n8n; does NOT touch the SharePoint sheet
- `renderLocCard(propId, d)` — collapsible card. Collapsed shows: availability chips, PA name+phone, Yardi/SP links, ⟳ refresh
- `renderLocBody(propId, d)` — expanded: stats grid, filter chips (Available/Occupied/All, default Available via `availFilter[propId]`; no Hold filter — holds are available), per-section unit row lists (WH/Office/Dock; Parking is count-only in the stats grid), floor plan. Rows are compact; clicking a row expands tenant/owner/phone/email/poc/notes. `isAvail(u) = u.available || u.hold`. Occupied rows also show a lease-renewal badge from `renewals/current` (see that collection above) — `renewalsForLoc`/`renewalBadge`; the expand adds Lease ends / Renewal status / stage / remarks.
- `setAvailFilter(propId, f, ev)` — sets the unit filter and re-renders the body
- `toggleUnitDetail(key, ev)` — expands/collapses a unit's detail panel
- `renderFloorplans(propId)` — **data-driven** SVG floorplan. Reads layout via `fpLayout(propId)` (Firestore `floorplans/{propId}`, else `FLOORPLAN_SEED` from `floorplan-seed.js`); `floorplanSVG()` renders items (`k:'u'` unit→live status colors via `fpRect`, `k:'l'` label, `k:'n'` note) over an optional faded `bg` image. Floor tabs auto-shown per floor present; properties with no layout show "No floor plan yet". Editor (Layer 2) is how others get added/updated.
- `triggerAvailSync(propId)` — POSTs `{ propId }` to Cloudflare Worker
- `submitAddLocation()` — POSTs full location payload to Cloudflare Worker
- `LOCATION_PRESETS` — quick-fill buttons in Add Location modal. Add entries here for each new location.
- unit rows (inside `renderLocBody`) — show a status pill (Available/Occupied/Hold) driven by the `hold`/`available` booleans, not by status text
- **Leads** have drag-to-reorder like Tasks (`leadDragStart/Over/Drop`, `order` field, `byOrder` sort), plus `toggleHideWaitlist()` — the "Hide ⏳" toggle in the Leads filter row that drops `wl_on` leads from the Do/Wait board (except when the ⏳ Waitlist filter is active).

### Gotcha — function exposure (ES module scope)
The `<script type="module">` means functions are NOT global. Any function referenced from an inline `onclick=`/`ondrag*=`/`oninput=` attribute MUST be added to the `window.* = ...` block near the bottom of the module, or it throws "X is not defined" at click time. (This caused the original drag bug — the handlers existed but weren't exposed.) When adding a new inline handler, always add the matching `window.` line.

## Floorplans — DATA-DRIVEN (decided 2026-06)
Layout lives in **data, not code**: Firestore `floorplans/{propId}` (editor-saved) overrides the bundled `floorplan-seed.js` (`window.FLOORPLAN_SEED`). Shape per property: `{ warehouse:{viewBox,bg,items[]}, office:{...} }`; each item `{k,id?,t?,x,y,w,h,bg?,tc?,anchor?}` where `k`: `u`=unit (live status by `id`), `l`=label (room/area box), `n`=note (free text). `bg` is an optional faded underlay image URL. Pellissier seeded from its old hardcoded SVG (renders identically — `pellissier-2720` warehouse D01-D05/B01/C01-C05/A01-A02, office R01-R09). **Editor (in `index.html`, `fpRenderEditor`/`fpStartEdit`/`fpSaveEdit` etc.):** "✏️ Edit" on the floor-plan section. Done so far — drag to move (`fpDragStart`/`fpDragMove`, SVG `getScreenCTM` transform, direct attribute updates mid-drag), corner-handle resize, Warehouse/Office switch, Save→`floorplans/{propId}` / Cancel (draft is a deep clone so edits can't corrupt the seed). **Sq-ft editing:** tap a unit → `fpSel`/`fpSetSf` → pending in `fpSfEdits` → on Save, writes the new `sf` into `availability/{propId}.units` (setDoc merge) so the location list / floorplan label / matching all update. The SharePoint availability sync **will overwrite** these on its next run — accepted tradeoff. **Reallocate (`fpPair`, `fpStartRealloc`/`fpReallocFromA`/`fpReallocFromB`):** from a selected unit, "reallocate with" another → their combined sq ft is locked and a slider + two linked inputs move footage between them live (A+B always = total); both write to availability on Save. A live "building total (sum of units)" readout is shown. Conserves the *pair* total (not gross building SF, which includes common area). **Split (`fpSplitUnit`, `fpNewUnits`):** "✂️ Split into two" on a selected unit creates a NEW unit (auto-suggested id `A01-B`/`-C`…, dedup-checked; box halved off the original), divides the sq ft 50/50, and opens the reallocation slider to fine-tune. On Save the new unit is **appended to `availability/{propId}.units`** (available/vacant defaults, type copied) so it shows in the location list. Caveat: a split-created unit (and sq-ft edits) are wiped by the next SharePoint sync — and after a sync the layout box for a removed unit shows gray "no data" until the BOT tab catches up. **Create-new flow (`fpSeedIfEmpty`/`fpAddUnitsAsGrid`/`fpUnplaced`/`fpAddUnplaced`/`fpDeleteBox`/`fpUploadBg`):** "✏️ Create floor plan" on a property without a layout auto-seeds a box for every unit on that floor (office floor = `OFFICE` type, warehouse floor = the rest) in a grid; "✚ Add N unplaced units" backfills any missing; "🗑 Remove box" deletes a box (layout only — the unit stays in availability; a not-yet-saved split unit is also unstaged); "📐 Upload blueprint" sends an image to Firebase Storage and sets the floor's `bg` as a faded tracing underlay. Still to build: dock markers; unit-ID rename/dropdown on a box.

---

## Follow-up model — DECIDED 2026-06-10: scanner only, sequencer OFF
Justin's rule is simple: **"no correspondence in 3 days → follow up,"** where correspondence = Outlook email (either direction) **OR** a logged contact brief (email/call/text/inbound) — internal `note` updates don't count, and only **outbound-cold** leads surface (inbound = needs-reply; see the leads section above). That's the **Follow-up Scanner (workflow 6)** + the 🔔 Follow-ups tab, and it's the ONLY follow-up mechanism we run. The 5-touch sequencer (workflows 1–3) is intentionally **left off** — it fires on a fixed cadence regardless of whether you've been in contact, which produces exactly the "false" notifications Justin wants to avoid. **In n8n, run only workflow 6** (plus the unrelated availability workflow 5). Do **not** activate 1/2/3. The sequencer docs below are kept only in case that decision is ever revisited.

**Updated 2026-06-12 — weekends.** The 3-day clock counts **business days**, not calendar days — weekends don't count as silence, so a Friday touch isn't "3 days cold" by Monday (it's 1). Implemented in both places via a `bizDaysBetween(fromMs, toMs)` helper: `index.html` (`contactInfo` returns `bizDays`; `isFollowupDue` triggers on `bizDays >= FOLLOWUP_DAYS`) and the scanner (workflow 6 `Compute days since contact` sets `followup_due` off `bizDays`). The displayed "Nd cold" / `days_since_contact` stay **calendar** days (truthful wall-clock); only the *due trigger* uses business days. Snooze still adds calendar days. (Holidays are not yet accounted for — weekends only.)

## Email sequencer (n8n workflows 1-3) — MANUAL-SEND model (currently OFF — see decision above)
Separate from availability. A 5-touch follow-up cadence. **Sending is manual** (Justin sends from his own Outlook) to avoid needing the `Mail.Send` Graph scope:
- **Activate workflows 1 + 3 only; workflow 2 stays OFF.**
- **Workflow 1** (`1_queue_checker.json`, 8am daily) drafts the next due touch and writes `pending_email` to the lead — Firestore only, no Graph. Fires for `seq_status === 'active'` leads (new leads default to `active`, so they auto-enroll) with an email and `next_due_date <= today`, up to 5 touches.
- **App** renders the draft (`renderEmailPreview`) with **✉️ Open in email** (`openSequencerEmail` → `mailto:`) and **✓ Mark sent** (`markTouchSent` → advances the cadence client-side: sets `current_step`, `last_touch_date`, `next_due_date` per `SEQ_CADENCE = {1:4,2:6,3:7,4:9}`, `seq_status` active/closed, clears `pending_email`). Plus Snooze/Skip. This replaced the old "Approve & Send" button (which wrote `seq_status='send_approved'` for workflow 2). All handlers exposed on `window.*`.
- **Workflow 3** (`3_reply_detector.json`, every 30 min, read-only `Mail.Read`) flips a replying lead to `seq_status='replied'`, removing it from the queue.
- **Workflow 2** (`2_send_trigger.json`) = the auto-sender; **unused** unless `Mail.Send` is later granted. To enable full auto-send: grant `Mail.Send` + admin consent, activate workflow 2, and swap the app's two send buttons back to one "Approve & Send". See `n8n/SETUP.md`.

## Follow-up Scanner (n8n workflow 6)
The follow-up system Justin actually asked for: surface "leads that haven't been contacted in 3 days." Separate from (and simpler than) the 5-touch sequencer — it never sends anything, it only **measures last contact from Outlook and flags cold leads**.

- **`n8n/6_followup_scanner.json`** — runs daily at 7am (cron `0 7 * * *`). Reads all `leads` from Firestore, filters in code to open/contactable leads (has email; not archived; stage not won/lost; `seq_status` ≠ `replied`; not snoozed), then for each lead queries Microsoft Graph `GET /users/{OUTLOOK_USER_ID}/messages?$search="participants:<email>"` and takes the newest message across the hits, recording its **direction** (`from`==lead ⇒ inbound, else outbound). Writes `last_contact_date`, `last_contact_dir`, `days_since_contact`, `followup_due` (outbound-cold, business-days), `followup_contacted`, `followup_checked_at` back to the lead. Reuses the **same two credentials** as the other workflows: `Microsoft OAuth2 — Cubework Outlook` and `Google Service Account — do-or-wait`, plus the `OUTLOOK_USER_ID` env var. No new credentials.
  - Graph note: `$search` can't be combined with `$orderby`, so it fetches the top 25 relevance-ranked hits and takes the max date in code — fine for a single correspondent. If a lead has zero email history, the date falls back to `createdAt` and `followup_contacted` is set false.
  - **splitInBatches v3 wiring**: the loop body hangs off output **index 1** ("loop"); output 0 ("done") is intentionally empty. (Workflow 3's loop wires the body to index 0 — that ordering is the older convention; follow the v3 ordering used here.)

### In-app surface (index.html, Leads tab)
- **`🔔 Follow-ups` filter button** (`#followup-filter-btn`, `setLeadFilter('followup')`) with a count badge of due leads.
- **Reminder banner** (`#followup-banner`) above the board: shows "N leads have gone quiet for 3+ days" with a "Review follow-ups →" button. Hidden when the Follow-ups filter is already active or nothing is due.
- **`🔔 Nd cold` chip** on each due lead card (or "no contact yet").
- **Suggested-message block** (`renderFollowupBlock`) inside a due lead's thread (only when there's no `pending_email`): **stage-aware, VALUE-LED** copy via `FOLLOWUP_BY_STAGE` (cold=First touch / contacted=Check-in / toured=Post-tour / proposal=Proposal nudge) plus a universal `FOLLOWUP_VALUE` and `FOLLOWUP_BREAKUP` in the **↻ cycle** (`cycleFollowupTpl` → `followupMsgFor`/`followupMsgsFor`). Each message leads with value, not "circling back": **playbook-grounded** value blocks (`FU_INCLUSIVE` = all-inclusive/no-CAM-NNN, `FU_FLEX` = month-to-month/30-day notice, `FU_FAST` = 24–48hr move-in, `FU_TCO` = ~20–30% lower all-in) **tailored by `lead.segment`** via `fuHook` (importer→ports/Cubeship, ecommerce→fulfillment/last-mile, 3pl→scale/multi-site, tenant→overflow/2nd site), **plus a live availability line** (`fuAvail` → `followupUnitStillOpen`/`followupAvailMatches`) that injects a REAL open unit from `availMap` when there's a match — the lead's specific unit if still open, else a size-matched unit (0.5×–2× of `unit_sf`/`sqft`/`wl_sf`, in watched-or-all-synced locations). Asserts only what's actually available right now (never a guess; empty string if no honest match), so no false claims. **No special-pricing injection yet** (deferred). Greets by first name only (no company-as-name); `fuSpace` keeps the space reference generic; surfaces the lead's most recent thread entry as a **↪ Latest update** context line so the real specifics live there, not in the draft. Buttons: **✉️ Open in email** (`openFollowupEmail` → `mailto:`), **📋 Copy** (`copyFollowupMsg`), **Snooze 3 days** (`snoozeFollowup`).
- Core logic: `FOLLOWUP_DAYS` (=3), `isFollowupDue(lead)` (outbound-cold; triggers on `bizDays`), `contactInfo(lead)` (returns `{days, bizDays, date, contacted, dir}` — `bizDays`/business days drives the due trigger, display uses calendar `days`). The block header shows "quiet N days" (the earlier "(Nd ago)" duplication is fixed). All inline handlers are exposed in the `window.*` block (per the ES-module gotcha).

### Quick-log call / text / inbound (launch + log in one tap)
Each active lead card shows a compact button row (`renderLeadCard` → `quickLog`): **📞 Call** / **💬 Text** when `lead.phone` is set (else a **📞 Add number** button that opens edit), plus **📥 Inbound** (logged when a lead calls/texts *you* — manual, since a personal cell's calls/iMessages aren't readable by any API). `logTouch(leadId, kind, e)` appends a dated thread entry (`📞 Called` / `💬 Texted` / `📥 They reached out`; `met` is still supported by the handler but has no button). Outbound kinds (call/text) log as type `wait` (you reached out, awaiting reply); **`inbound` logs as type `do`** (they reached out → ball's in your court, surfaces in the Do column). It then opens the card (accordion) so the outcome note is one tap away via 📝 Note, persists, then for call/text hands off to `tel:`/`sms:` (digits sanitized from `lead.phone`). This launches the dialer / Messages (iMessage on Apple) AND logs the touch in the same tap — which also resets that lead's 3-day follow-up clock (calls/texts are invisible to the Outlook scanner). New `phone` field added to the lead modal (`lf-phone`). `logTouch` is exposed on `window.*`. Note: `tel:`/`sms:` only do something on a device with a phone/Messages handler (iPhone, or Mac via Continuity) — the log still records on any platform.

---

## File locations
```
do_or_wait/
  index.html            ← entire app (push to GitHub to deploy)
  pricing-seed.js       ← auto-generated snapshot of the price sheet, loaded by index.html as the Pricing-tab fallback before/without the n8n sync. Regenerate from the master xlsx; NOT hand-edited. (Loaded via <script src> just before the module — the one static data asset outside index.html.)
  REPLY_ASSISTANT_SPEC.md ← design spec (2026-06-17, status: Proposed) for an in-app "Reply Assistant": on a lead with an inbound email, ✍️ Draft reply → fresh availability sync + matcher → Claude drafts an availability/pricing-matched reply in house style → conversational refine ("wider net", "drop Fontana") → save to thread / Outlook draft. NOT yet built into index.html.
  CLAUDE.md             ← this file
  .gitignore            ← keeps the master price xlsx (large, internal, repo is public) and *.xlsx out of git
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
    6_followup_scanner.json    ← Follow-up Scanner: flags leads cold 3+ days (Outlook/Graph → Firestore, with direction). No sending.
    7_pricing_sync.json        ← Pricing Sync: reads the Sales_US master price sheet (Graph workbook API) → Firestore pricing/current. Daily 6am.
    10_renewals_sync.json      ← Renewals Sync: reads the Google renewal tracker sheet (CSV export, no creds) → Firestore renewals/current. Daily 7:30am. Uses only the Google Service Account cred for the Firestore write.
    parse_renewals.node.js     ← clean paste-ready copy of the "Parse renewals" node code (workflow 10)
    8_prospect_finder.json     ← Prospect Finder: nightly (4am) workflow that imports/scores leasing prospect leads (Claude scoring) → Firestore. See its README.
    8_prospect_finder.README.md ← docs for the prospect-finder workflow
    prospect_score.node.js     ← clean paste-ready copy of the prospect-scoring Code node (workflow 8 prospect-finder)
    templates.json             ← email-sequencer message templates (used by the 5-touch sequencer, currently OFF)
    SETUP.md
  location_blueprints_sp/      ← per-location Site Plan tab CSV exports (one subfolder per location), used to BUILD & verify floorplan parser profiles. Not read at runtime — the sync reads the live tabs via Graph; these CSVs are the profile-dev fixtures.
```

## Floor plans = LINK to the SharePoint Site Plan (FINAL — decided 2026-06-17)
**Whole floor-plan feature abandoned in-app.** After trying auto-reconstruction (Graph + `.xlsx` color-region), uploaded images, and a LibreOffice weekly auto-render, Justin's final call: the n8n host can't install LibreOffice, and manual screenshots don't scale to 80+. So the in-app "Floor Plan" section is now **just a link** — `renderFloorplans` reads `availMap[propId].sharepoint_url` (+ `yardi_url`) and renders "📄 Open Site Plan (SharePoint) ↗". No rendering, upload, editor, or n8n. **Cleanup done 2026-06-18:** the dead floorplan artifacts were deleted from the repo — `n8n/8_floorplan_sync.json`, `n8n/9_floorplan_image_render.json`, `n8n/render_siteplan.py`, and the root `floorplan-seed.js` (the in-app machinery `fpUploadPlanImage`/`fpRemovePlanImage`/editor `fpStartEdit…`/`floorplanImages` listener/`FLOORPLAN_SEED` was already gone from `index.html`). The two sections below are kept as the written record of what was tried and why it didn't work — the files they describe no longer exist.

## (HISTORICAL) Floor plans = UPLOADED Site Plan images
**Auto-reconstruction was abandoned.** Both the n8n Graph sync (workflow 8) and the in-app `.xlsx` color-region importer were built and tested, but neither reliably matched the hand-drawn SharePoint plans (scattered boxes, misread dock-label letters like "LOADING", missing unlabeled big blocks). Justin's call: stop reconstructing — **just show the real drawing as an image.**

How it works now: each location's floor plan is a **screenshot/export image of the SharePoint Site Plan** that Justin uploads in-app. Stored in **`floorplan_images/{propId}` = `{ warehouse:<url>, office:<url>, updatedAt }`** (Firebase Storage for the file, this doc for the URLs). `renderFloorplans` is **image-first**: if `floorplanImages[propId][floor]` exists it shows the `<img>` (click → open full-size) with floor tabs + **📷 Replace / 🗑 Remove**; else it falls back to the box-layout view (seed/editor) with a **📷 Use image** option. Empty state offers **📷 Upload Warehouse/Office plan** + **✏️ Draw manually**. Handlers: `fpUploadPlanImage(file,propId,floor)` (→ Storage → `floorplan_images/{propId}`), `fpRemovePlanImage(propId,floor)` (writes the floor to `null`), `fpUpLabel` builds the file-picker. Both exposed on `window.*`. Tradeoff: the image is a snapshot (status colors as of upload); live status still lives in the availability list. The manual box editor (drag/resize, live colors) remains for anyone who wants clickable units.

**Removed from `index.html`:** the `.xlsx` importer (`fpImportXlsx` + SheetJS reconstruction), the **⚙ Generate** button + `triggerFloorplanSync`/`FLOORPLAN_WEBHOOK`. **`n8n/8_floorplan_sync.json` is left in the repo but unused/deprecated** — do not import it. The two sections further below are kept as a record of what was tried and why it didn't work.

### Weekly auto-render (n8n workflow 9) — the real engine behind the images
Manual upload doesn't scale to 80+ locations, so the images are produced automatically. **Key insight: a real renderer (LibreOffice) photographs the Excel Site Plan tab faithfully — colors, merges, labels — and doesn't care that every location is drawn differently, so it scales.** Proven on La Mirada: a single-page, full-color render identical to the SharePoint plan.

- **`n8n/render_siteplan.py`** (runs on the n8n host): given a location's `.xlsx` + propId + out dir, it (1) isolates the Site Plan tab by hiding every other sheet in `xl/workbook.xml` (strip any `state=`, add `state="hidden"`, set `activeTab`), (2) forces fit-to-one-page (patch the sheet's `<pageSetup fitToWidth/Height=1>` + `<pageSetUpPr fitToPage="1"/>`, landscape), (3) `libreoffice --headless --convert-to pdf`, (4) `pdftoppm -png -singlefile`, (5) `convert -trim`. Renders the warehouse tab and, if a separate office tab exists (Terminal/Walnut/347 Stimson), an office tab too. Per-location tab overrides in `PROFILES` (banana=`WH Site Plan`, terminal office=`OFFICE SITEPLAN`); all others auto-pick by name. Prints JSON `{warehouse:<png>, office:<png>|null}`.
- **`n8n/9_floorplan_image_render.json`** (weekly Mon 5am + on-demand webhook `floorplan-render`): get `config/properties` → loop → Graph download the `.xlsx` to `/tmp/fp/` → **Execute Command** runs `render_siteplan.py` → read each PNG → **upload to Firebase Storage** (`POST firebasestorage.googleapis.com/v0/b/{bucket}/o`, relies on the same open Storage rules the app's manual upload uses — no extra creds) → PATCH `floorplan_images/{propId}` with the download URL. Feeds the **same image view already in the app**, so no app change; manual upload stays as an override.
- **Host prerequisites** (install once on the n8n box): `sudo apt-get install -y libreoffice-calc poppler-utils imagemagick`, and drop `render_siteplan.py` at `/opt/cubework/render_siteplan.py`. Bucket defaults to `do-or-wait.appspot.com` (verify; override via n8n var `FIREBASE_BUCKET`). Reuses the existing `Microsoft OAuth2 — Cubework Outlook` (Graph download) + `Google Service Account — do-or-wait` (Firestore) creds. **Not yet run against live n8n — test on one location via the webhook before enabling the weekly schedule.**

## (SUPERSEDED) Floorplan Sync (n8n workflow 8) — shared parser + per-location profiles
Auto-generates floor-plan layouts from each location's SharePoint **Site Plan tab(s)** so we don't hand-trace blueprints. Same SharePoint→Firestore pattern as availability/pricing. The Site Plan layout rarely changes, so it runs **weekly (Mon 5am)** plus an **on-demand "⚙ Generate" button** per location (`triggerFloorplanSync` → `FLOORPLAN_WEBHOOK` → n8n). It writes `floorplans/{propId}`, **overwriting** any manual editor layout (Justin's call 2026-06-17 — keep it simple; editor tweaks hold until the next sync).

**Why Graph, not CSV/the SharePoint connector:** Graph workbook `usedRange(valuesOnly=true)` returns a **2D `values` array that preserves cell row/col** — which is what encodes unit positions. The SharePoint MCP connector and plain text extraction *flatten* the grid (positions lost), so they can't drive a layout. (Confirmed against Fresno: connector gave every unit + SF + tenant but no positions.)

**Shared parser + profiles (decided 2026-06-17).** One parser; a small `FLOORPLAN_PROFILES` map keyed by propId tunes the few things that differ per location. The n8n "Pick tabs" node switches on propId → profile (tolerant/normalized match, like `fpLayout`), but the branch only selects *parameters*, not separate code. New locations use the **auto default** (`{}`); add a 3-line override only when one looks off. A profile may also set `custom: fn` as an escape hatch.
- Profile fields (all optional): `tabs:[names]`, `officeTabs:[names]` (else auto-pick by name pattern `/site plan|warehouse|wh|layout|floor/i`, office = `/office/i`), `minCol/maxCol/minRow/maxRow` (clip region), `colw/rowh` (fixed scale; else auto-fit to ~960×680 preserving aspect).
- Current overrides: `banana-fontana → { tabs:['WH Site Plan'], minCol:14 }` (its Site Plan tab has a left **data list** in cols 1–6 that would otherwise stack every unit into one column; the real drawing is cols ≥14). `terminal-west-sac → { tabs:['Site Plan'], officeTabs:['OFFICE SITEPLAN'] }` (two-tab WH+office). All other 10 locations parse on the auto default.

**Parser rules (carry all observed formats — Banana grid, La Mirada free-form art, Terminal two-tab+parking):** (1) unit-ID regex `/[A-Z]{1,3}\d{1,3}(?:-[A-Z0-9]{1,2})?/` + a `Dock #N` rule; (2) NOISE denylist (`M2/AC/CC/OHD`) + skip blank/nbsp/`Â` mojibake cells; (3) type by prefix (`R`→OFFICE, `P`→PARKING, `DOCK`→DOCK, else WH); (4) cell `(col,row)`→`(x,y)`, box width from any nearby `… SF`, dock/parking = small markers; (5) **floors split by unit TYPE** (OFFICE→office floor, rest→warehouse) so a single combined tab AND separate WH/office tabs both work. Units present in the BOT availability data but **not drawn** on the Site Plan (e.g. Banana's DD docks / P / R04–R08) get no box — backfill them via the editor's "add unplaced units". `parse_build_patch`-style logic lives in workflow 8's "Build floorplan patch" Code node.

## (SUPERSEDED) Import Site Plan (.xlsx) — in-app reconstruction
The Graph sync (workflow 8) only sees cell *text*, so its layout is a rough scaffold. The **accurate** path is the in-app **"📥 Import Site Plan (.xlsx)"** button (in the floor-plan section header, the empty state, and the editor toolbar). It reads the real workbook **client-side with SheetJS** (lazy-loaded from cdnjs `xlsx@0.18.5`; nothing is uploaded anywhere) and reconstructs the layout from what only the raw file has: **merged-cell ranges + cell fill colors**.
- Why it works: the Site Plan draws each unit as a **colored block of cells** (green=available, pink=occupied, yellow=Cubework/UNIS). Graph `values` and CSV both discard colors+merges; the `.xlsx` keeps them. Columns have **no custom widths** in these files, so uniform cell size is correct — no width data needed.
- Algorithm (`fpReconColor`): build the cell grid (propagate each merge's fill across its range), take every unit-ID label as a **seed**, then assign each colored cell to its nearest seed (**Voronoi by label**) — this separates touching same-status units that a plain color flood-fill would merge. Each seed's territory bbox → a box (uniform `CW=22,CH=17`, then `fpScaleFit` caps the longest side at 1400). Floors split by unit **type** (R→office, else warehouse); a separate office tab (e.g. Terminal `OFFICE SITEPLAN`, Walnut `Office Layout`) overrides the office floor.
- **Grid fallback** (`fpReconGrid`): if color reconstruction yields <4 units (drawing not color-filled), fall back to text-grid parsing + SF-based box sizing. (Banana's WH tab needs `minCol:14` either way to skip its left data list — and with that it color-reconstructs fine, ~27 units.)
- Per-location tuning: **`FP_XLSX_PROFILES`** in `index.html` (currently `banana-fontana → {tab:'WH Site Plan', minCol:14}`, `terminal-west-sac → {tab:'Site Plan', officeTab:'OFFICE SITEPLAN'}`; all others auto). Same tolerant propId matching as `fpLayout`.
- Flow: `fpImportXlsx(file, propId)` → reconstruct → load into `fpDraft` → drops you into the **editor** to nudge → **Save** writes `floorplans/{propId}` (same as any editor save). So import = a faithful *starting draft*, not a final commit. Verified on Banana/La Mirada/Terminal/Walnut/Warner (27/38/75/68/40 warehouse units).
- The **`location_blueprints_sp/<location>/`** folders now also hold each location's real **`.xlsx`** (not just CSVs) — these are the fixtures used to build/verify the color profiles.

---

## Quick reference — webhook URLs
- Availability sync: `https://plain-credit-5962.jchoustin91.workers.dev/webhook/availability-sync`
- Add location: `https://plain-credit-5962.jchoustin91.workers.dev/webhook/add-location`
- Floorplan sync: `https://plain-credit-5962.jchoustin91.workers.dev/webhook/floorplan-sync`
- n8n base: `https://ailinker.item.com`
