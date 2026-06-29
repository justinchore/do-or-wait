// Paste-ready Code-node bodies for workflows 14 (backfill) and 15 (callback).
// Keep in sync with 14_apollo_phone_backfill.json / 15_apollo_phone_callback.json.

// ============================================================
// WORKFLOW 14 — Apollo Phone Backfill
// ============================================================

// ===== "Parse → phone targets" =====
// Turn the Firestore list response into one item per prospect that NEEDS a phone.
// Skip: invalid-flagged, ones that already have a phone, and ones with no email AND no linkedin.
const res = $json;
const docs = res.documents || [];
const out = [];
for (const d of docs) {
  const f = d.fields || {};
  const S = k => (f[k] && f[k].stringValue != null) ? f[k].stringValue : '';
  const slug   = (d.name || '').split('/').pop();
  const email  = S('email');
  const linkedin = S('linkedin');
  const phone  = S('phone');
  const name   = S('first_name');   // app stores the full name in first_name
  const domain = S('domain');
  const invalid = !!(f.invalid && f.invalid.booleanValue);
  if (!slug) continue;
  if (invalid) continue;
  if (phone) continue;               // already revealed
  if (!email && !linkedin) continue; // no identifier Apollo can match on
  out.push({ json: { slug, email, linkedin, name, domain } });
}
return out;

// ===== "Build phone reveal body" =====
// reveal_phone_number + webhook_url go as QUERY params on the HTTP node; here we emit details (body) + the webhook URL.
// >>> EDIT CALLBACK_URL if your n8n public base differs. Must be HTTPS + reachable by Apollo. <<<
const CALLBACK_URL = 'https://ailinker.item.com/webhook/apollo-phone-callback';
const t = $json;
let detail;
if (t.email) detail = { email: t.email };
else if (t.linkedin) detail = { linkedin_url: t.linkedin };
else {
  const parts = String(t.name || '').trim().split(/\s+/);
  detail = { first_name: parts[0] || '', last_name: parts.slice(1).join(' ') || '', domain: t.domain };
}
return [{ json: { slug: t.slug, webhook_url: CALLBACK_URL, details: [ detail ] } }];

// ===== "Build id→slug map" =====
// Sync bulk_match response returns matched people WITH their Apollo id (phones arrive later via webhook).
// Store id→slug so the async callback knows which outreach doc to patch.
const slug = $('Build phone reveal body').item.json.slug;
const res2 = $json || {};
const m = (res2.matches || res2.people || [])[0] || {};
const id = m.id || m.person_id || '';
const S2 = v => ({ stringValue: (v == null ? '' : String(v)) });
const fsBody = { fields: { slug: S2(slug), email: S2(m.email || ''), mapped_at: { timestampValue: new Date().toISOString() } } };
return [{ json: { apollo_id: id, slug, fsBody } }];


// ============================================================
// WORKFLOW 15 — Apollo Phone Callback
// ============================================================

// ===== "Parse callback → phone writes" =====
// Documented payload: { status, credits_consumed, people:[ { id, phone_numbers:[ { sanitized_number, raw_number, type_cd, status_cd, position } ] } ] }
const b = ($json && $json.body) ? $json.body : $json;
let people = [];
if (Array.isArray(b)) people = b;
else if (Array.isArray(b.people)) people = b.people;
else if (Array.isArray(b.matches)) people = b.matches;
else if (Array.isArray(b.contacts)) people = b.contacts;
else if (b.person) people = [b.person];
else if (b.id || b.phone_numbers) people = [b];

function pickPhone(p) {
  const arr = p.phone_numbers || p.phones || [];
  if (Array.isArray(arr) && arr.length) {
    const score = x => {
      const t = String(x.type_cd || x.type || '').toLowerCase();
      let s = 0;
      if (/mobile|cell/.test(t)) s += 100;
      if (String(x.status_cd || '').toLowerCase().includes('valid')) s += 10;
      s -= (Number(x.position) || 0);
      return s;
    };
    const best = arr.slice().sort((a, b2) => score(b2) - score(a))[0] || arr[0];
    const all = arr.map(x => x.sanitized_number || x.raw_number || '').filter(Boolean).join(', ');
    return { num: best.sanitized_number || best.raw_number || best.number || '', type: best.type_cd || best.type || '', status: best.status_cd || best.status || '', all };
  }
  return { num: p.sanitized_phone || p.phone_number || p.phone || '', type: '', status: '', all: '' };
}

const out2 = [];
for (const p of people) {
  const id = p.id || p.person_id || '';
  const ph = pickPhone(p);
  if (!id || !ph.num) continue;
  out2.push({ json: { apollo_id: id, phone: ph.num, phone_type: ph.type, phone_status: ph.status, phone_all: ph.all } });
}
return out2;

// ===== "Build outreach patch" =====
// Pair the map doc (this node's input $json) with its phone payload (same item index upstream).
const phoneItem = $('Parse callback → phone writes').item.json;
const mapRes = $json || {};
const slug3 = (mapRes.fields && mapRes.fields.slug && mapRes.fields.slug.stringValue) || '';
const S3 = v => ({ stringValue: (v == null ? '' : String(v)) });
const fsBody3 = { fields: {
  phone: S3(phoneItem.phone),
  phone_type: S3(phoneItem.phone_type),
  phone_status: S3(phoneItem.phone_status),
  phone_all: S3(phoneItem.phone_all),
  phone_revealed_at: { timestampValue: new Date().toISOString() }
} };
return [{ json: { slug: slug3, fsBody: fsBody3, ok: !!slug3 } }];
