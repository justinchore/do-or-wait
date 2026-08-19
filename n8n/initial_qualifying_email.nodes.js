// ─────────────────────────────────────────────────────────────────────────
// Paste-ready Code-node JS for n8n workflow 33 (Send Initial Qualifying
// Email). Three Code nodes; copy each block into the matching node's
// "JavaScript Code". Companion to 33_initial_qualifying_email.json.
// ─────────────────────────────────────────────────────────────────────────

// ===== NODE "Parse & filter leads" =====================================
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

const items = $input.all();
const results = [];

for (const item of items) {
  const body = item.json;
  if (!body || !body.document) continue;
  const nameParts = body.document.name.split('/');
  const id = nameParts[nameParts.length - 1];
  const fields = body.document.fields || {};
  const lead = { id };
  for (const [k, v] of Object.entries(fields)) lead[k] = fsVal(v);

  // Safety guard: skip anything that looks like a test row rather than a
  // real prospect. yardi_export.py doesn't filter these out upstream (the
  // "Jay Test"/"Justin Test" rows Justin already flagged as a loose end
  // sitting in the export sheet) -- without this, a leftover test row would
  // get a real email sent to it the moment it synced into Firestore.
  const hay = [lead.company, lead.contact, lead.first_name, lead.email].join(' ').toLowerCase();
  if (/\btest\b/.test(hay)) continue;
  if (!lead.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) continue;

  results.push({ json: lead });
}

return results;


// ===== NODE "Render qualifying email" ===================================
const lead = $json;
const first = lead.first_name || (lead.contact ? String(lead.contact).split(' ')[0] : '') || 'there';

// Workflow 32 writes location as "{property} ({address})" (or just
// "{property}" if no address was on file) -- split it back apart so the
// template can reference the property name and street separately, per the
// location-known branch of Sales/Templates/First-Touch Qualifying Email
// Template.md: "I saw you inquired about our [Location] location on
// [Street/Area]...".
const loc = String(lead.location || '').trim();
const m = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(loc);
const property = (m ? m[1] : loc).trim();
const address = m ? m[2].trim() : '';

const locationLine = property
  ? ('I saw you inquired about our ' + property + ' location' + (address ? (' on ' + address) : '') + ". To make sure that's the right fit, could you confirm your square footage needs and target move-in timeline?")
  : 'To point you to the right place, could you share your location preference, square footage needs, and target move-in timeline?';

// Body is Sales/Templates/First-Touch Qualifying Email Template.md verbatim
// (General variant, location-known branch). Amenity bullets are the
// company-wide standard offer, not site-specific, per that template's own
// notes-for-use. No pricing, no tour language, ends at "Best," with no
// manual signature block (client auto-signs).
const body = [
  'Hello ' + first + ',',
  '',
  "Thanks for reaching out. My name is Justin, and I'm a Business Development Executive at Cubework.",
  '',
  'At Cubework, we offer flexible lease terms and a range of full-service amenities designed to support your business:',
  '',
  '* Fully furnished, professionally staffed facilities',
  '* 24/7 access',
  '* Flexible lease terms',
  '* Water, coffee, and tea',
  '* Basic utilities (electricity, water)',
  '* Free Wi-Fi (office areas, breakrooms)',
  '* Shared loading docks',
  '* CCTV security',
  '* Janitorial services',
  '* Trash/dumpster service',
  '',
  'Additional Services (Not included in pricing):',
  '',
  '* Forklift rentals',
  '* Secure Wi-Fi (warehouse)',
  '* Electrical outlet installation (warehouse)',
  '',
  locationLine,
  '',
  'Best,'
].join('\n');

// FLAG FOR JUSTIN: the source template has no subject of its own since it's
// normally used as a manual reply. This is a cold automated send instead, so
// it needs one -- confirm/adjust before trusting this live.
const subject = 'Re: Your inquiry about Cubework' + (property ? (' ' + property) : '');

return [{ json: {
  leadId: lead.id,
  to: lead.email,
  subject,
  body,
  property,
  address
} }];


// ===== NODE "Build lead patch" ==========================================
const rendered = $('Render qualifying email').item.json;
const draft = $('Create draft message').item.json || {};
const lead  = $('Loop pending leads').first().json;

// Graph's webLink comes back in a form that fails with "This message might
// have been moved or deleted" -- see resolve_thread.nodes.js / index.html's
// fixThreadUrl() for the full story. Reusing the exact same fix here so a
// thread we link ourselves opens the same way a manually-resolved one does.
function fixThreadUrl(u) {
  if (!u || typeof u !== 'string') return u;
  const m = /[?&]ItemID=([^&]+)/i.exec(u);
  if (!m) return u.replace(/^(https?:\/\/)outlook\.cloud\.microsoft\//i, '$1outlook.office365.com/');
  const itemId = m[1];
  const pathId = itemId.replace(/%2F/gi, '-').replace(/%2B/gi, '-');
  return 'https://outlook.office365.com/mail/deeplink/read/' + pathId + '?ItemID=' + itemId + '&exvsurl=1';
}

const now = new Date().toISOString();
const webLink = fixThreadUrl(draft.webLink || '');

// Same email_links shape the app already renders (see leadThreadConversationId
// / renderEmailLinks in index.html) -- pre-resolved at send time instead of
// going through the workflow-11 subject/contact search, since we already
// know exactly which message this is.
const newLink = {
  id: 'el' + Date.now(),
  label: 'Qualifying email',
  subject: rendered.subject,
  contact: rendered.to,
  url: webLink,
  conversationId: draft.conversationId || ''
};
const existingLinks = Array.isArray(lead.email_links) ? lead.email_links : [];

const newEntry = {
  id: 'e' + Date.now(),
  text: 'Sent first-touch qualifying email (auto, General template)' + (rendered.property ? (' re: ' + rendered.property + ' location.') : '.') + ' Asked to confirm sqft needs and move-in timeline.',
  kind: 'email',
  type: 'wait',
  dir: 'out',
  done: false,
  createdAt: now
};
const existingEntries = Array.isArray(lead.entries) ? lead.entries : [];

// Minimal JS -> Firestore REST value encoder -- just the shapes this doc
// actually uses (string / bool / null / array-of-object / object).
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

const patchFields = {
  qualifying_email_status: toFs('sent'),
  qualifying_email_sent_at: toFs(now),
  updatedAt: toFs(now),
  email_links: toFs([...existingLinks, newLink]),
  entries: toFs([...existingEntries, newEntry])
};

return [{ json: {
  leadId: lead.id,
  patchBody: { fields: patchFields },
  updateMask: Object.keys(patchFields).join('&updateMask.fieldPaths='),
  contact: lead.contact || lead.company || rendered.to,
  company: lead.company || '',
  property: rendered.property
} }];
