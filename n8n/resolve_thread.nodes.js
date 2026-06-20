// ─────────────────────────────────────────────────────────────────────────
// Paste-ready Code-node JS for n8n workflow 11 (Resolve Thread Link).
// Two Code nodes; copy each block into the matching node's "JavaScript Code".
// ─────────────────────────────────────────────────────────────────────────

// ===== NODE "Build search" ===============================================
// Turn the {subject, contact} the app posts into one Graph $search string.
// Kept as FREE TEXT (not KQL subject:"..." participants:...) because the
// $search value is wrapped in quotes in the HTTP node, and nesting quotes
// inside breaks the query. Graph relevance-ranks; the newest hit is the thread.
const b = ($json.body && typeof $json.body === 'object') ? $json.body : $json;
const clean = s => String(s || '').replace(/["\r\n]/g, ' ').trim();
const subject = clean(b.subject);
const contact = clean(b.contact);
const search  = [subject, contact].filter(Boolean).join(' ').trim();
return [{ json: { search, subject, contact, hasQuery: !!search } }];


// ===== NODE "Pick newest hit" ============================================
// Pick the newest message across the relevance-ranked hits and return its
// webLink — the official Graph property that OPENS that message/thread in
// Outlook on the web. $search can't combine with $orderby, so sort in code.
// Graph error (continueOnFail) or no hits -> found:false.
const resp = $input.first().json || {};
const msgs = Array.isArray(resp.value) ? resp.value : [];
let best = null, bestMs = null;
for (const m of msgs) {
  if (!m) continue;
  const t = Date.parse(m.receivedDateTime || m.sentDateTime || '');
  if (isNaN(t)) continue;
  if (bestMs === null || t > bestMs) { bestMs = t; best = m; }
}
if (!best || !best.webLink) {
  return [{ json: { found: false } }];
}
return [{ json: {
  found: true,
  webLink: best.webLink,
  conversationId: best.conversationId || '',
  subject: best.subject || '',
  from: (best.from && best.from.emailAddress && best.from.emailAddress.address) || '',
  date: best.receivedDateTime || best.sentDateTime || ''
} }];
