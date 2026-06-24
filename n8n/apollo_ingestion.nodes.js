// paste-ready Code node bodies for 12_apollo_ingestion.json

// ===== "CA core-fit input" =====
// BATCH 2 — CA Distributors + Trading Companies (TEU 150-10,000). Batch 1 already ran;
// this input is just the new companies. (Existing docs skip on re-run via ALREADY_EXISTS.)
const TEST_DOMAINS = [];   // PRODUCTION: runs all
const companies = [
  {c:"Sl Home Fashions",d:"slhomefashions.com",city:"Vernon",st:'CA',t:7201,ind:"Distributors"},
  {c:"Ja Solar Usa Inc.",d:"jasolar.com",city:"San Jose",st:'CA',t:6129,ind:"Trading Companies and Distributors"},
  {c:"Southern Wine & Spirits",d:"southernglazers.com",city:"Union City",st:'CA',t:4529,ind:"Distributors"},
  {c:"Harvey Imp.",d:"czechbeer.com",city:"Los Angeles",st:'CA',t:3801,ind:"Distributors"},
  {c:"Supreme Source Inc.",d:"esequip.com",city:"San Ramon",st:'CA',t:3445,ind:"Trading Companies and Distributors"},
  {c:"Katana Racing Inc.",d:"katanawheels.com",city:"Duarte",st:'CA',t:3156,ind:"Distributors"},
  {c:"Uma Enterprises Inc.",d:"umainc.com",city:"Compton",st:'CA',t:3101,ind:"Distributors"},
  {c:"Aisin World Corp. Of America",d:"aisin.com",city:"Torrance",st:'CA',t:2464,ind:"Distributors"},
  {c:"Home Decor Factory Inc.",d:"homedecorfactory.com",city:"Ontario",st:'CA',t:2195,ind:"Distributors"},
  {c:"Sharkninja Operating Llc",d:"jsgl.com",city:"Chino",st:'CA',t:2137,ind:"Distributors"},
  {c:"Us Pet Nutrition Llc",d:"thaiunion.com",city:"San Diego",st:'CA',t:1903,ind:"Distributors"},
  {c:"Jinro America Inc.",d:"jinrousa.com",city:"Los Angeles",st:'CA',t:1900,ind:"Distributors"},
  {c:"Merchsource Llc",d:"thethreesixtygroup.com",city:"Irvine",st:'CA',t:1523,ind:"Distributors"},
  {c:"Tireco Inc.",d:"tireco.com",city:"Gardena",st:'CA',t:1444,ind:"Distributors"},
  {c:"Emser Tile Llc",d:"emser.com",city:"Los Angeles",st:'CA',t:1441,ind:"Trading Companies and Distributors"},
  {c:"Blue Box Opco Llc Dba Infantino",d:"infantino.com",city:"San Diego",st:'CA',t:1254,ind:"Distributors"},
  {c:"Kawasaki Motors Corp.,Usa.",d:"global.kawasaki.com",city:"Irvine",st:'CA',t:1114,ind:"Distributors"},
  {c:"Evolutions Flooring Inc.",d:"bellacerafloors.com",city:"South San Francisco",st:'CA',t:1062,ind:"Distributors"},
  {c:"Japan Pulp And Paper (Usa.) Corp.",d:"kamipa.co.jp",city:"Monterey Park",st:'CA',t:1024,ind:"Trading Companies and Distributors"},
  {c:"Det Logistics (Usa) Corp.",d:"deltathailand.com",city:"Fremont",st:'CA',t:1021,ind:"Distributors"},
  {c:"Dana Innovations",d:"sonance.com",city:"San Clemente",st:'CA',t:959,ind:"Distributors"},
  {c:"Acg Green Group Inc.",d:"jennifertaylorhome.com",city:"Irvine",st:'CA',t:917,ind:"Distributors"},
  {c:"Sk Chemicals America Inc.",d:"skdiscovery.com",city:"Irvine",st:'CA',t:886,ind:"Trading Companies and Distributors"},
  {c:"Torin Inc.",d:"torin-jack.com",city:"Ontario",st:'CA',t:862,ind:"Distributors"},
  {c:"Dongkuk International Inc.",d:"dongkuk.com",city:"Torrance",st:'CA',t:858,ind:"Distributors"},
  {c:"Jc Sales",d:"jcsaleswholesale.com",city:"Los Angeles",st:'CA',t:832,ind:"Distributors"},
  {c:"Mygrant Glass Co.",d:"mygrantglass.com",city:"Hayward",st:'CA',t:820,ind:"Distributors"},
  {c:"Orange Circle Studio",d:"orangecirclestudio.com",city:"Irvine",st:'CA',t:805,ind:"Distributors"},
  {c:"Vineyard Brands",d:"vineyardbrands.com",city:"American Canyon",st:'CA',t:762,ind:"Distributors"},
  {c:"M Chemical",d:"mchemical.com",city:"Los Angeles",st:'CA',t:752,ind:"Trading Companies and Distributors"},
  {c:"Hallmart Collectibles Inc.",d:"hallmartcollectibles.com",city:"North Hollywood",st:'CA',t:728,ind:"Distributors"},
  {c:"D'aquino Italian Imp.",d:"daquino.com",city:"Duarte",st:'CA',t:716,ind:"Distributors"},
  {c:"Primrose Alloys Inc.",d:"primrosealloys.com",city:"Burlingame",st:'CA',t:710,ind:"Trading Companies and Distributors"},
  {c:"Readerlink Marketing Services",d:"readerlink.net",city:"San Diego",st:'CA',t:701,ind:"Distributors"},
  {c:"Jushi Usa Fiberglass Co., Ltd.",d:"jushi.com",city:"Irwindale",st:'CA',t:696,ind:"Trading Companies and Distributors"},
  {c:"Hd Supply Facilities Maintenance",d:"homedepot.com",city:"San Diego",st:'CA',t:677,ind:"Trading Companies and Distributors"},
  {c:"Ya Ya Creations",d:"yayawholesale.com",city:"City of Industry",st:'CA',t:675,ind:"Distributors"},
  {c:"Johnson Premium Hardwood Flooring",d:"johnsonhardwood.com",city:"City of Industry",st:'CA',t:670,ind:"Distributors"},
  {c:"Golden Eagle Usa",d:"verifone.com",city:"Ontario",st:'CA',t:664,ind:"Trading Companies and Distributors"},
  {c:"World Famous Sports",d:"worldfamoussports.com",city:"San Diego",st:'CA',t:656,ind:"Distributors"},
  {c:"Barbaras Development Inc.",d:"directex.net",city:"Commerce",st:'CA',t:652,ind:"Distributors"},
  {c:"Nadeau Corp.",d:"furniturewithasoul.com",city:"Santa Monica",st:'CA',t:652,ind:"Distributors"},
  {c:"West Coast",d:"creamofthecropgardens.com",city:"Pomona",st:'CA',t:645,ind:"Distributors"},
  {c:"Natural Stone Resources",d:"nsrstone.com",city:"Anaheim",st:'CA',t:637,ind:"Trading Companies and Distributors"},
  {c:"Parts Authority",d:"partsauthority.com",city:"Los Angeles",st:'CA',t:626,ind:"Distributors"},
  {c:"Twenty Four 7 Global Solutions",d:"twentyfour7-global.com",city:"Los Angeles",st:'CA',t:607,ind:"Trading Companies and Distributors"},
  {c:"Plascene Inc.",d:"plascene.com",city:"Oxnard",st:'CA',t:590,ind:"Trading Companies and Distributors"},
  {c:"Quintessential Llc",d:"quintessentialwines.com",city:"Napa",st:'CA',t:587,ind:"Distributors"},
  {c:"Lg Display America Inc.",d:"lgdisplay.com",city:"San Jose",st:'CA',t:587,ind:"Distributors"},
  {c:"Uquality Automotive Products Corp.",d:"uquality.com",city:"Cerritos",st:'CA',t:579,ind:"Distributors"},
  {c:"Tdk Corp. Of America",d:"tdk.com",city:"Cypress",st:'CA',t:576,ind:"Distributors"},
  {c:"American Sanitary Supply Inc.",d:"amersan.com",city:"Anaheim",st:'CA',t:576,ind:"Trading Companies and Distributors"},
  {c:"Spicers Paper Inc.",d:"cng-inc.com",city:"Santa Fe Springs",st:'CA',t:575,ind:"Trading Companies and Distributors"},
  {c:"Polaris Electronics Inc.",d:"polaris-usa.com",city:"Pleasanton",st:'CA',t:572,ind:"Trading Companies and Distributors"},
  {c:"American Bolt & Screw Mfg. Corp.",d:"bufab.com",city:"Ontario",st:'CA',t:570,ind:"Trading Companies and Distributors"},
  {c:"Ssf Imported Auto Parts Llc",d:"ssfautoparts.com",city:"South San Francisco",st:'CA',t:567,ind:"Distributors"},
  {c:"Zuo Modern Contemporary Inc.",d:"zuomod.com",city:"San Leandro",st:'CA',t:563,ind:"Distributors"},
  {c:"Kubota Tractor Corp.",d:"kubota.co.jp",city:"Torrance",st:'CA',t:547,ind:"Trading Companies and Distributors"},
  {c:"Alpine Furniture",d:"alpine-furniture.com",city:"Hayward",st:'CA',t:547,ind:"Distributors"},
  {c:"Stone Universe Inc.",d:"suistone.com",city:"San Lorenzo",st:'CA',t:541,ind:"Trading Companies and Distributors"},
  {c:"Cosmo Products Llc",d:"cosmoappliances.com",city:"Monterey Park",st:'CA',t:532,ind:"Trading Companies and Distributors"},
  {c:"Clay Street Imp.",d:"ielp.com",city:"Pico Rivera",st:'CA',t:530,ind:"Distributors"},
  {c:"Evaki Inc.",d:"evakiimports.com",city:"San Luis Obispo",st:'CA',t:500,ind:"Distributors"},
  {c:"Latitude Wines Inc.",d:"latitudewines.com",city:"Alamo",st:'CA',t:483,ind:"Distributors"},
  {c:"Forest Restaurant Supply Inc. 2010",d:"forestrestaurantsupply.com",city:"San Francisco",st:'CA',t:452,ind:"Trading Companies and Distributors"},
  {c:"California Design Den Inc.",d:"californiadesignden.com",city:"San Ramon",st:'CA',t:442,ind:"Distributors"},
  {c:"Envision Led Lighting Inc.",d:"envisionledlighting.com",city:"Bell",st:'CA',t:437,ind:"Trading Companies and Distributors"},
  {c:"Sunny Designs Inc.",d:"sunnydesigns.com",city:"Rancho Cucamonga",st:'CA',t:436,ind:"Distributors"},
  {c:"Pacific Upholstery Supply Corp",d:"pacificsupplies.com",city:"Gardena",st:'CA',t:418,ind:"Distributors"},
  {c:"Okk Trading Inc.",d:"okktoys.com",city:"Vernon",st:'CA',t:413,ind:"Distributors"},
  {c:"Republic Floor Llc",d:"republicfloor.com",city:"Hayward",st:'CA',t:407,ind:"Distributors"},
  {c:"Global Star Design Inc.",d:"globalstardesign.com",city:"Pleasanton",st:'CA',t:402,ind:"Distributors"},
  {c:"Berry Direct",d:"berrydirect.com",city:"March Air Reserve Base",st:'CA',t:400,ind:"Distributors"},
  {c:"Z&G Global Inc.",d:"g-global.com",city:"Chino",st:'CA',t:400,ind:"Distributors"},
  {c:"Tri West Ltd.",d:"triwestltd.com",city:"Santa Fe Springs",st:'CA',t:393,ind:"Trading Companies and Distributors"},
  {c:"Dynacorn International Inc.",d:"dynacorn.com",city:"Camarillo",st:'CA',t:391,ind:"Distributors"},
  {c:"Nexgen Metals Inc.",d:"nexgenworld.com",city:"Torrance",st:'CA',t:379,ind:"Trading Companies and Distributors"},
  {c:"Permagro",d:"permagro.net",city:"Buena Park",st:'CA',t:373,ind:"Trading Companies and Distributors"},
  {c:"Nanshing America Inc.",d:"nanshing.com",city:"Los Angeles",st:'CA',t:364,ind:"Distributors"},
  {c:"Dahdoul Textiles Inc.",d:"shop.dahdoulinc.com",city:"Commerce",st:'CA',t:361,ind:"Distributors"},
  {c:"Hansung Usa Llc",d:"hansungusa.com",city:"Aliso Viejo",st:'CA',t:355,ind:"Distributors"},
  {c:"Aramco Imp. Inc.",d:"aramcoimports.com",city:"",st:'CA',t:355,ind:"Distributors"},
  {c:"Fred David International Usa Inc.",d:"freddavid.com",city:"La Mirada",st:'CA',t:342,ind:"Distributors"},
  {c:"Tiger Corporation Usa",d:"tiger.jp",city:"Torrance",st:'CA',t:341,ind:"Trading Companies and Distributors"},
  {c:"H.C.Foods Co., Ltd.",d:"hcfoods.net",city:"Commerce",st:'CA',t:338,ind:"Distributors"},
  {c:"Fuji Electric Corp. Of America",d:"fujielectric.com",city:"Fremont",st:'CA',t:336,ind:"Trading Companies and Distributors"},
  {c:"Iris Wholesales Inc.",d:"iriswholesale.com",city:"Los Angeles",st:'CA',t:335,ind:"Distributors"},
  {c:"Hongfa America Inc.",d:"hongfa.com",city:"Lake Forest",st:'CA',t:329,ind:"Trading Companies and Distributors"},
  {c:"Francini Inc.",d:"francinimarble.com",city:"Sun Valley",st:'CA',t:320,ind:"Trading Companies and Distributors"},
  {c:"In Motion Design Inc.",d:"inmotion.design",city:"Paramount",st:'CA',t:316,ind:"Distributors"},
  {c:"Mizari Enterprises Inc.",d:"mizari.com",city:"Commerce",st:'CA',t:312,ind:"Distributors"},
  {c:"Bandai Logipal America Inc.",d:"blpainc.com",city:"Compton",st:'CA',t:311,ind:"Distributors"},
  {c:"Edgemine Inc.",d:"edgemine.com",city:"Vernon",st:'CA',t:309,ind:"Distributors"},
  {c:"Del Tho Industries Inc.",d:"del-tho.com",city:"Los Angeles",st:'CA',t:306,ind:"Trading Companies and Distributors"},
  {c:"Fulton Denver Co.",d:"fultonpacific.com",city:"Vacaville",st:'CA',t:298,ind:"Distributors"},
  {c:"Noble Rider Llc",d:"nobleoutfitters.com",city:"Modesto",st:'CA',t:290,ind:"Distributors"},
  {c:"Regal Art & Gift",d:"regalgift.com",city:"Martinez",st:'CA',t:278,ind:"Distributors"},
  {c:"Howard Industries Inc.",d:"howind.com",city:"Poway",st:'CA',t:276,ind:"Trading Companies and Distributors"},
  {c:"Epilay Inc.",d:"epilay.com",city:"Carson",st:'CA',t:276,ind:"Trading Companies and Distributors"},
  {c:"Kp Distribution Inc.",d:"linkvox.com",city:"Pomona",st:'CA',t:268,ind:"Trading Companies and Distributors"},
  {c:"Kingston Brass Inc.",d:"kingstonbrass.com",city:"Chino",st:'CA',t:261,ind:"Trading Companies and Distributors"},
  {c:"Mjb Plastics",d:"mjbplastics.com",city:"Long Beach",st:'CA',t:254,ind:"Trading Companies and Distributors"},
  {c:"Helmet House, Inc.",d:"helmethouse.com",city:"Calabasas",st:'CA',t:249,ind:"Distributors"},
  {c:"Acme Furniture Industries Inc.",d:"acmecorp.com",city:"City of Industry",st:'CA',t:246,ind:"Distributors"},
  {c:"New Wave Converting Inc.",d:"nwconverting.com",city:"Fontana",st:'CA',t:246,ind:"Distributors"},
  {c:"Sun Fast International Llc",d:"sunfastusa.com",city:"Brea",st:'CA',t:241,ind:"Trading Companies and Distributors"},
  {c:"American Tartaric Products Inc.",d:"americantartaric.com",city:"Windsor",st:'CA',t:240,ind:"Trading Companies and Distributors"},
  {c:"Southern Marketing Affiliates",d:"smalink.com",city:"Fresno",st:'CA',t:240,ind:"Trading Companies and Distributors"},
  {c:"Skiva International Inc.",d:"trendsetny.com",city:"Los Angeles",st:'CA',t:234,ind:"Distributors"},
  {c:"Granite Group Wholesalers Llc",d:"thegranitegroup.com",city:"San Diego",st:'CA',t:228,ind:"Trading Companies and Distributors"},
  {c:"Mrc Creations Inc.",d:"mrccreations.com",city:"Rosemead",st:'CA',t:227,ind:"Distributors"},
  {c:"Hyve Solutions",d:"tdsynnex.com",city:"Fremont",st:'CA',t:222,ind:"Distributors"},
  {c:"Basstech International",d:"basstechintl.com",city:"Santa Ana",st:'CA',t:221,ind:"Trading Companies and Distributors"},
  {c:"Sunmight Usa Corporation",d:"sunmightusa.com",city:"La Mirada",st:'CA',t:214,ind:"Trading Companies and Distributors"},
  {c:"Quality Chain Corp.",d:"qualitychaincorp.com",city:"Rocklin",st:'CA',t:212,ind:"Trading Companies and Distributors"},
  {c:"Kole Imp.",d:"koleimports.com",city:"Carson",st:'CA',t:211,ind:"Distributors"},
  {c:"West Wood Products",d:"west-wood.net",city:"Compton",st:'CA',t:210,ind:"Trading Companies and Distributors"},
  {c:"Grant & Bowman Inc.",d:"grantandbowman.com",city:"Beverly Hills",st:'CA',t:208,ind:"Distributors"},
  {c:"Vivion Inc.",d:"lfamachines.com",city:"Vernon",st:'CA',t:205,ind:"Trading Companies and Distributors"},
  {c:"Paper 360 Inc.",d:"paper-360.com",city:"Ontario",st:'CA',t:205,ind:"Trading Companies and Distributors"},
  {c:"Y K Packaging Inc.",d:"sandkpackaging.com",city:"Chula Vista",st:'CA',t:202,ind:"Trading Companies and Distributors"},
  {c:"Winesellers Ltd.",d:"winesellersltd.com",city:"Oakland",st:'CA',t:201,ind:"Distributors"},
  {c:"Crp Industries Inc.",d:"crpindustries.com",city:"Fremont",st:'CA',t:200,ind:"Distributors"},
  {c:"Happy Forest International Inc.",d:"hipacktravel.com",city:"Ontario",st:'CA',t:196,ind:"Distributors"},
  {c:"Ultimate Products",d:"ultimateproducts.us",city:"West Sacramento",st:'CA',t:194,ind:"Trading Companies and Distributors"}
];
let list = companies;
if (TEST_DOMAINS.length) list = companies.filter(c => TEST_DOMAINS.includes(c.d));
return list.map(c => ({ json: { company:c.c, domain:c.d, city:c.city, state:c.st, teu:c.t, industry:c.ind } }));

// ===== "Build people search" =====
// Apollo People Search body for this company's domain. FREE (no credits); returns no emails.
const c = $json;
const searchBody = {
  q_organization_domains_list: [c.domain],
  person_titles: ["owner", "president", "ceo", "chief operating officer", "coo", "vp operations", "vice president operations", "director of operations", "vp supply chain", "director of supply chain", "head of supply chain", "vp logistics", "director of logistics", "head of logistics", "director of distribution", "distribution manager", "warehouse manager", "director of warehousing", "head of fulfillment", "vp fulfillment"],
  person_seniorities: ["owner", "founder", "c_suite", "vp", "director", "head"],
  include_similar_titles: true, per_page: 10, page: 1
};
return [{ json: { ...c, searchBody } }];

// ===== "Pick best contacts" =====
// Keep the 1-2 best warehousing decision-makers. ALWAYS returns one item (picked:[] if none)
// so the batch loop never breaks; an IF node downstream skips no-contact companies.
const ctx = $('Build people search').item.json;
const people = ($json.people || $json.contacts || []);
const PRI = ['owner','president','ceo','coo','chief operating','operations','supply chain','logistics','distribution','warehouse','fulfillment'];
const rank = p => { const t=(p.title||'').toLowerCase(); const i=PRI.findIndex(k=>t.includes(k)); return i<0?99:i; };
const picked = people.filter(p=>p&&(p.id||p.first_name)).sort((a,b)=>rank(a)-rank(b)).slice(0,2)
  .map(p=>({ id:p.id, first_name:p.first_name, last_name:p.last_name, title:p.title, linkedin_url:p.linkedin_url, seniority:p.seniority }));
const enrichBody = picked.length ? { reveal_personal_emails:true, reveal_phone_number:false,
  details: picked.map(p => p.id ? { id:p.id } : { first_name:p.first_name, last_name:p.last_name, domain:ctx.domain }) } : null;
return [{ json: { company:ctx.company, domain:ctx.domain, city:ctx.city, state:ctx.state, teu:ctx.teu, industry:ctx.industry, picked, enrichBody } }];

// ===== "Build scoring prompt" =====
// Score AFTER enrichment, so timing/growth are DATA-DRIVEN (real Apollo firmographics), not guessed.
// Enrichment response (matches) on $json; company context from 'Pick best contacts'.
const ctx = $('Pick best contacts').item.json;
const m   = ($json.matches || [])[0] || {};
const org = m.organization || {};
const ind = ctx.industry || 'consumer goods';
const rubric = `You are scoring a US importer in the "${ind}" category as a prospect for Cubework's flexible, month-to-month warehouse space near the Ports of LA/Long Beach (Inland Empire) and other Cubework metros. The ideal prospect moves real container volume but is NOT so large it already owns its distribution.\nScore 7 factors using the data provided: volume_trend(0-20 higher TEU / growth = outgrowing space); right_size(0-20 mid-size; PENALIZE giants that own DCs and tiny importers); seasonality(0-15 category spikes); dtc(0-15 holds own inventory); bulk(0-10 bulky goods like furniture/home/sporting); recurring(0-10); timing(0-10 use headcount_growth / funding / open_jobs — rising = expanding = needs space now).\nTiers: Hot>=70, Warm 45-69, Watch<45. Score conservatively when data is thin.\nReturn ONLY minified JSON: {\"total\":n,\"tier\":\"Hot|Warm|Watch\",\"why_now\":\"one sentence (cite a real signal if present)\",\"email_subject\":\"...\",\"email_body\":\"~80 words, value-led, lead with port-proximity + flexible space for this company's bulky/seasonal inventory, reference the company and its category specifically, offer to share how similar importers structure overflow space, never use the phrase follow up, sign as Justin\"}`;
const candidate = JSON.stringify({ company:ctx.company, industry:ind, state:ctx.state, teu:ctx.teu,
  employees:org.estimated_num_employees, founded:org.founded_year,
  annual_revenue:org.annual_revenue_printed||org.annual_revenue||null,
  total_funding:org.total_funding_printed||org.total_funding||null,
  latest_funding:org.latest_funding_stage||null,
  headcount_growth_6mo:org.organization_headcount_six_month_growth,
  headcount_growth_12mo:org.organization_headcount_twelve_month_growth,
  open_jobs:org.organization_num_jobs||org.num_jobs||null });
const requestBody = { model:'gpt-4o', max_tokens:700, response_format:{ type:'json_object' },
  messages:[ { role:'system', content:rubric }, { role:'user', content:'Company data:\n'+candidate } ] };
return [{ json: { ...ctx, requestBody } }];

// ===== "Build prospect doc" =====
// Build the rich Firestore `outreach` doc. NO GATE — write every qualified company
// (tier is just a label). Context from 'Pick best contacts'; enrichment from 'Apollo reveal email';
// OpenAI score on $json. Deterministic id ap-<domain> => re-runs skip (no clobber). Phone empty until reveal-on-reply.
const ctx = $('Pick best contacts').item.json;
const m   = ($('Apollo reveal email (1 credit)').item.json.matches || [])[0] || {};
const org = m.organization || {};
const p0  = (ctx.picked && ctx.picked[0]) || {};
let parsed = {};
try { const t=($json.choices&&$json.choices[0]&&$json.choices[0].message&&$json.choices[0].message.content)||$json.text||'{}';
  parsed = JSON.parse(t.trim().replace(/^```json/i,'').replace(/```$/,'').trim()); } catch(e){ parsed = {}; }
const dedash = s => String(s==null?'':s).replace(/\s*[\u2014\u2013]\s*/g, ', ').replace(/\s--\s/g, ', ');
const email = m.email || (m.personal_emails && m.personal_emails[0]) || '';
const fullName = m.name || ((m.first_name||p0.first_name||'') + ' ' + (m.last_name||p0.last_name||'')).trim();
const title = m.title || p0.title || '';
const now = new Date().toISOString();
const slug = 'ap-' + ctx.domain.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
const S = v => ({ stringValue:(v==null?'':String(v)) });
const I = v => ({ integerValue:String(Math.round(Number(v)||0)) });
const pct = v => (v==null||v===''?'':(Math.round(Number(v)*1000)/10)+'%');
const fields = {
  company:S(ctx.company), domain:S(ctx.domain),
  first_name:S(fullName), contact:S(title), seniority:S(m.seniority||p0.seniority||''),
  department:S((m.departments&&m.departments[0])||''), headline:S(m.headline||''), photo:S(m.photo_url||''),
  email:S(email), email_status:S(m.email_status||''), linkedin:S(m.linkedin_url||p0.linkedin_url||''),
  person_loc:S([m.city,m.state].filter(Boolean).join(', ')), phone:S(''),
  industry:S(org.industry||ctx.industry||''), employees:I(org.estimated_num_employees), founded:S(org.founded_year||''),
  annual_revenue:S(org.annual_revenue_printed||org.annual_revenue||''),
  total_funding:S(org.total_funding_printed||org.total_funding||''),
  latest_funding:S([org.latest_funding_stage,org.latest_funding_round_date].filter(Boolean).join(' \u00b7 ')),
  growth_6mo:S(pct(org.organization_headcount_six_month_growth)),
  growth_12mo:S(pct(org.organization_headcount_twelve_month_growth)),
  growth_24mo:S(pct(org.organization_headcount_twenty_four_month_growth)),
  num_jobs:I(org.organization_num_jobs||org.num_jobs||0),
  description:S(String(org.short_description||'').slice(0,600)),
  org_phone:S(org.phone||org.primary_phone||org.sanitized_phone||''),
  org_address:S(org.raw_address||[org.street_address,org.city,org.state].filter(Boolean).join(', ')),
  org_state:S(org.state||ctx.state||''), org_website:S(org.website_url||('https://'+ctx.domain)), org_linkedin:S(org.linkedin_url||''),
  teu:I(ctx.teu),
  prospect_tier:S(parsed.tier||''), prospect_score:I(parsed.total!=null?parsed.total:0),
  why_now:S(parsed.why_now||''), email_subject:S(dedash(parsed.email_subject||'')), email_body:S(dedash(parsed.email_body||'')),
  status:S(''), prospect_source:S('Apollo'), createdAt:{ timestampValue:now }
};
return [{ json: { slug, hasEmail:!!email, fsBody:{ fields } } }];

