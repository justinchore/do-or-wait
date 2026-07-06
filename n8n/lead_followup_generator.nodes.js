// Paste-ready Code-node JS for n8n workflow 17 (Generate Lead Follow-up).
// Four Code nodes; copy each block into the matching node's "JavaScript Code".
// Companion to 17_lead_followup_generator.json.
// ─────────────────────────────────────────────────────────────────────────

// ===== NODE "Format thread context" (true branch of "Has thread?") ========
// Turn the Graph messages for this conversation into a compact, chronological
// text block for Claude. Falls back to the app's notesText if Graph errored or
// the conversationId turned up nothing (continueOnFail on the HTTP node above
// means an error lands here as {error:...} instead of throwing).
const b = ($('Webhook').first().json.body) || {};
const resp = $input.first().json || {};
const msgs = Array.isArray(resp.value) ? resp.value : [];

function stripHtml(h) {
  if (!h) return '';
  return String(h)
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const sorted = msgs
  .filter(m => m && (m.receivedDateTime || m.sentDateTime))
  .sort((a, c) => new Date(a.receivedDateTime || a.sentDateTime) - new Date(c.receivedDateTime || c.sentDateTime));

const lines = sorted.slice(-5).map(m => {
  const from = (m.from && m.from.emailAddress && (m.from.emailAddress.name || m.from.emailAddress.address)) || 'Unknown';
  const date = (m.receivedDateTime || m.sentDateTime || '').slice(0, 10);
  const raw  = m.body ? (m.body.contentType === 'html' ? stripHtml(m.body.content) : String(m.body.content || '')) : (m.bodyPreview || '');
  const trimmed = raw.length > 700 ? raw.slice(0, 700) + '...' : raw;
  return '[' + date + '] ' + from + ': ' + trimmed;
});

const context = lines.length ? lines.join('\n\n') : (b.notesText || '');
return [{ json: { ...b, context, contextSource: lines.length ? 'thread' : 'notes' } }];


// ===== NODE "Format notes context" (false branch of "Has thread?") ========
// No linked/resolved thread on this lead — use the notes/updates text the app
// already sent (built client-side from the lead's logged entries).
const b2 = $json.body || $json;
return [{ json: { ...b2, context: b2.notesText || '', contextSource: 'notes' } }];


// ===== NODE "Build Claude request" =========================================
// Build the Claude request. Shared node fed by either the thread-context or
// notes-context branch above (whichever one actually ran for this execution).
// TONE IS THE MOST IMPORTANT PART of this feature (Justin's call, 2026-07-06):
// this is a warm follow-up to someone he's ALREADY talking to, not cold
// outreach, so the model must reference the real, specific context it's given
// rather than writing a generic "just checking in" note.
const b3 = $input.first().json;
const first = b3.first_name || (b3.contact ? String(b3.contact).split(' ')[0] : '') || 'there';

const HOOKS = {
  importer:  'near the LA/Long Beach ports, with Cubeship able to handle freight and customs on site',
  ecommerce: 'set up for fulfillment and last-mile, with 24/7 access',
  '3pl':     'built to scale up or down as accounts change, with multiple sites under one agreement',
  tenant:    'easy to add as overflow or a second site under the same agreement'
};
const hook = HOOKS[b3.segment] || '';

const sys = 'You are drafting a short follow-up email from Justin Cho at Cubework to a lead he is ALREADY in touch with. This is NOT cold outreach. Cubework offers flexible month-to-month warehouse, office, and dock space with simple license agreements (never a lease), all-inclusive pricing (one flat monthly rate, no NNN, no CAM, no surprise utility bills), and fast move-in (24-48 hours).\n\nYou will be given the lead\'s basic details and RECENT CONTEXT: either the actual email thread (real messages, oldest to newest) or Justin\'s own logged call, text, and note history. Read it closely. The entire point of this email is to reference something REAL and SPECIFIC from that context, never a generic check-in.\n\nWrite ONE follow-up email that: 1) Opens by referencing something specific from the context given, such as what they asked, what was discussed, or where things were left. Never invent a detail that is not in the context. 2) Adds ONE genuinely useful new thing: a direct answer to something they raised, a concrete next step, or, only if it fits naturally, a brief pricing or flexibility reminder. Never a bare check-in with nothing new to say. 3) Ends with ONE short, low-friction question that moves things forward. 4) Signs off on its own line, exactly: Best,\nJustin Cho\nBusiness Development, Cubework\n\nIf the given context is too thin to reference anything specific and honest, do not invent details. Instead write one short, low-key, honest line acknowledging it has been quiet, then ask one simple question, rather than forcing a fake personalization.\n\nVOICE (this is the most important part): plain, warm, direct, like a real person continuing an actual conversation, never like a template or a marketing email. Short sentences, most under 12 words, one idea each. Write at a 5th-grade reading level. Use the simplest word that works (use not utilize, help not facilitate, near not in close proximity to). Cut any word that does not change the meaning. No jargon. Never use any of these: just checking in, circling back, wanted to touch base, I hope this finds you well, following up on my previous email, per my last email, as previously mentioned, leverage, synergy, solutions, elevate, streamline, ideal for, I would be happy to discuss. Do not use any dash character to join clauses, no em dash, no en dash, no double hyphen, use a period or comma instead. No bulleted or numbered lists. No hype, no exclamation points. NEVER use the word lease in any form, say no long-term commitment instead. Keep the email body under 100 words, not counting the sign-off.\n\nSUBJECT: 3 to 6 words, lowercase or sentence case, references the specific context when possible. Never generic like Following up or Checking in.\n\nReturn ONLY minified JSON, no prose, no code fences: {"subject":"...","body":"..."}';

const userMsg = 'LEAD DETAILS\n' +
  'Company: ' + (b3.company || '(unknown)') + '\n' +
  'Contact first name: ' + first + '\n' +
  'Stage: ' + (b3.stage || 'cold') + '\n' +
  'Unit/size on file: ' + (b3.unit ? (b3.unit + (b3.unit_sf ? ' (' + b3.unit_sf + ' sf)' : '')) : '(none)') + '\n' +
  'Segment value angle, use only if it fits naturally, do not force it: ' + (hook || '(none)') + '\n\n' +
  'RECENT CONTEXT (' + (b3.contextSource === 'thread' ? 'actual email thread, oldest to newest' : "Justin's own logged updates") + '):\n' +
  (b3.context || '(nothing specific on file)');

const requestBody = {
  model: 'claude-sonnet-4-6',
  max_tokens: 700,
  system: sys,
  messages: [ { role: 'user', content: userMsg } ]
};
return [{ json: { leadId: b3.leadId, contextSource: b3.contextSource, requestBody } }];


// ===== NODE "Build Firestore patch" ========================================
const ctx = $('Build Claude request').item.json;
let parsed = {};
try {
  const blocks = $json.content || [];
  const raw = Array.isArray(blocks) ? blocks.filter(x => x && x.type === 'text').map(x => x.text).join('\n') : '';
  const m = raw.match(/\{[\s\S]*\}/);
  parsed = JSON.parse(m ? m[0] : raw);
} catch (e) { parsed = {}; }
const dedash = s => String(s == null ? '' : s).replace(/\s*[—–]\s*/g, ', ').replace(/\s--\s/g, ', ');
const now = new Date().toISOString();
const S = v => ({ stringValue: (v == null ? '' : String(v)) });
const subject = dedash(parsed.subject || '');
const body = dedash(parsed.body || '');
const fields = {
  followup_draft: { mapValue: { fields: {
    subject: S(subject),
    body: S(body),
    generated_at: S(now),
    source: S(ctx.contextSource || 'notes')
  } } }
};
return [{ json: { leadId: ctx.leadId, fsBody: { fields } } }];
