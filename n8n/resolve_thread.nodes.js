// ─────────────────────────────────────────────────────────────────────────
// Paste-ready Code-node JS for n8n workflow 11 (Resolve Thread Link).
// Two Code nodes; copy each block into the matching node's "JavaScript Code".
// ─────────────────────────────────────────────────────────────────────────

// ===== NODE "Build search" ===============================================
// Turn the {subject, contact} the app posts into a Graph $search string.
// Subject stays free-text (no subject:"..." KQL — nesting quotes inside the
// already-quoted $search value breaks it). A contact that's an EMAIL uses the
// participants: keyword (precise); a name is added as free text. KQL keywords
// are fine inside the outer quotes; only nested double-quotes are the problem.
const b = ($json.body && typeof $json.body === 'object') ? $json.body : $json;
const clean = s => String(s || '').replace(/["\r\n]/g, ' ').trim();
const subject = clean(b.subject);
const contact = clean(b.contact);
const terms = [];
if (subject) terms.push(subject);
if (contact) terms.push(contact.includes('@') ? ('participants:' + contact) : contact);
const search = terms.join(' ').trim();
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
// Graph's webLink comes back as either the classic outlook.office365.com/owa/?ItemID=…
// &viewmodel=ReadMessageItem form or the new outlook.cloud.microsoft/mail/deeplink/read/…
// form — and BOTH fail with "This message might have been moved or deleted" (the owa form
// redirects into the same broken new-Outlook reader). The ONE form that opens is:
//   https://outlook.office365.com/mail/deeplink/read/<pathId>?ItemID=<ItemID>&exvsurl=1
// where <pathId> = the ItemID with base64 '/' and '+' swapped to '-'. So extract the
// ItemID from whatever Graph returns and rebuild that working URL before storing.
// (Confirmed working 2026-06-25.) The app also rebuilds at render time as a backstop.
function fixThreadUrl(u) {
  if (!u || typeof u !== 'string') return u;
  const m = /[?&]ItemID=([^&]+)/i.exec(u);
  if (!m) return u.replace(/^(https?:\/\/)outlook\.cloud\.microsoft\//i, '$1outlook.office365.com/');
  const itemId = m[1];
  const pathId = itemId.replace(/%2F/gi, '-').replace(/%2B/gi, '-');
  return 'https://outlook.office365.com/mail/deeplink/read/' + pathId + '?ItemID=' + itemId + '&exvsurl=1';
}
const webLink = fixThreadUrl(best.webLink);
return [{ json: {
  found: true,
  webLink,
  conversationId: best.conversationId || '',
  subject: best.subject || '',
  from: (best.from && best.from.emailAddress && best.from.emailAddress.address) || '',
  date: best.receivedDateTime || best.sentDateTime || ''
} }];
