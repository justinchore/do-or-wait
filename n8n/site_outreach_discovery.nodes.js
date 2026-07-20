// Paste-ready Code-node JS for n8n workflow 25 (Site Outreach Discovery, CoreClaw).
// Companion to 25_site_outreach_discovery.json — copy each block into the
// matching node's "JavaScript Code" field.
//
// ⚠ UNVERIFIED FIELD NAMES. This whole workflow was built from CoreClaw's
// (coreclaw.com) prose documentation, fetched live in June 2026 — no CoreClaw
// account existed at build time, so none of this was checked against a real
// /api/scraper schema response or a real result record (the same rigor the
// Rate Bands/Roster parsers got via a real usedRange() fixture before shipping
// was NOT possible here). Every place a field name is a best guess is called
// out below with "UNVERIFIED" — check these against the real n8n execution
// log the first time this workflow actually runs, and hardcode the corrected
// names once confirmed.
// ─────────────────────────────────────────────────────────────────────────

// ===== NODE "Parse request" ================================================
// Body: { propId, address, categories? }. propId/address are required — this
// workflow is per-site, never a bulk-all-locations sweep. categories is an
// optional override array; default to the 9-item v1 list when omitted.
// Also derives a CoreClaw "base_location" ("City, ST, USA") from the raw
// address string via a regex on the City, ST ZIP tail — the app sends the
// full address, this node does the extraction, not the app.
const b = $json.body || {};
const propId = b.propId || '';
const address = b.address || '';
if (!propId) throw new Error('Missing body.propId');
if (!address) throw new Error('Missing body.address');

const DEFAULT_CATEGORIES = [
  'importer', 'distribution company', 'wholesale distributor', '3PL logistics company',
  'freight forwarder', 'ecommerce fulfillment center', 'trucking company', 'manufacturer',
  'moving and storage company'
];
const categories = (Array.isArray(b.categories) && b.categories.length) ? b.categories : DEFAULT_CATEGORIES;

// "3950 E Airport Dr, Ontario, CA 91761" -> "Ontario, CA, USA"
const m = address.match(/,\s*([^,]+),\s*([A-Z]{2})\s*\d{5}/);
const base_location = m ? `${m[1].trim()}, ${m[2].trim()}, USA` : address; // fallback: pass the raw address through rather than fail the whole run

return [{ json: { propId, address, base_location, categories } }];


// ===== NODE "Match schema fields" ==========================================
// UNVERIFIED against a real response. Golden rule from CoreClaw's own docs:
// never hardcode a Worker's parameter names/version — read data.version and
// data.parameters.custom.properties (array of {name,type,title,required,
// default?}) and match candidate fields by substring rather than assuming
// exact keys like keyword/base_location/business_leads_enrichment (those are
// a best guess from the prose docs, not confirmed JSON keys).
const schema = $json.data || {};
const version = schema.version;
const props = (schema.parameters && schema.parameters.custom && schema.parameters.custom.properties) || [];

function findProp(substrings) {
  const hit = props.find(p => substrings.some(s => String(p.name||'').toLowerCase().includes(s) || String(p.title||'').toLowerCase().includes(s)));
  return hit ? hit.name : null;
}
const keywordProp  = findProp(['keyword', 'query', 'search_term', 'search term', 'term']);
const locationProp = findProp(['base_location', 'location', 'city', 'area']);
const enrichProp   = findProp(['business_leads_enrichment', 'leads_enrichment', 'enrichment', 'business leads']);

const warnings = [];
if (!keywordProp)  warnings.push('Could not confidently match a keyword/search-term parameter — check data.parameters.custom.properties in this node\'s input and hardcode the real name.');
if (!locationProp) warnings.push('Could not confidently match a base_location/location parameter — same fix as above.');
if (!enrichProp)   warnings.push('Could not confidently match the business-leads-enrichment toggle parameter — enrichment (named contact/email/phone/LinkedIn) may silently not be requested. Check the schema and hardcode the real name.');
if (warnings.length) console.warn('[Site Outreach Discovery] Parameter match warnings:', warnings.join(' | '));

const req = $('Parse request').first().json;
// Build the default "system" params object as-is from the schema's own defaults
// (untouched — this workflow only overrides the 3 fields it actually needs).
const systemDefaults = {};
((schema.parameters && schema.parameters.system && schema.parameters.system.properties) || []).forEach(p => {
  if (p.default !== undefined) systemDefaults[p.name] = p.default;
});

return [{ json: {
  ...req,
  scraper_version: version,
  keywordProp, locationProp, enrichProp, systemDefaults,
  warnings,
  categoryIndex: 0
} }];


// ===== NODE "Reset accumulator + fan out categories" =======================
// Reset the cross-category accumulator on static data so a fresh webhook call
// never inherits leftovers from a prior errored run (same pattern as workflow
// 18's tab-loop accumulator). One item per category, fed into the batch loop.
const ws = $getWorkflowStaticData('global');
ws.rows = [];
const ctx = $json;
return (ctx.categories || []).map(cat => ({ json: { ...ctx, category: cat } }));


// ===== NODE "Build custom params" ==========================================
// Build input.parameters.custom from the LIVE schema field names matched
// earlier — never hardcode. Falls back to the best-guess key (keyword /
// base_location / business_leads_enrichment) ONLY if the earlier substring
// match failed to find anything at all, so a run still attempts something
// useful rather than hard-failing — but the earlier warning already flagged
// this case for a human to go fix.
const j = $json;
const custom = {};
custom[j.keywordProp || 'keyword'] = j.category;
custom[j.locationProp || 'base_location'] = j.base_location;
custom[j.enrichProp || 'business_leads_enrichment'] = true;

const input = { parameters: { system: j.systemDefaults || {}, custom } };
return [{ json: { ...j, coreclawInput: input } }];


// ===== NODE "Extract run_slug" =============================================
// Non-zero `code` in the JSON body means failure even on HTTP 200 (per
// CoreClaw docs) — check explicitly, don't just trust the HTTP status.
const prev = $('Build custom params').first().json;
const res = $json;
if (res.error || (res.code && res.code !== 0)) {
  console.warn('[Site Outreach Discovery] Run failed for category', prev.category, JSON.stringify(res).slice(0,300));
  return [{ json: { ...prev, runFailed: true, run_slug: null } }];
}
const run_slug = (res.data && res.data.run_slug) || null;
return [{ json: { ...prev, runFailed: !run_slug, run_slug, pollAttempts: 0 } }];


// ===== NODE "Check poll status" ============================================
// status: 1 Ready, 2 Running, 3 Succeeded, 4 Failed, 5 Aborting. Capped poll
// loop — 20 attempts x 15s = 5min max per category (same capped-deadline
// convention as the Avail Export feature), then treat as a soft failure for
// THIS category only and move to the next one, not a hard workflow failure.
const prev = $('Extract run_slug').first().json;
const res = $json;
const status = res && res.data ? res.data.status : null;
const attempts = (prev.pollAttempts || 0) + 1;
const CAP = 20;
const done = status === 3 || status === 4 || attempts >= CAP;
return [{ json: { ...prev, pollAttempts: attempts, runStatus: status, pollDone: done, runFailed: (status === 4) || (attempts >= CAP && status !== 3) } }];


// ===== NODE "Prep result paging" ===========================================
// Paginated results. Page size 100; loop pages if the response signals more
// (UNVERIFIED pagination field names — check the real response shape on
// first run and fix has_more/total/page_index if they differ). page_index
// tracked on the item so repeated calls advance.
const prev = $json;
if (prev.runFailed) return [{ json: { ...prev, resultsDone: true, pageIndex: 0 } }];
return [{ json: { ...prev, pageIndex: prev.pageIndex || 0 } }];


// ===== NODE "Tag + accumulate results" =====================================
// Tags each result row with the search_category that surfaced it, extracts
// the fields we care about (base record shape confirmed from CoreClaw docs;
// leads-enrichment lead_* keys are UNVERIFIED — see header above), and appends
// to the shared static-data accumulator. Also decides whether another page
// needs fetching (UNVERIFIED pagination field names, see previous node).
const prev = $('Prep result paging').first().json;
const res = $json;
const rowsIn = (res && res.data && Array.isArray(res.data)) ? res.data
            : (res && Array.isArray(res.data && res.data.items)) ? res.data.items
            : [];
const ws = $getWorkflowStaticData('global');
ws.rows = ws.rows || [];

function pick(row, keys) { for (const k of keys) { if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k]; } return null; }

for (const row of rowsIn) {
  ws.rows.push({
    place_cid: row.cid || row.data_id || null,
    name: row.title || row.name || '',
    address: row.address || '',
    city: row.city || '',
    state: row.state || '',
    website: row.website || '',
    phone: row.phone || '',
    search_category: prev.category,
    google_category: row.primary_category || '',
    all_categories: row.all_categories || null,
    latitude: row.latitude != null ? row.latitude : null,
    longitude: row.longitude != null ? row.longitude : null,
    rating: row.review_rating != null ? row.review_rating : null,
    review_count: row.review_count != null ? row.review_count : null,
    // Leads-enrichment fields — key names are a best guess (lead_name /
    // lead_title / lead_email / lead_linkedin_url), UNVERIFIED. Check a real
    // enriched result record and fix these picks on first run.
    contact_name: pick(row, ['lead_name', 'contact_name', 'person_name']),
    contact_title: pick(row, ['lead_title', 'contact_title', 'job_title']),
    contact_email: pick(row, ['lead_email', 'contact_email', 'email']),
    contact_linkedin: pick(row, ['lead_linkedin_url', 'lead_linkedin', 'contact_linkedin', 'linkedin_url'])
  });
}

// UNVERIFIED: guess at a has_more/total signal; if absent, assume one page
// was enough (page_size 100 comfortably covers typical category volume) and
// stop rather than loop forever.
const hasMore = !!(res && res.data && (res.data.has_more === true || (typeof res.data.total === 'number' && (prev.pageIndex+1)*100 < res.data.total)));
return [{ json: { ...prev, resultsDone: !hasMore, pageIndex: (prev.pageIndex||0) + 1, resultCount: rowsIn.length } }];


// ===== NODE "Dedupe accumulated rows" ======================================
// Dedupe the FULL cross-category accumulator by cid (falling back to
// data_id — same key chosen as the Firestore doc id) — first occurrence
// wins for search_category, matching the design spec ("first-wins is fine").
// Runs once, after the category loop's "done" output fires.
const ws = $getWorkflowStaticData('global');
const rows = ws.rows || [];
const byId = new Map();
for (const r of rows) {
  const id = r.place_cid;
  if (!id) continue; // no stable id to dedupe/write on — skip (can't safely key a Firestore doc)
  if (!byId.has(id)) byId.set(id, r);
}
const deduped = [...byId.values()];
ws.rows = []; // clear for the next run
return [{ json: { propId: $('Parse request').first().json.propId, categories: $('Parse request').first().json.categories, rows: deduped } }];


// ===== NODE "Build write payload" ===========================================
// Build the workflow-20 (generic Firestore writer) bulk_update payload.
// bulk_update does a Firestore `update` write WITH an updateMask containing
// ONLY the keys in `fields` — confirmed by reading n8n/20_firestore_writer.json
// ("Build batchWrite" node): buildWrite(..., partial=true) sets
// `updateMask.fieldPaths = Object.keys(fields)`. Firestore's update+updateMask
// write type creates the doc if absent (with just those fields) and, for an
// existing doc, touches ONLY the listed field paths — every other existing
// field (status/notes/attempts/archived/cold_draft) is left completely alone.
// So bulk_update is exactly the masked/idempotent write this feature needs —
// NEVER bulk_create, which would stomp the whole doc on a re-run.
// discovered_at is intentionally left OUT of every re-run's fields (only ever
// set once, see below) so it truly reflects first-seen, not last-seen.
const j = $json;
const nowIso = new Date().toISOString();
const items = (j.rows || []).map(r => ({
  id: r.place_cid,
  fields: {
    location: j.propId,
    place_cid: r.place_cid,
    name: r.name,
    address: r.address,
    city: r.city,
    state: r.state,
    website: r.website,
    phone: r.phone,
    search_category: r.search_category,
    google_category: r.google_category,
    all_categories: r.all_categories,
    latitude: r.latitude,
    longitude: r.longitude,
    rating: r.rating,
    review_count: r.review_count,
    contact_name: r.contact_name,
    contact_title: r.contact_title,
    contact_email: r.contact_email,
    contact_linkedin: r.contact_linkedin,
    last_seen_at: nowIso
  }
}));
return [{ json: { propId: j.propId, categoriesRun: (j.categories||[]).length, discovered: items.length, writerBody: { collection: 'site_outreach', action: 'bulk_update', items } } }];


// ===== NODE "Build response" ===============================================
// discovered_at (first-seen only, never overwritten by a re-run) is set here,
// AFTER the masked bulk_update above already landed — a second, separate
// pass with a Firestore query-and-conditionally-set would be needed to set
// it ONLY on brand-new docs without clobbering an existing one, but that's
// unnecessary complexity for v1: instead, the app itself defaults a MISSING
// discovered_at to last_seen_at at read time (same "default missing fields"
// convention already used for status/archived/attempts — see index.html),
// so first-seen is still knowable without a second write pass here.
const build = $('Build write payload').first().json;
const wrote = $json;
return [{ json: { ok: true, propId: build.propId, categoriesRun: build.categoriesRun, discovered: build.discovered, writerResponse: wrote } }];
