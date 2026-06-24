// ============================================================================
// Workflow 14 — Apollo ORG DISCOVERY (LA Fashion District apparel/textile)
// Paste-ready Code-node bodies. Bolt this discovery head onto workflow 12's
// existing loop, OR run standalone to produce a company array you paste into
// workflow 12's "CA core-fit input" node.
//
// Node chain (new):
//   Manual Trigger
//     -> [Code] Org-search config        (builds the Apollo search body + pages)
//     -> [HTTP] Apollo Org Search        (POST mixed_companies/search, loop pages)
//     -> [Code] Filter district + score  (zip filter + Korean-likelihood flag)
//     -> (hand off to wf12 loop OR "Build wf12 input" below)
//
// Apollo org search = city/state location only (NO zip filter param), so we
// pull "Los Angeles, California" apparel orgs and POST-FILTER by postal_code in
// code. The org object carries street_address / postal_code / city / state.
// Docs: https://docs.apollo.io/reference/organization-search
// ============================================================================


// ===== Code node: "Org-search config" ======================================
// Emits one item per page so the HTTP node (or a SplitInBatches loop) can page
// through results. Tune PAGES up once you see how many hits come back.
const LOCATIONS = ["Los Angeles, California"];          // HQ-level filter (city/state only)
const KEYWORD_TAGS = [                                   // q_organization_keyword_tags (OR'd)
  "apparel", "wholesale apparel", "women's clothing",
  "fashion", "textiles", "clothing manufacturer", "importer"
];
const EMPLOYEE_RANGES = ["1,10", "11,20", "21,50", "51,100", "101,200"]; // small jobbers
const PER_PAGE = 100;                                    // Apollo max 100/page
const PAGES = 5;                                         // 5 pages = up to 500 orgs/run

const out = [];
for (let p = 1; p <= PAGES; p++) {
  out.push({ json: {
    _page: p,
    body: {
      organization_locations: LOCATIONS,
      q_organization_keyword_tags: KEYWORD_TAGS,
      organization_num_employees_ranges: EMPLOYEE_RANGES,
      page: p,
      per_page: PER_PAGE
    }
  }});
}
return out;
// HTTP node ("Apollo Org Search"): POST https://api.apollo.io/api/v1/mixed_companies/search
//   Auth: the SAME Apollo httpHeaderAuth credential as wf12 (header X-Api-Key, master key)
//   Body (JSON, expression): ={{ $json.body }}
//   Headers: Content-Type: application/json   (X-Api-Key comes from the credential)
//   Settings: "Continue On Fail" ON, "Retry On Fail" ON.
//   NOTE: org search consumes credits. 5 pages x 100 = up to 500 org reads.


// ===== Code node: "Filter district + score" ================================
// Runs AFTER the HTTP node. Keeps only Fashion District ZIPs, dedupes by domain,
// tags each org with a Korean-ownership likelihood (heuristic, NOT a hard gate —
// most Korean jobbers trade under English names, so we keep all in-district
// apparel orgs and just FLAG the likely-Korean ones for Justin + the floor visit).

const DISTRICT_ZIPS = new Set(["90014","90015","90021","90013","90079","90017"]);

// Common Korean romanized surnames (applied to contact last names downstream,
// and to any person/owner token present on the org now).
const KOREAN_SURNAMES = new Set([
  "kim","lee","park","choi","cho","jung","jeong","kang","yoon","yun","jang",
  "lim","im","han","oh","seo","suh","shin","kwon","hwang","ahn","an","song",
  "yang","bae","baek","paek","nam","noh","roh","ha","koo","ku","gu","min",
  "moon","mun","yu","yoo","ryu","chung","jeon","jun","ko","go","sung","seong",
  "hong","jin","cha","chu","joo","ju","do","weon","won","byun","pyun"
]);
// Weak org-name tokens that hint at a Korean shop (low precision; informational).
const KOREAN_NAME_HINTS = ["seoul","korea","hankook","arirang","dongdaemun","kpop","hanbok"];

function scoreKorean(org) {
  const reasons = [];
  const name = (org.name || "").toLowerCase();
  for (const h of KOREAN_NAME_HINTS) if (name.includes(h)) reasons.push("name:" + h);
  // founder/owner-ish fields Apollo sometimes returns; contact surnames added in wf12
  const blob = [org.owner_name, org.primary_contact, org.founder]
    .filter(Boolean).join(" ").toLowerCase();
  for (const w of blob.split(/[^a-z]+/)) if (KOREAN_SURNAMES.has(w)) reasons.push("surname:" + w);
  return reasons;
}

const seen = new Set();
const out = [];
for (const item of items) {
  const j = item.json || {};
  // Apollo returns hits under organizations (and sometimes accounts) — read both.
  const orgs = [].concat(j.organizations || [], j.accounts || []);
  for (const org of orgs) {
    const zip = String(org.postal_code || org.raw_address_postal_code || "").slice(0, 5);
    if (!DISTRICT_ZIPS.has(zip)) continue;               // <-- the real district filter
    const domain = (org.primary_domain || org.website_url || "")
      .replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").toLowerCase();
    if (!domain || seen.has(domain)) continue;
    seen.add(domain);
    const reasons = scoreKorean(org);
    out.push({ json: {
      // ---- shape that wf12's loop already consumes: {c,d,city,st,t,ind} ----
      c: org.name,
      d: domain,
      city: org.city || "Los Angeles",
      st: "CA",   // location filter is LA, California; keep wf12's 2-letter convention
      t: org.estimated_num_employees || 0,               // no TEU here; carry headcount instead
      ind: "Apparel/Textile (Fashion District)",
      // ---- discovery metadata (kept on the prospect doc) ----
      zip,
      address: org.street_address || org.raw_address || "",
      employees: org.estimated_num_employees || null,
      org_id: org.id || null,
      prospect_source: "apollo_org_discovery_fashion_district",
      korean_likely: reasons.length > 0,
      korean_signal: reasons.join(", ")
    }});
  }
}
// Sort likely-Korean first so the highest-fit get reviewed/enriched first.
out.sort((a, b) => (b.json.korean_likely - a.json.korean_likely));
return out;


// ===== (Optional) Code node: "Build wf12 input" ============================
// If you'd rather NOT chain live and just want a paste-ready array for wf12's
// "CA core-fit input" node, run this last and copy the printed array.
const rows = items.map(i => i.json).filter(r => r.d);
const arr = rows.map(r =>
  `  {c:${JSON.stringify(r.c)},d:${JSON.stringify(r.d)},city:${JSON.stringify(r.city)},st:'CA',t:${r.t||0},ind:${JSON.stringify(r.ind)}},`
).join("\n");
return [{ json: { count: rows.length, paste: "const companies = [\n" + arr + "\n];" } }];
