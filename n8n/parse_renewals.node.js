// ── Renewals Sync — "Parse renewals" Code node (n8n, JS) ──────────────────
// Paste this into the Code node's JavaScript field (workflow 10).
// INPUT  : the HTTP Request node ("Read renewal sheet") returns the Google Sheet
//          exported as CSV text. With responseFormat = "text", the body is in
//          $json.data (older n8n puts it in $json.body) — both are handled.
// OUTPUT : one item { patchBody, count } — a Firestore PATCH body for
//          renewals/current = { rows:[…], updatedAt, source, count }.
//
// The sheet (gid 844109688) is a per-tenant lease-renewal tracker. Its right-hand
// columns drift because of merged header cells, so we parse the STABLE left block
// by header NAME (Property, Unit(s), Lease Name, End Date …) and resolve the
// renewal "decision" / email "stage" by scanning the row against a known
// vocabulary — position-independent, so column drift can't break it.
// Multi-unit rows ("C09, C10") are exploded into one record per unit.

const inJson = $input.first().json || {};
const text = inJson.data || inJson.body || inJson.csv || '';
if (!text || typeof text !== 'string') {
  throw new Error('Renewals: no CSV text on input (expected $json.data from the HTTP node).');
}

// RFC-4180-ish tokenizer: quoted fields, embedded commas/newlines, "" escapes.
function parseCSV(str) {
  const rows = []; let row = []; let field = ''; let inQ = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (inQ) {
      if (ch === '"') { if (str[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (ch === '\r') { /* skip */ }
      else field += ch;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const clean = v => (v == null ? '' : String(v).replace(/ /g, ' ').trim());
const grid = parseCSV(text);

// Locate the data header row (the one carrying both "Lease Name" and "End Date").
let hIdx = -1;
for (let i = 0; i < grid.length; i++) {
  const cells = grid[i].map(c => clean(c).toLowerCase());
  if (cells.includes('lease name') && cells.includes('end date')) { hIdx = i; break; }
}
if (hIdx < 0) throw new Error('Renewals: header row (Lease Name / End Date) not found.');

const header = grid[hIdx].map(clean);
const idxOf  = name => header.findIndex(h => h.toLowerCase() === name.toLowerCase());
const idxAll = re => header.map((h, i) => re.test(h) ? i : -1).filter(i => i >= 0);

const iProp = idxOf('Property'), iUnit = idxOf('Unit(s)'), iName = idxOf('Lease Name'),
      iType = idxOf('Lease type'), iAmd = idxOf('Amendment Type'), iEnd = idxOf('End Date'),
      iRent = idxOf('Monthly Rent'), iReason = idxOf('Increase Reason'), remarkCols = idxAll(/remark/i);
if (iProp < 0 || iUnit < 0 || iEnd < 0) throw new Error('Renewals: required columns (Property/Unit(s)/End Date) missing.');

// Renewal decision vocabulary (the "Increase Reason" outcomes) + lifecycle stage.
const DECISION = /^(same rate|market price|4% ?\+ ?\$0\.10 increase only|4% increase only|\$0\.10 increase only|do not renew|pause renewal|renewed.*|move ?out|new office rate)$/i;
const STAGE    = /(sent pi email|sent no increase email|do not renew|renewed|move ?out|pending)/i;

function isoDate(s) {
  s = clean(s); if (!s) return '';
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!m) return '';
  let yr = m[3]; if (yr.length === 2) yr = '20' + yr;
  return `${yr}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

const rows = [];
for (let i = hIdx + 1; i < grid.length; i++) {
  const r = grid[i].map(clean);
  const property = clean(r[iProp]);
  const unitsRaw = clean(r[iUnit]);
  if (!property || !unitsRaw) continue;                 // summary / blank rows
  if (property.toLowerCase() === 'property') continue;  // a repeated header

  const end_date = isoDate(r[iEnd]);

  let decision = iReason >= 0 ? clean(r[iReason]) : '';
  if (!decision || !DECISION.test(decision)) {
    const hit = r.find(c => DECISION.test(clean(c)));
    if (hit) decision = clean(hit);
  }

  let stage = '';
  for (const c of r) { const m = clean(c).match(STAGE); if (m) { stage = m[0]; break; } }

  const remarks = [...new Set(remarkCols.map(ci => clean(r[ci])).filter(Boolean))]
    .filter(x => x.toLowerCase() !== decision.toLowerCase() && x.toLowerCase() !== stage.toLowerCase())
    .join(' · ');

  const tenant = clean(r[iName]);
  const lease_type = clean(r[iType]);
  const amendment = clean(r[iAmd]);
  const monthly_rent = clean(r[iRent]);

  for (const unit of unitsRaw.split(/[,/]/).map(u => u.trim()).filter(Boolean)) {
    rows.push({ property, unit, tenant, lease_type, amendment, end_date, decision, stage, remarks, monthly_rent });
  }
}
if (rows.length === 0) throw new Error('Renewals parse produced 0 rows — check the sheet/gid is still link-viewable.');

// Build the Firestore PATCH body (REST shape, like the pricing sync).
const fv = v => ({ stringValue: String(v == null ? '' : v) });
const arr = rows.map(rec => {
  const fields = {};
  for (const k in rec) fields[k] = fv(rec[k]);
  return { mapValue: { fields } };
});
const patchBody = { fields: {
  rows:      { arrayValue: { values: arr } },
  updatedAt: { stringValue: new Date().toISOString() },
  source:    { stringValue: 'n8n renewals sync' },
  count:     { integerValue: String(rows.length) }
}};

return [{ json: { patchBody, count: rows.length } }];
