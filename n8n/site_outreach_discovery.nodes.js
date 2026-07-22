// Paste-ready Code-node JS for n8n workflow 25 (Site Outreach Discovery, CoreClaw).
// Companion to 25_site_outreach_discovery.json — copy each block into the
// matching node's "JavaScript Code" field.
//
// ✅ VERIFIED 2026-07-21 against Justin's real CoreClaw account — see
// CLAUDE.md's 2026-07-21 (cont.) session for the full test log. Every field
// name below was confirmed by a real /api/scraper schema pull plus two real
// scraper runs (one with an empty leads_enrichment result, one with populated
// contacts), not guessed from prose docs. Real bugs this found and fixed vs.
// the original build: `keywords` (plural, array of {keyword} objects — not a
// string), `max_results` (REQUIRED by the Worker, was missing entirely
// before), `max_leads_per_place` (an integer count, not a boolean toggle —
// "business leads enrichment" has no dedicated on/off flag), the Get Results
// Page response shape (rows live at `data.list`, not `data` or `data.items`),
// no `cid` field exists at all (real identifiers are `place_id`/`data_id`),
// coordinates are nested under `location:{lat,lng}` not top-level fields, and
// `leads_enrichment` is an array of contact objects (`full_name`/`job_title`/
// `email`/`linkedin_profile`/`mobile_number`/company_* fields), not flat
// `lead_*` fields on the row. The substring-matching fallback is kept as a
// hedge against CoreClaw renaming a param on a future Worker version, but the
// confirmed exact name is tried first everywhere.
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
// Confirmed real names tried first; substring match is only a hedge against
// a future Worker version renaming a param — see header note above.
const schema = $json.data || {};
const version = schema.version;
const props = (schema.parameters && schema.parameters.custom && schema.parameters.custom.properties) || [];

function findProp(exactName, substrings) {
  if (props.some(p => p.name === exactName)) return exactName;
  const hit = props.find(p => substrings.some(s => String(p.name||'').toLowerCase().includes(s) || String(p.title||'').toLowerCase().includes(s)));
  return hit ? hit.name : null;
}
const keywordProp    = findProp('keywords', ['keyword', 'query', 'search_term', 'search term', 'term']);
const locationProp   = findProp('base_location', ['base_location', 'location', 'city', 'area']);
const maxResultsProp = findProp('max_results', ['max_results', 'number of places', 'results']);
const leadsCountProp = findProp('max_leads_per_place', ['leads_per_place', 'max_leads', 'leads count', 'business leads']);
const seniorityProp  = findProp('leads_seniority', ['seniority']);

const warnings = [];
if (!keywordProp)    warnings.push('Could not match the keywords parameter — check data.parameters.custom.properties and hardcode the real name.');
if (!locationProp)   warnings.push('Could not match the base_location parameter — same fix as above.');
if (!maxResultsProp) warnings.push('Could not match the max_results parameter (REQUIRED by the Worker) — a run will 4000 without it.');
if (!leadsCountProp) warnings.push('Could not match the max_leads_per_place parameter — business leads enrichment (named contact/email/phone/LinkedIn) may silently not be requested.');
if (warnings.length) console.warn('[Site Outreach Discovery] Parameter match warnings:', warnings.join(' | '));

const req = $('Parse request').first().json;
// Build the default "system" params object as-is from the schema's own defaults
// (untouched — this workflow only overrides the 4 fields it actually needs).
const systemDefaults = {};
((schema.parameters && schema.parameters.system && schema.parameters.system.properties) || []).forEach(p => {
  if (p.default !== undefined) systemDefaults[p.name] = p.default;
});

return [{ json: {
  ...req,
  scraper_version: version,
  keywordProp, locationProp, maxResultsProp, leadsCountProp, seniorityProp, systemDefaults,
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
// earlier. keywords is an array of {keyword} objects (confirmed 2026-07-21),
// NOT a plain string. max_results is REQUIRED by the Worker — 20 per category
// keeps a full 9-category property run under ~25 cents at CoreClaw's
// $1.20/1,000-successful-results pricing. max_leads_per_place defaults to 2
// (the real "business leads enrichment" control — no separate boolean).
// leads_seniority biases toward decision-makers (owner/c_suite/vp/director/
// manager) since a random staff contact is less useful for cold outreach than
// someone who can actually say yes — tune or drop this list if it narrows
// results too much for a given category.
const j = $json;
const custom = {};
custom[j.keywordProp || 'keywords'] = [{ keyword: j.category }];
custom[j.locationProp || 'base_location'] = j.base_location;
custom[j.maxResultsProp || 'max_results'] = 20;
custom[j.leadsCountProp || 'max_leads_per_place'] = 2;
if (j.seniorityProp) custom[j.seniorityProp] = ['owner', 'c_suite', 'vp', 'director', 'manager'];

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
// (real pagination fields confirmed 2026-07-21 — see "Tag + accumulate
// results" below, which reads data.count/data.page_size). page_index tracked
// on the item so repeated calls advance.
const prev = $json;
if (prev.runFailed) return [{ json: { ...prev, resultsDone: true, pageIndex: 0 } }];
return [{ json: { ...prev, pageIndex: prev.pageIndex || 0 } }];


// ===== NODE "Tag + accumulate results" =====================================
// Tags each result row with the search_category that surfaced it, extracts
// the fields we care about, and appends to the shared static-data
// accumulator. Response shape + field names confirmed 2026-07-21 against two
// real CoreClaw runs — rows live at data.list (NOT data or data.items as
// originally guessed), and the real total-count field is data.count.
const prev = $('Prep result paging').first().json;
const res = $json;
const rowsIn = (res && res.data && Array.isArray(res.data.list)) ? res.data.list : [];
const totalCount = (res && res.data && typeof res.data.count === 'number') ? res.data.count : null;
const pageSize = (res && res.data && typeof res.data.page_size === 'number') ? res.data.page_size : 100;
const ws = $getWorkflowStaticData('global');
ws.rows = ws.rows || [];

// leads_enrichment is an array of contact objects (full_name/job_title/email/
// linkedin_profile/mobile_number, plus company_* fields) — confirmed
// 2026-07-21 against a real populated result. email is frequently null even
// when a real contact was found (LinkedIn-sourced, not always email-verified)
// — prefer a contact that has an email, else fall back to the first
// available contact so a phone-only lead isn't dropped.
function pickContact(leads) {
  if (!Array.isArray(leads) || !leads.length) return null;
  return leads.find(l => l && l.email) || leads[0];
}

for (const row of rowsIn) {
  const contact = pickContact(row.leads_enrichment);
  ws.rows.push({
    place_cid: row.place_id || row.data_id || null,
    name: row.title || '',
    address: row.address || '',
    city: row.city || '',
    state: row.state || '',
    website: row.website || '',
    phone: row.phone || '',
    search_category: prev.category,
    google_category: row.primary_category || '',
    all_categories: Array.isArray(row.all_categories) ? row.all_categories : (row.all_categories ? [row.all_categories] : null),
    latitude: (row.location && row.location.lat != null) ? row.location.lat : null,
    longitude: (row.location && row.location.lng != null) ? row.location.lng : null,
    rating: row.review_rating != null ? row.review_rating : null,
    review_count: row.review_count != null ? row.review_count : null,
    contact_name: contact ? (contact.full_name || null) : null,
    contact_title: contact ? (contact.job_title || contact.headline || null) : null,
    contact_email: contact ? (contact.email || null) : null,
    contact_linkedin: contact ? (contact.linkedin_profile || null) : null,
    contact_phone: contact ? (contact.mobile_number || null) : null
  });
}

// hasMore now uses the real data.count field (confirmed 2026-07-21) instead
// of the originally guessed has_more/total keys, which don't exist.
const hasMore = totalCount != null && (prev.pageIndex + 1) * pageSize < totalCount;
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
    contact_phone: r.contact_phone,
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
