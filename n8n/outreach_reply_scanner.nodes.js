// ─────────────────────────────────────────────────────────────────────────
// Paste-ready Code-node JS for n8n workflow 23 (Outreach Reply Scanner).
// Four Code nodes; copy each block into the matching node's "JavaScript Code".
// (Like the other .nodes.js files in this folder, this file does NOT parse
// as a single script - several blocks declare top-level consts with the
// same name. Each "===== NODE" section is meant to be copied into its own
// node individually, not run together.)
//
// NOTE ON THE SCANNED FOLDER (added 2026-07-10, before first import): Justin's
// replies land in a subfolder of Inbox called "me" (Inbox/me), not the Inbox
// root itself. There's a 5th node in the workflow, "Resolve 'me' folder" (a
// plain HTTP node, no Code needed), sitting between "Get scan window" and
// "Fetch inbox messages since window" - it looks up that child folder's real
// ID via GET /me/mailFolders('inbox')/childFolders?$filter=displayName eq 'me'
// (Graph's 'inbox' shortcut only works for well-known top-level folders, not
// custom child folders, so a real ID lookup is required). "Fetch inbox
// messages since window" then queries /me/mailFolders/{that id}/messages
// instead of /me/mailFolders('inbox')/messages. Resolved fresh every 2-hour
// scan rather than cached - one extra cheap Graph call per run buys staying
// correct even if the folder is ever recreated. continueOnFail is set so a
// lookup miss (folder renamed/missing) just yields zero senders that scan
// instead of failing the whole run.
//
// NOTE ON THE MANUAL "CHECK NOW" BUTTON (added 2026-07-10): a second trigger,
// "Manual check webhook" (path outreach-reply-scan), feeds the exact same
// chain as the cron - it just runs the next scan immediately instead of
// waiting for the clock, still only looking back to wherever the last scan
// (cron or manual) left off. A "Respond to check" node right after "Extract
// distinct senders" gives the button an immediate ack ({ok,checked,
// newSendersSeen}) without waiting for the Firestore writes further down the
// chain to finish - the app's live listeners pick up the actual reply flags
// moments later either way. On cron-triggered runs, "Respond to check" is a
// normal no-op (nothing is listening for a response).
//
// WHY THIS SHAPE: neither the Outreach tab (outreach/{id}, 260+ prospects)
// nor Property Outreach (property_outreach/{id}, 360+ records across Ontario
// Airport + Pellissier) has reply-detection today. The obvious approach -
// clone workflow 6's per-lead Graph $search loop - costs one Graph call per
// prospect per run; at these volumes (and property_outreach's is already
// past the ~300-doc single-page boundary) that doesn't scale, and it doesn't
// even solve the enumeration problem cleanly since listing either collection
// fully now needs real pagination.
//
// This design flips the direction of the lookup: pull the small number of
// NEW inbox messages since the last scan (one Graph call, filtered by
// receivedDateTime), extract the distinct sender addresses from just those
// messages, then ask Firestore directly - via a targeted IN-filter query -
// whether any of those addresses belong to a known outreach or
// property_outreach record. Cost now scales with new-mail volume per scan,
// not with how large either prospect list grows, and neither collection is
// ever listed in full. This is a "windowed scan," not a true Graph delta
// query (delta's first-ever call returns the ENTIRE mailbox history before
// yielding a cursor, and delta subscriptions/cursors add a new failure mode
// this project has consistently avoided). Tradeoff: a cold start only looks
// back 24h, so replies that arrived before this workflow's first run won't
// retroactively surface - same "starts tracking from when it goes live, not
// before" limitation as every other monitor in this project (e.g. the
// Follow-up Scanner, workflow 6).
// ─────────────────────────────────────────────────────────────────────────

// ===== NODE "Get scan window" ===============================================
// Bounded cold-start: the very first run only looks back 24h (not the whole
// mailbox history) so this workflow never has to wade through years of old
// mail. Every run after that resumes exactly where the last one left off,
// persisted in this workflow's own static data - same mechanism workflow 18
// uses for its tab accumulator.
const sd = $getWorkflowStaticData('global');
const now = new Date();
let sinceIso = sd.last_scan_iso;
if (!sinceIso) {
  sinceIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
}
return [{ json: { sinceIso, nowIso: now.toISOString() } }];


// ===== NODE "Extract distinct senders" (after the Graph "Fetch inbox messages since window" HTTP node) ====
// Build the small set of distinct sender addresses seen in this scan window.
// Deliberately NOT listing the outreach/property_outreach collections at
// all - property_outreach alone is already 360+ docs (crossed the practical
// ~300-doc single-page boundary once Pellissier joined Ontario Airport
// 2026-07-09), so "list every prospect and match against new mail in code"
// doesn't hold up. Instead: pull the handful of new inbox senders, then ask
// Firestore directly via a targeted IN-filter query (next nodes).
const resp = $json || {};
const msgs = Array.isArray(resp.value) ? resp.value : [];
const byAddr = {};
for (const m of msgs) {
  const raw = ((m.from && m.from.emailAddress && m.from.emailAddress.address) || '').trim();
  if (!raw) continue;
  const lower = raw.toLowerCase();
  const receivedAt = m.receivedDateTime || '';
  if (!byAddr[lower] || new Date(receivedAt) > new Date(byAddr[lower].receivedAt)) {
    byAddr[lower] = { subject: m.subject || '', bodyPreview: (m.bodyPreview || '').slice(0, 220), receivedAt, webLink: m.webLink || '', raw };
  }
}
const addrs = Object.keys(byAddr);
// Firestore's IN filter allows up to 30 comparison values. Query both the
// raw-cased and lowercased form of each address (Apollo-sourced Outreach
// emails are stored lowercase; Property Outreach contacts are typed in by
// hand via savePOContact and may not be), capped at 15 distinct senders per
// scan - comfortably covers normal reply volume in a 2-hour window. Not
// currently a known problem; revisit (chunked queries) if inbox volume ever
// exceeds it.
const capped = addrs.slice(0, 15);
const values = new Set();
capped.forEach(a => { values.add(a); values.add(byAddr[a].raw); });
return [{ json: {
  senderMap: byAddr,
  values: Array.from(values),
  nowIso: $('Get scan window').first().json.nowIso
} }];


// ===== NODE "Save scan window" (fed directly off "Extract distinct senders", runs every time) ====
// Advance the scan cursor whether or not anything matched this run, so the
// next run resumes right after this window instead of re-scanning it. A
// small overlap is subtracted so a message landing mid-scan (or minor clock
// skew between this box and Graph) is never silently skipped between runs.
const sd2 = $getWorkflowStaticData('global');
const nowIso2 = $json.nowIso;
const OVERLAP_MIN = 20;
sd2.last_scan_iso = new Date(new Date(nowIso2).getTime() - OVERLAP_MIN * 60 * 1000).toISOString();
return [{ json: { saved: true, next_scan_from: sd2.last_scan_iso } }];


// ===== NODE "Match + build items" (fed from "Query outreach by sender", after the "Has any new mail?" IF true branch) ====
// Both runQuery calls (the two HTTP nodes querying outreach and
// property_outreach by sender address) may come back as either ONE item
// whose json is the raw response array, or (n8n's usual auto-behavior for a
// top-level JSON array response) one item PER array element - collectAll()
// below handles either shape. Firestore's runQuery response is a stream of
// RunQueryResponse objects; entries with no actual match just don't carry a
// document field. Shapes matches into the { id, fields } convention
// workflow 20 (the generic Firestore writer, already LIVE) expects for a
// bulk_update - this scanner needs no Firestore write logic of its own.
function collectAll(nodeName) {
  const items = $(nodeName).all();
  const out = [];
  for (const it of items) {
    const j = it.json;
    if (Array.isArray(j)) out.push(...j); else out.push(j);
  }
  return out;
}
function decode(v) {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return parseInt(v.integerValue, 10);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decode);
  if ('mapValue' in v) { const o = {}; for (const k in (v.mapValue.fields || {})) o[k] = decode(v.mapValue.fields[k]); return o; }
  return null;
}
function extractMatches(rows) {
  const out = [];
  for (const row of (rows || [])) {
    const d = row && row.document; if (!d) continue;
    const f = d.fields || {};
    const email = decode(f.email); if (!email) continue;
    const id = (d.name || '').split('/').pop();
    out.push({ id, email: String(email).toLowerCase() });
  }
  return out;
}
const senderMap2 = $('Extract distinct senders').first().json.senderMap || {};
const outreachRows = collectAll('Query outreach by sender');
const poRows = collectAll('Query property_outreach by sender');
const outreachMatches = extractMatches(outreachRows);
const poMatches = extractMatches(poRows);
const nowIso3 = new Date().toISOString();
function toItems(matches) {
  return matches.map(m => {
    const info = senderMap2[m.email] || {};
    return { id: m.id, fields: {
      reply_detected: true,
      reply_detected_at: nowIso3,
      reply_received_at: info.receivedAt || '',
      reply_subject: info.subject || '',
      reply_snippet: info.bodyPreview || '',
      reply_web_link: info.webLink || '',
      reply_seen: false
    } };
  });
}
const outreachItems = toItems(outreachMatches);
const propertyOutreachItems = toItems(poMatches);
return [{ json: {
  outreachItems, propertyOutreachItems,
  outreachCount: outreachItems.length, propertyOutreachCount: propertyOutreachItems.length
} }];
