// ============================================================================
// SoCal Last-Mile — discovery config + wf12 input
// Reuses workflow 14 (Apollo Org Discovery). This file holds ONLY the params
// that change for the last-mile vertical, plus a paste-ready wf12 input array
// built from the seed (socal-last-mile-batch4.csv).
//
// Scope decided 2026-06-24: all carrier types ("more the merrier"), all SoCal,
// IE prioritized (Ontario/Fontana/City of Industry). Build the list + run the
// flow to bank contacts; sends held until the current push settles.
// ============================================================================


// ===== Swap into wf14 "Org-search config" =====
// Apollo org search filters HQ by city/state only, so we cast at California +
// last-mile keywords, then post-filter to SoCal (and rank IE first) in code.
const LOCATIONS = ["California"];          // broad; SoCal narrowing happens in the post-filter
const KEYWORD_TAGS = [                       // wide net per "more the merrier"
  "last mile delivery", "final mile", "courier", "parcel delivery",
  "package delivery", "same day delivery", "delivery service",
  "logistics", "transportation", "freight"
];
const EMPLOYEE_RANGES = ["1,10","11,20","21,50","51,100","101,200","201,500","501,1000"];
const PER_PAGE = 100;
const PAGES = 8;   // wider vertical; raise/lower after the first sanity run


// ===== Swap into wf14 "Filter district + score" =====
// SoCal ZIP prefixes (3-digit): LA 900-935, OC 926-928, IE 917-925, SD 919-921.
const SOCAL_ZIP3 = new Set([
  "900","901","902","903","904","905","906","907","908","910","911","912","913",
  "914","915","916","917","918","919","920","921","922","923","924","925","926",
  "927","928","930","931","932","933","934","935"
]);
// Inland Empire cities = priority (your strongest parking sites sit here).
const IE_PRIORITY = ["ontario","fontana","city of industry","rancho cucamonga",
  "riverside","san bernardino","jurupa valley","bloomington","rialto","colton",
  "moreno valley","perris","redlands","chino","mira loma","eastvale"];
// Last-mile fit keywords (for a fit flag; not a hard gate since we went wide).
const LASTMILE_FIT = ["last mile","final mile","courier","parcel","delivery","dispatch","express"];

function classify(org) {
  const zip3 = String(org.postal_code || "").slice(0, 3);
  const inSocal = SOCAL_ZIP3.has(zip3);
  const city = (org.city || "").toLowerCase();
  const iePriority = IE_PRIORITY.some(c => city.includes(c));
  const blob = ((org.name || "") + " " + (org.industry || "")).toLowerCase();
  const lastmileFit = LASTMILE_FIT.some(k => blob.includes(k));
  return { inSocal, iePriority, lastmileFit };
}
// In the loop: keep if classify().inSocal; set ind:"Last-Mile / Courier (SoCal)";
// add fields ie_priority + lastmile_fit; sort IE-priority first, then lastmile_fit.
// Everything else (domain dedupe, mapping to {c,d,city,st,t,ind}) is unchanged.


// ===== Paste-ready wf12 "CA core-fit input" array (from the seed) =====
// Feeds the names straight into the Apollo people-search -> reveal -> draft ->
// Outreach-tab flow. Domains marked "verify" in the CSV should be confirmed
// (or let org-discovery resolve the authoritative domain).
const companies = [
  {c:"OnTrac",d:"ontrac.com",city:"Los Angeles",st:'CA',t:0,ind:"Last-Mile / Courier (SoCal)"},
  {c:"Veho",d:"shipveho.com",city:"Los Angeles",st:'CA',t:0,ind:"Last-Mile / Courier (SoCal)"},
  {c:"Gofo Express",d:"gofoexpress.com",city:"Los Angeles",st:'CA',t:0,ind:"Last-Mile / Courier (SoCal)"},
  {c:"GoBolt",d:"gobolt.com",city:"Los Angeles",st:'CA',t:0,ind:"Last-Mile / Courier (SoCal)"},
  {c:"Best Yet Express",d:"bestyetexpresstrucking.com",city:"Los Angeles",st:'CA',t:0,ind:"Last-Mile / Courier (SoCal)"},
  {c:"GoShare",d:"goshare.co",city:"Torrance",st:'CA',t:0,ind:"Last-Mile / Courier (SoCal)"},
  {c:"SpeedX",d:"speedxpress.com",city:"Los Angeles",st:'CA',t:0,ind:"Last-Mile / Courier (SoCal)"},
  {c:"Dependable Highway Express",d:"godependable.com",city:"Los Angeles",st:'CA',t:0,ind:"Last-Mile / Courier (SoCal)"},
  {c:"AxleHire",d:"axlehire.com",city:"Los Angeles",st:'CA',t:0,ind:"Last-Mile / Courier (SoCal)"},
  {c:"Dropoff",d:"dropoff.com",city:"Los Angeles",st:'CA',t:0,ind:"Last-Mile / Courier (SoCal)"},
  {c:"MedSpeed",d:"medspeed.com",city:"Los Angeles",st:'CA',t:0,ind:"Last-Mile / Courier (SoCal)"},
  {c:"Jet Delivery",d:"jetdelivery.com",city:"Los Angeles",st:'CA',t:0,ind:"Last-Mile / Courier (SoCal)"},
  {c:"Senpex",d:"senpex.com",city:"Los Angeles",st:'CA',t:0,ind:"Last-Mile / Courier (SoCal)"},
  {c:"Curri",d:"curri.com",city:"Los Angeles",st:'CA',t:0,ind:"Last-Mile / Courier (SoCal)"},
  {c:"Today Delivery",d:"todaydeliveryinc.com",city:"Los Angeles",st:'CA',t:0,ind:"Last-Mile / Courier (SoCal)"},
  {c:"Speedster Courier",d:"speedsternow.com",city:"Los Angeles",st:'CA',t:0,ind:"Last-Mile / Courier (SoCal)"},
  {c:"Quik Pick Express",d:"quikpickexpress.com",city:"Santa Fe Springs",st:'CA',t:0,ind:"Last-Mile / Courier (SoCal)"},
  {c:"United Delivery Service",d:"uniteddeliveryservice.com",city:"Los Angeles",st:'CA',t:0,ind:"Last-Mile / Courier (SoCal)"},
  {c:"ProMed Delivery",d:"promeddelivery.net",city:"Los Angeles",st:'CA',t:0,ind:"Last-Mile / Courier (SoCal)"}
];

// ===== Also worth wiring in (not Apollo) =====
// Amazon DSPs are the biggest pool but are small, generically-named LLCs that
// Apollo covers thinly. Source them from the Amazon DSP locator + association
// rosters (e.g., CLDA) as a separate seed when you scale this up.
