// ─────────────────────────────────────────────────────────────────────────
// Paste-ready Code-node JS for n8n workflow 34 (Send Follow-up Reply).
// Three Code nodes; copy each block into the matching node's "JavaScript
// Code". Companion to 34_send_followup_reply.json.
// ─────────────────────────────────────────────────────────────────────────

// ===== NODE "Pick reply target" =========================================
// Decode the Firestore GET response (single-document shape: {name, fields,
// createTime, updateTime} — NOT the runQuery {document:{...}} shape workflow
// 33 parses) and pick which email_links[] entry to reply into.
//
// email_links[] is append-only (see index.html's resolveThreadLink() / CLAUDE.md
// leads/{id} schema) — every push adds a new entry, nothing is ever reordered
// or removed except by the app's own thread-refresh overwriting a single
// entry's url/hasNew fields in place. So "last entry with a non-empty
// graphMessageId" is always the newest real Graph message id we have for this
// lead, whether it came from workflow 33 (qualifying email), workflow 11
// (thread resolver backfill), or a PRIOR run of this very workflow (34) —
// which is exactly what makes follow-up #2, #3, etc. chain correctly: each
// send below writes its own new graphMessageId, so the NEXT follow-up replies
// into THAT message, not back into the original qualifying email.
function fsVal(field) {
  if (!field) return null;
  if (field.stringValue  !== undefined) return field.stringValue;
  if (field.integerValue !== undefined) return Number(field.integerValue);
  if (field.doubleValue  !== undefined) return field.doubleValue;
  if (field.booleanValue !== undefined) return field.booleanValue;
  if (field.nullValue    !== undefined) return null;
  if (field.mapValue) {
    const out = {};
    for (const [k, v] of Object.entries(field.mapValue.fields || {})) out[k] = fsVal(v);
    return out;
  }
  if (field.arrayValue) return (field.arrayValue.values || []).map(fsVal);
  return null;
}

const doc = $json || {};
const payload = (($('Webhook').first().json.body) || {});

if (!doc.fields || !doc.name) {
  return [{ json: { found: false, reason: 'lead_not_found', leadId: payload.leadId || '' } }];
}

const nameParts = doc.name.split('/');
const leadId = nameParts[nameParts.length - 1];
const lead = { id: leadId };
for (const [k, v] of Object.entries(doc.fields)) lead[k] = fsVal(v);

const links = Array.isArray(lead.email_links) ? lead.email_links : [];
let target = null;
for (let i = links.length - 1; i >= 0; i--) {
  if (links[i] && links[i].graphMessageId) { target = links[i]; break; }
}

if (!target) {
  return [{ json: { found: false, reason: 'no_graph_message_id', leadId } }];
}

return [{ json: {
  found: true,
  leadId,
  lead,
  graphMessageId: target.graphMessageId,
  payloadSubject: payload.subject || '',
  payloadBody: payload.body || '',
  label: payload.label || '',
  followupNum: (payload.followupNum === undefined || payload.followupNum === null) ? null : payload.followupNum
} }];


// ===== NODE "Convert body to HTML" ======================================
// Graph HTML bodies do NOT auto-render raw \n\n the way a mailto: link's
// body does (that's a client-side email-app convenience, not an HTML render
// rule) -- a plain-text body with real newlines sent as contentType:'HTML'
// renders as one run-on paragraph in Outlook. Convert the app's plain-text
// follow-up body (paragraphs separated by a blank line, per the existing
// FOLLOWUP_BY_STAGE/FOLLOWUP_NUDGE/FOLLOWUP_VALUE/FOLLOWUP_BREAKUP templates
// in index.html) into real <div>/<br> markup before it goes anywhere near
// Graph, same styling shell workflow 33 already uses for its HTML body so a
// reply looks visually consistent with the qualifying email that started
// the thread.
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function textToHtml(text) {
  const paragraphs = String(text || '').split(/\n{2,}/);
  const parts = paragraphs.map(p =>
    '<div>' + escapeHtml(p).replace(/\n/g, '<br>') + '</div>'
  );
  const joined = parts.join('<div>&nbsp;</div>');
  return '<div style="font-family:Aptos,Calibri,Helvetica,sans-serif;font-size:12pt;color:rgb(0,0,0)">' + joined + '</div>';
}

const picked = $('Pick reply target').item.json;
const draft = $json || {};

return [{ json: {
  ...picked,
  draftId: draft.id || '',
  draftConversationId: draft.conversationId || '',
  draftWebLink: draft.webLink || '',
  bodyHtml: textToHtml(picked.payloadBody)
} }];


// ===== NODE "Build lead patch" ==========================================
// Same 'build patch -> PATCH Firestore -> Teams card' tail pattern as
// workflow 33's 'Build lead patch' node -- reusing its exact toFs()/
// fixThreadUrl() helpers verbatim.
function fixThreadUrl(u) {
  if (!u || typeof u !== 'string') return u;
  const m = /[?&]ItemID=([^&]+)/i.exec(u);
  if (!m) return u.replace(/^(https?:\/\/)outlook\.cloud\.microsoft\//i, '$1outlook.office365.com/');
  const itemId = m[1];
  const pathId = itemId.replace(/%2F/gi, '-').replace(/%2B/gi, '-');
  return 'https://outlook.office365.com/mail/deeplink/read/' + pathId + '?ItemID=' + itemId + '&exvsurl=1';
}

function toFs(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFs) } };
  if (typeof v === 'object') {
    const fields = {};
    for (const [k, val] of Object.entries(v)) fields[k] = toFs(val);
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

const picked2 = $('Convert body to HTML').item.json;
const lead = picked2.lead || {};
const now = new Date().toISOString();
const webLink = fixThreadUrl(picked2.draftWebLink || '');
const followupNum = picked2.followupNum;

// New email_links[] entry keyed off THIS reply's own new graphMessageId --
// deliberately NOT the id we replied into. That's what makes a later
// follow-up (#N+1) chain onto THIS message instead of looping back to the
// original qualifying email every time (see 'Pick reply target' notes above).
const newLink = {
  id: 'el' + Date.now(),
  label: picked2.label ? ('Follow-up: ' + picked2.label) : 'Follow-up reply',
  subject: picked2.payloadSubject || '',
  contact: lead.contact || lead.email || '',
  url: webLink,
  conversationId: picked2.draftConversationId || '',
  graphMessageId: picked2.draftId || ''
};
const existingLinks = Array.isArray(lead.email_links) ? lead.email_links : [];

// Mirrors the shape logFollowupSent() writes client-side for a manually
// opened/sent follow-up (see CLAUDE.md's leads/{id} schema, 'Auto-logged
// follow-up sends') -- this workflow is now doing server-side what that
// function does in the browser, so the entry needs to look identical or the
// app's own contactInfo()/isFollowupDue()/nextFollowupNum() logic (which
// reads entries[] directly, not these mirror fields) would miscount sends
// that went through the batch-approve queue.
const newEntry = {
  id: 'e' + Date.now(),
  text: 'Sent follow-up' + (picked2.label ? (' (' + picked2.label + ')') : '') + ' as a real Outlook reply (auto, batch-approve)' + (followupNum !== null && followupNum !== undefined ? (', #' + followupNum) : '') + '.',
  kind: 'email',
  type: 'wait',
  dir: 'out',
  done: false,
  createdAt: now,
  followupNum: (followupNum === null || followupNum === undefined) ? null : followupNum
};
const existingEntries = Array.isArray(lead.entries) ? lead.entries : [];

const patchFields = {
  updatedAt: toFs(now),
  email_links: toFs([...existingLinks, newLink]),
  entries: toFs([...existingEntries, newEntry]),
  last_followup_label: toFs(picked2.label || ''),
  last_followup_num: toFs(followupNum === null || followupNum === undefined ? null : followupNum),
  last_followup_sent_at: toFs(now)
};

return [{ json: {
  leadId: picked2.leadId,
  patchBody: { fields: patchFields },
  updateMask: Object.keys(patchFields).join('&updateMask.fieldPaths='),
  contact: lead.contact || lead.company || '',
  company: lead.company || '',
  label: picked2.label || ''
} }];
