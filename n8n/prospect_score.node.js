// ─────────────────────────────────────────────────────────────────────────
// Prospect Finder — paste-ready Code node bodies (clean copies)
// Mirrors the convention of parse_build_patch.node.js: the authoritative
// copies also live inside 8_prospect_finder.json; edit here, keep in sync.
// Two nodes: (A) "Build scoring prompt"  (B) "Build lead doc"
// ─────────────────────────────────────────────────────────────────────────


// ===== (A) "Build scoring prompt" =========================================
// Builds the Anthropic request that scores one candidate against the
// cubework-prospect-finder rubric and drafts the opener.
const c = $json;
const rubric = `You are scoring an importer as a prospect for Cubework's flexible, month-to-month warehouse space in the Inland Empire (Ontario, Fontana, City of Industry), minutes from the Ports of LA/Long Beach. The ideal prospect has real container volume through LA/LB but is NOT so large it already owns its distribution — it feels a flexibility squeeze our model solves.
Score these 7 factors (the LA/LB port gate has already passed):
- volume_trend (0-20): shipments rising = outgrowing space, likely not lease-locked.
- right_size (0-20): mid-size/growth; penalize giants that own DCs and tiny one-shipment importers.
- seasonality (0-15): category that spikes (patio, holiday, fitness, fashion).
- dtc (0-15): sells direct, holds its own inventory.
- bulk (0-10): bulky-relative-to-value goods (furniture, home, sporting).
- recurring (0-10): multiple ongoing shipments.
- timing (0-10): recent funding / expansion / hiring / new US DC.
Tiers: Hot >=70, Warm 45-69, Watch <45. Score conservatively when data is thin.
Return ONLY minified JSON, no prose:
{"volume_trend":n,"right_size":n,"seasonality":n,"dtc":n,"bulk":n,"recurring":n,"timing":n,"total":n,"tier":"Hot|Warm|Watch","why_now":"one sentence","buyer_title":"title to target","email_subject":"...","email_body":"~80 words, value-led, lead with the port-proximity insight, reference this brand specifically, offer to share how others structure it, never use the phrase follow up, sign as Justin"}`;
const candidate = JSON.stringify({
  company:c.company, category:c.category, dest_port:c.dest_port,
  shipments_12m:c.shipments_12m, shipments_total:c.shipments_total,
  supplier_count:c.supplier_count, hq_city:c.hq_city, hq_state:c.hq_state,
  product_desc:c.product_desc
});
const requestBody = {
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 900,
  system: rubric,
  messages: [{ role: 'user', content: 'Candidate import data:\n' + candidate }]
};
return [{ json: { ...c, requestBody } }];


// ===== (B) "Build lead doc" ===============================================
// Parse the model JSON, keep Hot/Warm only, build a Firestore createDocument
// body for the `leads` collection. Score/why-now/draft go into an initial
// thread note (the app already renders thread entries — no UI change needed).
const c = $json;
let parsed = {};
try {
  const txt = (c.content && c.content[0] && c.content[0].text) || c.text || '{}';
  parsed = JSON.parse(txt.trim().replace(/^```json/i,'').replace(/```$/,'').trim());
} catch (e) { return []; }                 // unparseable -> skip
const tier = parsed.tier || 'Watch';
if (tier === 'Watch') return [];           // only surface Hot/Warm

const company = $('Loop candidates').item.json.company;
const slug = 'iy-' + company.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
const now = new Date().toISOString();

const noteText =
  '[Auto-prospected · ImportYeti] ' + tier + ' · score ' + (parsed.total != null ? parsed.total : '?') + '/100\n' +
  'Why now: ' + (parsed.why_now || '-') + '\n' +
  'Target buyer: ' + (parsed.buyer_title || '-') + '\n\n' +
  'Draft opener\nSubject: ' + (parsed.email_subject || '') + '\n' + (parsed.email_body || '');

const entry = { mapValue: { fields: {
  kind: { stringValue: 'note' },
  text: { stringValue: noteText },
  ts:   { stringValue: now }
}}};

const fields = {
  company:            { stringValue: company },
  segment:            { stringValue: 'Importer — ' + (c.category || '') },
  is_importer:        { booleanValue: true },
  stage:              { stringValue: 'cold' },
  prospect_source:    { stringValue: 'ImportYeti' },
  prospect_tier:      { stringValue: tier },
  prospect_score:     { integerValue: String(parsed.total != null ? parsed.total : 0) },
  prospect_dest_port: { stringValue: c.dest_port || '' },
  entries:            { arrayValue: { values: [ entry ] } },
  createdAt:          { timestampValue: now }
};
return [{ json: { slug, fsBody: { fields } } }];
