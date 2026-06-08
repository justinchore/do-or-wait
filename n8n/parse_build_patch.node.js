// ════════════════════════════════════════════════════════════════════
//  n8n  ·  "Parse + build patch" Code node  (availability sync)
//  Paste this into the node's JS Code field.
//
//  Source: the "BOT - NEW ACTIVE LICENSEE" worksheet (Layout A), consistent
//  across all locations. Columns:
//    Unit # | Unit Type | Unit SF | Unit status | Company Name |
//    Business Owner | Phone # | Email | Onsite POC | notes
//  Header repeats once per section (Warehouse / Office / Dock / Parking).
//
//  Captures per unit: tenant (company), owner, phone, email, poc, notes,
//  plus available + hold flags. Type is normalized whether the sheet uses
//  codes (WH/OFFICE/DOCK/TRAILER) or words (Warehouse/Office/Dedicated/
//  Shared/Trailer-Truck/Small Vehicle).
// ════════════════════════════════════════════════════════════════════
const prop = $('Pick data sheet').first().json;
const rows = $input.first().json.values || [];
const now  = new Date().toISOString();

const unitPattern = /^[A-Z]{1,5}\d{1,4}(?:[A-Z]|-[A-Z0-9]{1,3})?$/i;

function normType(typeText, unitId) {
  const t = String(typeText || '').toUpperCase();
  if (/OFFICE/.test(t)) return 'OFFICE';
  if (/DOCK|DEDICAT|SHARED/.test(t)) return 'DOCK';
  if (/TRAILER|TRUCK|VEHICLE|PARK/.test(t)) return 'TRAILER';
  if (/WAREHOUSE|^WH$|^W$/.test(t)) return 'WH';
  const u = unitId.toUpperCase();           // fallback: infer from unit-ID prefix
  if (u.startsWith('R')) return 'OFFICE';
  if (u.startsWith('DOCK') || u.startsWith('DD')) return 'DOCK';
  if (u.startsWith('P') || u.startsWith('Y')) return 'TRAILER';
  return 'WH';
}

const clean = v => { const s = String(v == null ? '' : v).trim(); return (s && !/^hold$/i.test(s)) ? s : null; };

const units = [];
let inTable = false;
for (const row of rows) {
  const cells = row.map(c => String(c === null || c === undefined ? '' : c).trim());
  const [c0, c1, c2, c3 = '', c4 = '', c5 = '', c6 = '', c7 = '', c8 = '', c9 = ''] = cells;
  if (c0 === 'Unit #' && c1 === 'Unit Type') { inTable = true; continue; }
  if (!inTable) continue;
  const unitId = c0.replace(/\s+/g, '').toUpperCase();   // "DOCK 14" -> "DOCK14"
  if (!unitPattern.test(unitId)) continue;               // skip blanks / "WAREHOUSE SPACE" labels
  const sf = Number(String(c2).replace(/[^0-9]/g, '')) || 0;
  const type = normType(c1, unitId);
  const statusNorm = c3.toLowerCase();
  const available = statusNorm === 'vacant';
  const isHold = /hold/.test(statusNorm) || /hold/.test(c4.toLowerCase());
  const tenant = (statusNorm === 'occupied' && c4) ? c4 : null;
  units.push({
    unit: unitId, type, sf, status: c3, tenant,
    owner: clean(c5), phone: clean(c6), email: clean(c7), poc: clean(c8), notes: clean(c9),
    available, hold: isHold
  });
}

function summarise(type) {
  const g = units.filter(u => u.type === type), a = g.filter(u => u.available);
  const ts = g.reduce((s, u) => s + u.sf, 0), as = a.reduce((s, u) => s + u.sf, 0);
  return { total_units: g.length, avail_units: a.length, total_sf: ts, avail_sf: as,
           avail_pct: ts > 0 ? Math.round(as / ts * 1000) / 10 : 0 };
}

const wh = summarise('WH'), off = summarise('OFFICE'), dock = summarise('DOCK'), trailer = summarise('TRAILER');

const toStr = v => ({ stringValue: String(v) }), toInt = v => ({ integerValue: String(Math.round(v)) }),
      toDbl = v => ({ doubleValue: v }), toBool = v => ({ booleanValue: v }), toNull = () => ({ nullValue: null });

const summFs = s => ({ mapValue: { fields: { total_units: toInt(s.total_units), avail_units: toInt(s.avail_units), total_sf: toInt(s.total_sf), avail_sf: toInt(s.avail_sf), avail_pct: toDbl(s.avail_pct) } } });
const unitFs = u => ({ mapValue: { fields: {
  unit: toStr(u.unit), type: toStr(u.type), sf: toInt(u.sf), status: toStr(u.status),
  tenant: u.tenant ? toStr(u.tenant) : toNull(),
  owner:  u.owner  ? toStr(u.owner)  : toNull(),
  phone:  u.phone  ? toStr(u.phone)  : toNull(),
  email:  u.email  ? toStr(u.email)  : toNull(),
  poc:    u.poc    ? toStr(u.poc)    : toNull(),
  notes:  u.notes  ? toStr(u.notes)  : toNull(),
  available: toBool(u.available), hold: toBool(u.hold)
} } });

const patchBody = { fields: {
  property:            toStr(prop.property || prop.id),
  address:             toStr(prop.address || ''),
  yardi_url:           toStr(prop.yardi_url || ''),
  sharepoint_url:      toStr(prop.sharepoint_url || ''),
  sheet_last_modified: toStr(prop.lastModified || ''),
  synced_at:           toStr(now),
  wh:      summFs(wh),   office:  summFs(off),
  dock:    summFs(dock), parking: summFs(trailer),
  units: { arrayValue: { values: units.map(unitFs) } }
}};

return [{ json: { propId: prop.id, patchBody } }];
