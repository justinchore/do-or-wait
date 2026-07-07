// Paste-ready Code-node JS for n8n workflow 18 (Pricing BD Sync).
// Four Code nodes; copy each block into the matching node's "JavaScript Code".
// Companion to 18_pricing_bd_sync.json. Parser verified 2026-07-07 against a real
// usedRange() pull of the AZ tab — see pricing_bd_raw_grid.json for that fixture.
// ─────────────────────────────────────────────────────────────────────────

// ===== NODE "Reset accumulator" (both triggers land here first) ===========
// Reset the cross-loop accumulator so a fresh run never inherits leftover rows
// from a prior run that errored mid-loop.
const sd = $getWorkflowStaticData('global');
sd.rows = [];
return [{ json: {} }];


// ===== NODE "Filter state tabs" ============================================
// Every tab except the Overview/Instructions cover tab is a state (or UNIS)
// rate card sheet — fan out one item per tab name so the loop below can read
// each one.
const resp = $input.first().json || {};
const list = Array.isArray(resp.value) ? resp.value : [];
const skip = /overview|instructions/i;
const tabs = list.map(w => (w && w.name) || '').filter(n => n && !skip.test(n));
if (!tabs.length) throw new Error('No worksheet names came back — check the workbook / credential.');
return tabs.map(name => ({ json: { name } }));


// ===== NODE "Parse tab" ====================================================
// Parse one state (or UNIS) tab's raw grid into building-card records and
// append them to the cross-loop accumulator. Layout per card, top to bottom:
//   [indexNum, "Name  —  Address [optional tag]", ...]        <- card start (col0 is a number)
//   ["", "Building SF", <num>, "Lease", <date|Own>, "Occupancy", <pct>]
//   [optional single-cell free-text rows: BELOW BREAK-EVEN / PROMO / other notes]
//   ["", "Band", "Tier", "Current", "Recommended", "Floor–Ceiling", "Action"]  <- tier header
//   ["", "<sf range>", "<tier name>", <current>, <recommended>, "<floor-ceiling>", "<action>"]  x1-6
//   ["", "ADD-ONS / ANCILLARY PRICING", "", "", "", "", ""]   <- add-ons marker
//   ["", label, value, label, value, label, value]  x N        <- add-on rows, 3 label/value pairs
//   ["", "Conf Room — ...", "", "", "", "", ""]
//   ["", "Note: ...", "", "", "", "", ""]
//   [blank row separator]
// The UNIS tab additionally has bare "— CA —" style divider rows between state
// groups (its cards don't carry their own state otherwise).

const grid = ($json.values) || [];
const tabName = (($('Batch tabs (loop)').item || {}).json || {}).name || '';
const isUnis = /unis/i.test(tabName);

function tabDefaultState(g, tab) {
  for (const row of g.slice(0, 5)) {
    const cell = String((row && row[0]) || '');
    const m = /CUBEWORK\s*\|\s*([A-Z]{2})\s*—/.exec(cell);
    if (m) return m[1];
  }
  const t = tab.trim();
  return /^[A-Z]{2}$/.test(t) ? t : (t || 'Other');
}
let currentState = tabDefaultState(grid, tabName);

const TIER_LABELS = new Set([
  '≤ 2,000 SF', '2,001 – 5,000 SF', '5,001 – 10,000 SF',
  '10,001 – 30,000 SF', '30,001 – 100,000 SF', '100,000+ SF'
]);
const ADDON_KEYMAP = {
  'office': 'office', 'dock': 'dock', 'cubicle/desk': 'cubicle_desk', 'virtual office': 'virtual_office',
  'truck/container pkg': 'truck_container_pkg', 'sm vehicle pkg': 'sm_vehicle_pkg', 'whse wifi': 'whse_wifi',
  'deposit': 'deposit', 'day office': 'day_office', 'day whse': 'day_whse', 'day dock': 'day_dock', 'event space': 'event_space'
};
function slug(s) { return String(s || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''); }
function addonKey(label) { const k = String(label || '').toLowerCase().trim(); return ADDON_KEYMAP[k] || slug(label); }
function clean(v) { return (v === null || v === undefined) ? '' : v; }
function isBlankRow(row) { return !row || row.every(c => clean(c) === ''); }

const rows = [];
let card = null;
function pushCard() { if (card) rows.push(card); card = null; }

for (let i = 0; i < grid.length; i++) {
  const row = grid[i] || [];
  const c0 = row[0];
  const c1 = clean(row[1]).toString().trim();

  // UNIS-tab state divider, e.g. "— CA —"
  const divM = /^—\s*([A-Za-z]{2,})\s*—$/.exec(c1);
  if (divM && isBlankRow(row.slice(2)) && (c0 === '' || c0 == null)) { currentState = divM[1].toUpperCase(); continue; }

  // New card start
  if (typeof c0 === 'number') {
    pushCard();
    const rawLoc = clean(row[1]).toString();
    const tagM = /\[([^\]]+)\]\s*$/.exec(rawLoc);
    const tag = tagM ? tagM[1].trim() : '';
    const withoutTag = rawLoc.replace(/\[([^\]]+)\]\s*$/, '').trim();
    const parts = withoutTag.split('—').map(s => s.trim());
    card = {
      _id: 'pb' + tabName + '_' + c0 + '_' + i,
      state: currentState, unis: isUnis, index: c0,
      name: parts[0] || withoutTag, address: parts.slice(1).join(' — ') || '',
      tag: tag || null, building_sf: '', lease: '', occupancy_pct: '',
      bands: [], addons: {}, conf_room: '', notes: [], below_break_even: '', promo: ''
    };
    continue;
  }

  if (!card) continue; // stray row before the first card (title / legend / blank)

  if (c1 === 'Building SF') { card.building_sf = clean(row[2]); card.lease = String(clean(row[4])).trim(); card.occupancy_pct = clean(row[6]); continue; }
  if (c1 === 'Band' && clean(row[2]) === 'Tier') continue;                 // tier table header
  if (TIER_LABELS.has(c1)) {
    card.bands.push({ sf_range: c1, tier: clean(row[2]), current: clean(row[3]), recommended: clean(row[4]), floor_ceiling: clean(row[5]), action: clean(row[6]) });
    continue;
  }
  if (c1 === 'ADD-ONS / ANCILLARY PRICING') continue;                      // add-ons marker
  if (isBlankRow(row)) continue;                                          // spacer between cards

  // Any other single-populated-cell row is free text: break-even / promo / conf room / generic note
  if (isBlankRow(row.slice(2)) && c1) {
    if (/^BELOW BREAK-EVEN/i.test(c1)) card.below_break_even = c1;
    else if (/^PROMO/i.test(c1)) card.promo = c1;
    else if (/^Conf Room/i.test(c1)) card.conf_room = c1;
    else card.notes.push(c1);
    continue;
  }

  // Otherwise: generic label/value pairs across the row = add-ons
  for (let col = 1; col < row.length; col += 2) {
    const label = clean(row[col]).toString().trim();
    const val = clean(row[col + 1]);
    if (!label) continue;
    card.addons[addonKey(label)] = val;
  }
}
pushCard();

const sd = $getWorkflowStaticData('global');
if (!Array.isArray(sd.rows)) sd.rows = [];
sd.rows.push(...rows);

return [{ json: { tab: tabName, cardsParsed: rows.length } }];


// ===== NODE "Build Firestore patch" ========================================
// Snapshot the accumulator built across every loop iteration, reset it for the
// next run, and build the Firestore PATCH body for pricing_bd/current.
const sdFinal = $getWorkflowStaticData('global');
const rowsFinal = Array.isArray(sdFinal.rows) ? sdFinal.rows.slice() : [];
sdFinal.rows = [];

if (rowsFinal.length === 0) throw new Error('Pricing BD parse produced 0 rows — check tab names / usedRange.');

function fv(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(fv) } };
  if (typeof v === 'object') { const fields = {}; for (const k in v) fields[k] = fv(v[k]); return { mapValue: { fields } }; }
  return { stringValue: String(v) };
}

const arr = rowsFinal.map(r => fv(r));
const patchBody = { fields: {
  rows: { arrayValue: { values: arr } },
  updatedAt: { stringValue: new Date().toISOString() },
  source: { stringValue: 'n8n pricing_bd sync (workflow 18)' },
  count: { integerValue: String(rowsFinal.length) }
} };

return [{ json: { patchBody, count: rowsFinal.length } }];
