// ============================================================================
// Apollo ORG DISCOVERY — reusable, vertical-parameterized (supersedes
// 14_apollo_org_discovery.nodes.js + socal-last-mile.discovery-config.js)
//
// ONE workflow for every vertical. To run a vertical, set VERTICAL below.
// Each vertical is just a PRESETS block — no new workflow, no copy-paste.
//
// Node chain (unchanged from wf14):
//   Manual Trigger
//     -> [Code] Org-search config        (this file, part 1)
//     -> [HTTP] Apollo Org Search        (POST mixed_companies/search; Apollo cred)
//     -> [Code] Filter + score           (this file, part 2)
//     -> hand off to wf12 loop  OR  [Code] Build wf12 input (part 3)
//
// Apollo org search filters HQ by city/state only (no zip param), so each
// preset casts wide on location + keywords, then we narrow by ZIP in code.
// Docs: https://docs.apollo.io/reference/organization-search
// ============================================================================


// ===== Code node: "Org-search config" ======================================
const VERTICAL = "lastmile";   // <-- the only switch. "lastmile" | "fashion_district" | (add more)

const PRESETS = {
  // ---- ACTIVE: SoCal last-mile (all carrier types, all SoCal, IE first) ----
  lastmile: {
    locations: ["California"],                 // broad; SoCal narrowing happens in the filter
    keyword_tags: ["last mile delivery","final mile","courier","parcel delivery",
      "package delivery","same day delivery","delivery service","logistics",
      "transportation","freight"],
    employee_ranges: ["1,10","11,20","21,50","51,100","101,200","201,500","501,1000"],
    pages: 8,
    geo_zip3: ["900","901","902","903","904","905","906","907","908","910","911",
      "912","913","914","915","916","917","918","919","920","921","922","923","924",
      "925","926","927","928","930","931","932","933","934","935"],   // SoCal prefixes
    priority_cities: ["ontario","fontana","city of industry","rancho cucamonga",
      "riverside","san bernardino","jurupa valley","bloomington","rialto","colton",
      "moreno valley","perris","redlands","chino","mira loma","eastvale"],  // IE first
    fit_keywords: ["last mile","final mile","courier","parcel","delivery","dispatch","express"],
    industry_label: "Last-Mile / Courier (SoCal)",
    name_flag: null
  },

  // ---- reference: Korean Fashion District (kept so the pattern is obvious) ----
  fashion_district: {
    locations: ["Los Angeles, California"],
    keyword_tags: ["apparel","wholesale apparel","women's clothing","fashion",
      "textiles","clothing manufacturer","importer"],
    employee_ranges: ["1,10","11,20","21,50","51,100","101,200"],
    pages: 5,
    geo_zip5: ["90014","90015","90021","90013","90079","90017"],   // exact district zips
    priority_cities: [],
    fit_keywords: [],
    industry_label: "Apparel/Textile (Fashion District)",
    name_flag: "korean"
  }
};

const P = PRESETS[VERTICAL];
const out = [];
for (let p = 1; p <= P.pages; p++) {
  out.push({ json: {
    _vertical: VERTICAL,
    body: {
      organization_locations: P.locations,
      q_organization_keyword_tags: P.keyword_tags,
      organization_num_employees_ranges: P.employee_ranges,
      page: p,
      per_page: 100
    }
  }});
}
return out;
// HTTP node "Apollo Org Search": POST https://api.apollo.io/api/v1/mixed_companies/search
//   Auth: the Apollo X-Api-Key credential.  Body (JSON, expression): ={{ $json.body }}
//   Continue On Fail ON, Retry On Fail ON. Org search consumes credits.
//   Start with pages:1 (set in the preset) to sanity-check before scaling.


// ===== Code node: "Filter + score" ==========================================
// n8n Code nodes don't share scope, so this node is SELF-CONTAINED: it reads
// which vertical ran from the config node, and carries its own filter presets.
// (Only the filter-relevant fields are needed here — geo + ranking inputs.)
const VERTICAL2 = $('Org-search config').first().json._vertical;

const FILTER_PRESETS = {
  lastmile: {
    geo_zip3: ["900","901","902","903","904","905","906","907","908","910","911",
      "912","913","914","915","916","917","918","919","920","921","922","923","924",
      "925","926","927","928","930","931","932","933","934","935"],
    priority_cities: ["ontario","fontana","city of industry","rancho cucamonga",
      "riverside","san bernardino","jurupa valley","bloomington","rialto","colton",
      "moreno valley","perris","redlands","chino","mira loma","eastvale"],
    fit_keywords: ["last mile","final mile","courier","parcel","delivery","dispatch","express"],
    industry_label: "Last-Mile / Courier (SoCal)",
    name_flag: null
  },
  fashion_district: {
    geo_zip5: ["90014","90015","90021","90013","90079","90017"],
    priority_cities: [],
    fit_keywords: [],
    industry_label: "Apparel/Textile (Fashion District)",
    name_flag: "korean"
  }
};
const P2 = FILTER_PRESETS[VERTICAL2];

const KOREAN_SURNAMES = new Set(["kim","lee","park","choi","cho","jung","jeong","kang",
  "yoon","yun","jang","lim","im","han","oh","seo","suh","shin","kwon","hwang","ahn","an",
  "song","yang","bae","baek","nam","noh","roh","ha","koo","ku","min","moon","yu","yoo",
  "ryu","chung","jeon","jun","ko","go","sung","seong","hong","jin","cha","chu","joo","ju"]);

function inGeo(org, P2) {
  const zip5 = String(org.postal_code || "").slice(0, 5);
  if (P2.geo_zip5) return P2.geo_zip5.includes(zip5);
  if (P2.geo_zip3) return P2.geo_zip3.includes(zip5.slice(0, 3));
  return true;
}
function score(org, P2) {
  const city = (org.city || "").toLowerCase();
  const blob = ((org.name || "") + " " + (org.industry || "")).toLowerCase();
  const priority = (P2.priority_cities || []).some(c => city.includes(c));   // e.g. IE
  const fit = (P2.fit_keywords || []).some(k => blob.includes(k));
  let nameFlag = false, nameSignal = "";
  if (P2.name_flag === "korean") {
    for (const w of (org.name || "").toLowerCase().split(/[^a-z]+/))
      if (KOREAN_SURNAMES.has(w)) { nameFlag = true; nameSignal = "surname:" + w; }
  }
  return { priority, fit, nameFlag, nameSignal };
}

const seen = new Set();
const result = [];
for (const item of items) {
  const j = item.json || {};
  const orgs = [].concat(j.organizations || [], j.accounts || []);
  for (const org of orgs) {
    if (!inGeo(org, P2)) continue;
    const domain = (org.primary_domain || org.website_url || "")
      .replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").toLowerCase();
    if (!domain || seen.has(domain)) continue;
    seen.add(domain);
    const s = score(org, P2);
    result.push({ json: {
      c: org.name, d: domain, city: org.city || "", st: "CA",
      t: org.estimated_num_employees || 0, ind: P2.industry_label,
      zip: String(org.postal_code || "").slice(0, 5),
      address: org.street_address || org.raw_address || "",
      employees: org.estimated_num_employees || null,
      org_id: org.id || null,
      prospect_source: "apollo_org_discovery_" + VERTICAL2,
      priority: s.priority, fit: s.fit,
      name_flag: s.nameFlag, name_signal: s.nameSignal
    }});
  }
}
// Rank: priority (e.g. IE / Korean-likely) first, then fit.
result.sort((a, b) => (b.json.priority - a.json.priority) || (b.json.fit - a.json.fit));
return result;


// ===== Code node (optional): "Build wf12 input" =============================
const rows = items.map(i => i.json).filter(r => r.d);
const arr = rows.map(r =>
  `  {c:${JSON.stringify(r.c)},d:${JSON.stringify(r.d)},city:${JSON.stringify(r.city)},st:'CA',t:${r.t||0},ind:${JSON.stringify(r.ind)}},`
).join("\n");
return [{ json: { count: rows.length, paste: "const companies = [\n" + arr + "\n];" } }];
