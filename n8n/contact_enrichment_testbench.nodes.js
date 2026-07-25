// ─────────────────────────────────────────────────────────────────────────
// Paste-ready Code-node JS for n8n workflow 27 (CW — 27. Contact Enrichment
// Test Bench — PDL). Three Code nodes; copy each block into the matching
// node's "JavaScript Code". (Like the other .nodes.js files in this folder,
// this file does NOT parse as a single script — the blocks are meant to be
// copied individually, not run together.)
//
// WHY THIS EXISTS (added 2026-07-23): the CoreClaw-sourced contacts on the
// 📍 Nearby Prospects tab (`contact_name`/`contact_title`/`contact_email`/
// `contact_linkedin`, from the Google Maps Scraper's leads-enrichment) are
// low quality — mostly a LinkedIn profile with no verified email, which
// defeats the entire point of contact enrichment. Justin's call: stop trying
// to fix the LinkedIn-sourced contact and use a SEPARATE tool for contacts,
// the same split CoreClaw already has (CoreClaw finds the BUSINESSES,
// something else finds the PEOPLE) — explicitly modeled on how the old
// Apollo pipeline (wf12) searched a company for people and filtered by
// title/seniority depending on company size, since Apollo/ZoomInfo are both
// off the table (Apollo's sub is cancelled; see the outreach/{id} notes in
// CLAUDE.md).
//
// First candidate: People Data Labs (PDL). Verified directly against PDL's
// real docs (docs.peopledatalabs.com, fetched 2026-07-23) before writing any
// of this — same "never build against a guessed schema" discipline this
// project applied to CoreClaw (see the 2026-07-21 site_outreach_discovery
// verification session). Confirmed: Person Search endpoint/auth/query DSL,
// Company Enrichment endpoint/params, the job_title_levels canonical values
// (cxo/director/entry/manager/owner/partner/senior/training/unpaid/vp), and
// the job_company_size canonical buckets (1-10/11-50/51-200/201-500/
// 501-1000/1001-5000/5001-10000/10001+). NOT yet verified: an actual live
// PDL account/API key — Justin hasn't signed up yet, so this workflow has
// never actually been run against the real API. That's the whole point of
// calling it a "test bench" rather than wiring it straight into workflow
// 25/26 — it's a disposable sandbox to see real hit rate/email quality on
// real Ontario Airport businesses before committing to anything.
//
// FIX (2026-07-23, cont. #3): the first real test run (6 Ontario Airport
// businesses, including an 18,691-employee company) came back with ZERO
// person-search candidates on every single call. Root cause, confirmed via
// the real n8n execution log: PDL's Person Search rejected the query with
// a 400 -- "Query clause [minimum_should_match] not allowed or invalid
// field name." PDL's query validator only accepts a restricted subset of
// Elasticsearch DSL, and minimum_should_match isn't in that allowed set.
// Fix: dropped minimum_should_match entirely. Standard Elasticsearch bool-
// query semantics already give the intended behavior for free -- when a
// `must` clause is present (the job_company_website term match, which this
// query always has), `should` clauses are automatically optional/boost-only
// with no minimum required, so removing the disallowed key doesn't change
// the intended "prefer these titles but don't hard-require them" behavior
// at all, it just removes the parameter PDL was rejecting.
//
// THIS WORKFLOW WRITES NOTHING TO FIRESTORE. It's a pure request/response
// test rig — POST a business in, get PDL's raw findings back in the webhook
// response. It does not touch site_outreach, does not call workflow 20, and
// is not wired into workflows 25/26 in any way. Promote logic from here into
// the real pipeline only after Justin has actually reviewed real results.
//
// TWO-STEP DESIGN (mirrors the old Apollo two-step: find the org, then find
// the right person at it):
//   1. PDL Company Enrichment (by website) — cheap, returns job_company_size
//      bucket directly (see docs.peopledatalabs.com/docs/company-sizes).
//   2. Derive a job_title_levels target list from that size bucket (small
//      shop → owner/manager; mid → manager/director; large → director/vp) —
//      this is the literal "filters for positions depending on the size of
//      the company" behavior Justin asked to replicate.
//   3. PDL Person Search, filtered to that company (term match on
//      job_company_website) with the title-tier list as a `should` boost
//      (not a hard `must` — a hard filter risks zero results on small/thin
//      SoCal businesses, which is exactly where CoreClaw's own contact data
//      was already weakest), AND `dataset: 'email'` — this biases/restricts
//      the search toward PDL records that actually carry an email data
//      point, directly targeting Justin's real complaint (LinkedIn-only,
//      no email) rather than just hoping for the best.
//
// COST NOTE: Person Search bills per record RETURNED (not per query), so
// `size` is capped at 3 here to bound cost per test call — see
// docs.peopledatalabs.com/docs/reference-person-search-api ("Heads Up!
// Credit Usage"). Company Enrichment is a flat 1 credit per successful
// match (Enterprise-only `size` param not used here).
//
// SEARCH-THEN-REVEAL DESIGN (added 2026-07-23, cont. #4): the first real
// test run (post the minimum_should_match fix above) DID return real
// candidates — but every contact field (work_email, mobile_phone,
// phone_numbers) came back as a literal boolean `true` ("yes, this exists")
// rather than the actual value. Confirmed against PDL's real docs, not
// guessed: the Person Search API's `data[]` items each carry a real,
// reusable `id` (docs.peopledatalabs.com/docs/output-response-person-
// search-api), and that same id is exactly what the separate Person
// Enrichment API's `pdl_id` parameter expects (docs.peopledatalabs.com/docs/
// input-parameters-person-enrichment-api) to do a one-to-one match and
// return the full, unmasked record — billed per successful match (~$0.40-
// 0.55, same fee flagged in the pricing research earlier this session).
// Justin's explicit call: this two-step shape is a FEATURE, not a bug — he
// wants the same control Apollo's old search-then-reveal flow gave (wf12's
// People Search + wf16a's Phone Reveal): see every masked candidate for
// free from Person Search, then only pay the separate reveal cost for the
// ONE candidate he actually wants to contact, instead of PDL silently
// billing every returned search candidate for a full reveal. Added a 4th
// node pair for this: "Check reveal mode" (IF on whether the request body
// carries a `reveal_id`) branches BEFORE the search chain into either the
// existing search flow, or straight to "PDL: Reveal contact" (GET /v5/
// person/enrich?pdl_id=<id>) → "Build reveal response" (unmasks the real
// email/phone). Both branches converge back on the same "Respond" node.
// Search candidates in "Build test response" now also carry their real
// `id` field so Justin can copy it straight into a follow-up {reveal_id}
// call. See the workflow's own `how_to_reveal` hint in the search response.
// ─────────────────────────────────────────────────────────────────────────

// ===== NODE "Parse test input" (right after the "Test webhook" trigger) ====
// Test-bench input: {name, website, city, state, category} to search, OR
// {reveal_id} to reveal one specific candidate's full contact info (email,
// phone) that a prior search call returned masked. This is a pure sandbox
// rig — nothing here is written to Firestore, and it's not wired into the
// real site_outreach discovery/research pipeline (workflows 25/26). It
// exists to let Justin try real Ontario Airport (or any) businesses against
// People Data Labs before deciding whether PDL's hit rate/email quality is
// good enough to wire into the real pipeline as a CoreClaw contact-
// enrichment replacement.
const b = $json.body || $json || {};
const name = (b.name || '').trim();
let website = (b.website || '').trim();
// Strip protocol/www/path down to a bare registrable domain, same
// normalization CoreClaw-facing code in this project already does for
// website fields (see openNPModal's website link handling in index.html).
let domain = '';
if (website) {
  domain = website.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].trim();
}
const revealId = (b.reveal_id || '').trim();
if (!revealId && !name && !domain) {
  throw new Error('Test input needs at least a name or a website/domain to search on (or a reveal_id from a prior search result to reveal that one candidate).');
}
return [{ json: {
  name, domain,
  city: (b.city || '').trim(),
  state: (b.state || '').trim(),
  category: (b.category || '').trim(),
  reveal_id: revealId
} }];


// ===== NODE "Check reveal mode" (IF node, fed from "Parse test input") =====
// n8n IF (v2) node -- not Code, but documented here for completeness. True
// branch (reveal_id notEmpty) -> "PDL: Reveal contact". False branch (the
// existing default) -> "PDL: Company size lookup" (the search chain).
// Condition: {{ $json.reveal_id }} operator "notEmpty".


// ===== NODE "Build reveal response" (fed from "PDL: Reveal contact" HTTP node) ====
// Shapes the reveal-mode response -- one specific candidate's full,
// unmasked contact info (real email/phone, not the boolean presence flags
// Person Search returns). Nothing written to Firestore, same as every other
// node in this test bench.
const resp = $json || {};
const person = (resp && resp.status === 200) ? (resp.data || resp) : null;
function pickEmail(r) {
  if (!r) return null;
  if (r.work_email) return r.work_email;
  const emails = Array.isArray(r.emails) ? r.emails : [];
  const withAddr = emails.find(e => e && e.address);
  return withAddr ? withAddr.address : (r.recommended_personal_email || null);
}
function pickPhone(r) {
  if (!r) return null;
  if (r.mobile_phone) return r.mobile_phone;
  const phones = Array.isArray(r.phone_numbers) ? r.phone_numbers : [];
  return phones.length ? phones[0] : null;
}
return [{ json: {
  provider: 'pdl',
  mode: 'reveal',
  found: !!person,
  likelihood: (typeof resp.likelihood === 'number') ? resp.likelihood : null,
  full_name: person ? (person.full_name || null) : null,
  job_title: person ? (person.job_title || null) : null,
  email: pickEmail(person),
  phone: pickPhone(person),
  linkedin_url: person ? (person.linkedin_url || null) : null,
  job_last_verified: person ? (person.job_last_verified || null) : null,
  note: person ? undefined : 'No match found for this reveal_id -- double check it was copied from a real candidate\'s "id" field in a prior search response.'
} }];


// ===== NODE "Pick title tier" (fed from the "PDL: Company size lookup" HTTP node) ====
// Derive a job_title_levels target list from the company's PDL size bucket —
// this is the "filters for positions depending on the size of the company"
// behavior Justin asked to replicate from the old Apollo pipeline (wf12).
// PDL's canonical size buckets: 1-10, 11-50, 51-200, 201-500, 501-1000,
// 1001-5000, 5001-10000, 10001+ (see docs.peopledatalabs.com/docs/company-sizes,
// confirmed 2026-07-23). At a small owner-operated SoCal shop, the real
// decision-maker is often literally titled "Owner" or "General Manager," not
// a formal C-suite — so SMALL includes 'manager', not just 'owner'/'cxo'.
const TIERS = {
  SMALL: ['owner', 'cxo', 'manager', 'partner'],
  MID:   ['manager', 'director', 'cxo'],
  LARGE: ['director', 'vp', 'cxo'],
  // Used when PDL has no company record at all for this website (common for
  // very small/low-web-presence businesses — exactly the segment CoreClaw's
  // LinkedIn-sourced contacts were already weakest on) or size comes back
  // blank. Broad, so the Person Search below still has something to prefer.
  UNKNOWN: ['owner', 'cxo', 'manager', 'director']
};
function sizeToTier(size) {
  if (!size) return 'UNKNOWN';
  if (size === '1-10' || size === '11-50') return 'SMALL';
  if (size === '51-200' || size === '201-500') return 'MID';
  return 'LARGE'; // 501-1000 / 1001-5000 / 5001-10000 / 10001+
}
const resp = $json || {};
// Company Enrichment returns a single object (status 200 + fields at top
// level) on a match, or a non-200 status (e.g. 404) when nothing matched —
// continueOnFail is set on that node, so a miss lands here as an error-ish
// item rather than throwing; handle both shapes defensively.
const company = (resp && resp.status === 200) ? resp : null;
const size = company ? (company.size || null) : null;
const tierName = sizeToTier(size);
return [{ json: {
  ...($('Parse test input').first().json),
  company_found: !!company,
  company_size: size,
  company_employee_count: company ? (company.employee_count || null) : null,
  tier_name: tierName,
  tier_levels: TIERS[tierName]
} }];


// ===== NODE "Build test response" (fed from the "PDL: Person search" HTTP node) ====
// Shapes a compact, side-by-side-comparable test result. Nothing is written
// to Firestore — this is purely for Justin to eyeball in the webhook
// response (or in n8n's execution log) while evaluating PDL.
const ctx = $('Pick title tier').first().json;
const resp = $json || {};
const rows = (resp && Array.isArray(resp.data)) ? resp.data : [];
function pickEmail(r) {
  if (r.work_email) return r.work_email;
  const emails = Array.isArray(r.emails) ? r.emails : [];
  const withAddr = emails.find(e => e && e.address);
  return withAddr ? withAddr.address : (r.recommended_personal_email || null);
}
const candidates = rows.map(r => ({
  id: r.id || null,
  full_name: r.full_name || null,
  job_title: r.job_title || null,
  job_title_levels: r.job_title_levels || [],
  email: pickEmail(r),
  has_email: !!pickEmail(r),
  mobile_phone: r.mobile_phone || null,
  phone_numbers: r.phone_numbers || [],
  linkedin_url: r.linkedin_url || null,
  job_last_verified: r.job_last_verified || null,
  num_sources: r.num_sources || null
}));
return [{ json: {
  provider: 'pdl',
  tested_business: { name: ctx.name, domain: ctx.domain, city: ctx.city, state: ctx.state, category: ctx.category },
  company_lookup: { found: ctx.company_found, size: ctx.company_size, employee_count: ctx.company_employee_count },
  title_tier_used: ctx.tier_name,
  title_levels_searched: ctx.tier_levels,
  total_matches_in_pdl: (resp && typeof resp.total === 'number') ? resp.total : null,
  candidates_returned: candidates.length,
  candidates,
  how_to_reveal: candidates.length > 0 ? 'Search results are masked (has_email/mobile_phone show presence only, not the real value) -- pick ONE candidate\'s "id" and POST {reveal_id: "<that id>"} to this same webhook to reveal just that person\'s real email/phone. This is deliberate, same as Apollo\'s old search-then-reveal flow: you only pay the separate per-match reveal cost for the person you actually want.' : undefined,
  note: candidates.length === 0
    ? 'No person records matched — either PDL has no coverage for this business, or the job_company_website term filter did not match (double-check the domain PDL has on file vs. the website you tested with).'
    : (candidates.every(c => !c.has_email) ? 'Matches found but none carried a usable email in this response — consider whether the dataset=email param is actually narrowing results as intended.' : undefined)
} }];
