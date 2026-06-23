// Apollo Ingestion (CA core-fit) — paste-ready Code nodes.

// ===== "CA core-fit input" =====
// CA core-fit prospects: Household Durables, Specialty Retail, Apparel & Footwear, Leisure Products.
// California consignees only, TEU 250-10,000 (giants & micro-importers already filtered out).
// SCALE: regenerate this array for another state/batch and paste here.
// TEST vs FULL: while TEST_DOMAINS is non-empty only those run; set TEST_DOMAINS = [] to run all 139.
const TEST_DOMAINS = ["livingspaces.com", "sceptre.com", "fashionnova.com"];
const companies = [
  {c:"Intl Pet Supplies And",d:"petco.com",city:"San Diego",st:'CA',t:4036,ind:"Specialty Retail"},
  {c:"Living Spaces Furniture",d:"livingspaces.com",city:"La Mirada",st:'CA',t:3832,ind:"Specialty Retail"},
  {c:"Evenflo Co. Inc.",d:"gbinternational.com.hk",city:"Ontario",st:'CA',t:2918,ind:"Household Durables"},
  {c:"Zodiac Pool Systems Inc.",d:"fluidra.com",city:"Vista",st:'CA',t:2513,ind:"Leisure Products"},
  {c:"Birkenstock Usa",d:"lcatterton.com",city:"Novato",st:'CA',t:2421,ind:"Textiles, Apparel and Luxury Goods"},
  {c:"Design Within Reach",d:"millerknoll.com",city:"San Francisco",st:'CA',t:2133,ind:"Specialty Retail"},
  {c:"Mad Engine Llc",d:"madengine.com",city:"San Diego",st:'CA',t:2044,ind:"Textiles, Apparel and Luxury Goods"},
  {c:"Sceptre",d:"sceptre.com",city:"City of Industry",st:'CA',t:1783,ind:"Household Durables"},
  {c:"Keepcool Usa Llc",d:"keepcoolbags.com",city:"Lafayette",st:'CA',t:1714,ind:"Textiles, Apparel and Luxury Goods"},
  {c:"Sonos Inc.",d:"sonos.com",city:"",st:'CA',t:1625,ind:"Household Durables"},
  {c:"Fashion Nova",d:"fashionnova.com",city:"Los Angeles",st:'CA',t:1521,ind:"Specialty Retail"},
  {c:"Fender Musical Instruments Corp.",d:"fender.com",city:"Ontario",st:'CA',t:1408,ind:"Leisure Products"},
  {c:"Sony Interactive Entertainment",d:"sony.com",city:"Foster City",st:'CA',t:1392,ind:"Household Durables"},
  {c:"E&E Co., Ltd.",d:"ee1994.com",city:"Fremont",st:'CA',t:1376,ind:"Household Durables"},
  {c:"Homelegance Inc.",d:"homelegance.com",city:"Santa Fe Springs",st:'CA',t:1344,ind:"Specialty Retail"},
  {c:"Tcw Trends Inc.",d:"tcwtrends.com",city:"Torrance",st:'CA',t:1335,ind:"Textiles, Apparel and Luxury Goods"},
  {c:"Ergomotion Inc.",d:"keeson.com",city:"Santa Barbara",st:'CA',t:1274,ind:"Household Durables"},
  {c:"Zinus Inc.",d:"zinus.co.kr",city:"Tracy",st:'CA',t:1232,ind:"Household Durables"},
  {c:"Romeo & Juliette Inc.",d:"bearpaw.com",city:"Citrus Heights",st:'CA',t:1170,ind:"Textiles, Apparel and Luxury Goods"},
  {c:"Guess Inc.",d:"guess.com",city:"Los Angeles",st:'CA',t:1167,ind:"Specialty Retail"},
  {c:"Boot Barn",d:"bootbarn.com",city:"Irvine",st:'CA',t:1096,ind:"Specialty Retail"},
  {c:"Golden Designs",d:"goldendesigninc.com",city:"Ontario",st:'CA',t:1060,ind:"Leisure Products"},
  {c:"Yamaha Corporation Of America",d:"yamaha.com",city:"Buena Park",st:'CA',t:1030,ind:"Leisure Products"},
  {c:"Ardmore Home Design Llc",d:"madegoods.com",city:"Hacienda Heights",st:'CA',t:1017,ind:"Household Durables"},
  {c:"Fam Llc",d:"fambrands.com",city:"Los Angeles",st:'CA',t:1000,ind:"Textiles, Apparel and Luxury Goods"},
  {c:"Haitai Inc.",d:"haitaiusa.com",city:"Montebello",st:'CA',t:993,ind:"Specialty Retail"},
  {c:"Topway Global Inc.",d:"watts.com",city:"Brea",st:'CA',t:992,ind:"Household Durables"},
  {c:"Nine Stars Group (Usa.) Inc.",d:"ninestarsusa.com",city:"Pomona",st:'CA',t:988,ind:"Specialty Retail"},
  {c:"Callaway Golf Company",d:"topgolfcallawaybrands.com",city:"Carlsbad",st:'CA',t:924,ind:"Leisure Products"},
  {c:"Style Melody Inc.",d:"stylemelodyfashion.com",city:"Vernon",st:'CA',t:878,ind:"Specialty Retail"},
  {c:"Hoist Fitness Systems",d:"hoistfitness.com",city:"Poway",st:'CA',t:874,ind:"Leisure Products"},
  {c:"Caba Design Corp.",d:"cabadesign.co",city:"Rancho Cordova",st:'CA',t:868,ind:"Household Durables"},
  {c:"Mki Enterprise Group",d:"dongjian.cc",city:"Corona",st:'CA',t:867,ind:"Specialty Retail"},
  {c:"Geekplus America Inc.",d:"geekplus.com",city:"Carlsbad",st:'CA',t:793,ind:"Textiles, Apparel and Luxury Goods"},
  {c:"Leon Max Inc.",d:"maxstudio.com",city:"Pasadena",st:'CA',t:782,ind:"Specialty Retail"},
  {c:"Keeco, Llc.",d:"hollandersleepproducts.com",city:"Hayward",st:'CA',t:752,ind:"Household Durables"},
  {c:"Monoprice Inc.",d:"cables.com.tw",city:"Rancho Cucamonga",st:'CA',t:743,ind:"Specialty Retail"},
  {c:"Adc Solutions Auto Llc",d:"typesauto.com",city:"Costa Mesa",st:'CA',t:729,ind:"Specialty Retail"},
  {c:"Camping World",d:"campingworld.com",city:"Bakersfield",st:'CA',t:717,ind:"Specialty Retail"},
  {c:"Gale Pacific Usa Inc.",d:"galepacific.com",city:"Rancho Cucamonga",st:'CA',t:703,ind:"Household Durables"},
  {c:"Ac Infinity Inc.",d:"acinfinity.com",city:"City of Industry",st:'CA',t:688,ind:"Household Durables"},
  {c:"Grafiti Home Inc. (Dba 7 Th Avenue)",d:"grafitihome.com",city:"Compton",st:'CA',t:684,ind:"Household Durables"},
  {c:"Hot Topic",d:"hottopic.com",city:"City of Industry",st:'CA',t:674,ind:"Specialty Retail"},
  {c:"Mor Furniture For Less",d:"hkfoam.com",city:"San Diego",st:'CA',t:672,ind:"Specialty Retail"},
  {c:"Entertainment Earth Inc.",d:"entertainmentearth.com",city:"Simi Valley",st:'CA',t:667,ind:"Specialty Retail"},
  {c:"E.L.F. Cosmetics Inc.",d:"elfcosmetics.com",city:"Ontario",st:'CA',t:659,ind:"Specialty Retail"},
  {c:"Nexgrill Industries Inc.",d:"globalleisuregroup.com",city:"Chino",st:'CA',t:611,ind:"Household Durables"},
  {c:"Levtex Llc.",d:"wholesale.levtexhome.com",city:"Santa Monica",st:'CA',t:609,ind:"Household Durables"},
  {c:"Ambiance Usa",d:"ambianceapparel.us",city:"Los Angeles",st:'CA',t:603,ind:"Textiles, Apparel and Luxury Goods"},
  {c:"Lulu And Georgia",d:"luluandgeorgia.com",city:"Bellflower",st:'CA',t:583,ind:"Specialty Retail"},
  {c:"Aico Amini Innovation Corp.",d:"amini.com",city:"Pico Rivera",st:'CA',t:582,ind:"Household Durables"},
  {c:"Childrens Apparel Network Ltd.",d:"childrensapparelnetwork.com",city:"Fontana",st:'CA',t:579,ind:"Textiles, Apparel and Luxury Goods"},
  {c:"Arcadia Beauty Labs Llc",d:"sallybeautyholdings.com",city:"Carson",st:'CA',t:572,ind:"Specialty Retail"},
  {c:"Sound United",d:"masimo.com",city:"Vista",st:'CA',t:558,ind:"Household Durables"},
  {c:"Superior Home Design Inc.",d:"discounthwf.com",city:"Los Angeles",st:'CA',t:556,ind:"Specialty Retail"},
  {c:"Austin Pang Gloves Mfg. (Usa) Corp.",d:"johnsonwilshire.com",city:"Santa Fe Springs",st:'CA',t:555,ind:"Textiles, Apparel and Luxury Goods"},
  {c:"Fabletics Llc",d:"ibinc.com",city:"El Segundo",st:'CA',t:550,ind:"Textiles, Apparel and Luxury Goods"},
  {c:"Peag Llc",d:"jlab.com",city:"Carlsbad",st:'CA',t:545,ind:"Household Durables"},
  {c:"Topson Downs Of California Inc.",d:"topsondowns.com",city:"Culver City",st:'CA',t:545,ind:"Textiles, Apparel and Luxury Goods"},
  {c:"Colosseum Athletics Corp.",d:"colosseumusa.com",city:"Compton",st:'CA',t:538,ind:"Textiles, Apparel and Luxury Goods"},
  {c:"Bexco Enterprises",d:"milliondollarbaby.com",city:"Montebello",st:'CA',t:522,ind:"Household Durables"},
  {c:"Vans Inc.",d:"vfc.com",city:"Santa Fe Springs",st:'CA',t:520,ind:"Specialty Retail"},
  {c:"Canyon Bicycles Usa Inc.",d:"canyon.com",city:"Chino",st:'CA',t:517,ind:"Leisure Products"},
  {c:"Mgr Design International",d:"mgrdesign.com",city:"Oxnard",st:'CA',t:504,ind:"Household Durables"},
  {c:"Pentair Water Pool And Sp A",d:"pentair.com",city:"Moorpark",st:'CA',t:500,ind:"Leisure Products"},
  {c:"Jerry Leigh Inc.",d:"jerryleigh.com",city:"Vernon",st:'CA',t:490,ind:"Textiles, Apparel and Luxury Goods"},
  {c:"Kidsmania Inc.",d:"kidsmania.com",city:"Santa Fe Springs",st:'CA',t:490,ind:"Specialty Retail"},
  {c:"Noritz America",d:"noritzglobal.com",city:"Fountain Valley",st:'CA',t:488,ind:"Household Durables"},
  {c:"Jeffrey Court Inc.",d:"jeffreycourt.com",city:"Norco",st:'CA',t:487,ind:"Household Durables"},
  {c:"Aliquantum International Inc.",d:"aqi-intl.com",city:"Ontario",st:'CA',t:487,ind:"Leisure Products"},
  {c:"Universal Electronics Inc.",d:"uei.com",city:"Cypress",st:'CA',t:485,ind:"Household Durables"},
  {c:"Matisse Footwear",d:"dev2.matissefootwear.com",city:"El Segundo",st:'CA',t:483,ind:"Textiles, Apparel and Luxury Goods"},
  {c:"Bradshaw International Inc.",d:"bradshawhome.com",city:"Rancho Cucamonga",st:'CA',t:483,ind:"Household Durables"},
  {c:"Joneca Corp.",d:"joneca.com",city:"Anaheim",st:'CA',t:478,ind:"Household Durables"},
  {c:"Flora Bunda Inc.",d:"florabundaus.com",city:"City of Industry",st:'CA',t:459,ind:"Specialty Retail"},
  {c:"Lifecore Fitness Inc.",d:"fitlab.com",city:"Vista",st:'CA',t:458,ind:"Leisure Products"},
  {c:"Olukai",d:"olukai.com",city:"Irvine",st:'CA',t:449,ind:"Textiles, Apparel and Luxury Goods"},
  {c:"Path To Prosperity Inc.",d:"cpturf.com",city:"San Dimas",st:'CA',t:447,ind:"Leisure Products"},
  {c:"One Diamond Electronics Inc.",d:"diamond-electronics.com",city:"Los Angeles",st:'CA',t:431,ind:"Household Durables"},
  {c:"Volcom Inc.",d:"authentic.com",city:"El Segundo",st:'CA',t:428,ind:"Textiles, Apparel and Luxury Goods"},
  {c:"Pioneer Electronics (Usa) Inc.",d:"global.pioneer",city:"Long Beach",st:'CA',t:423,ind:"Household Durables"},
  {c:"Tai Apparel Inc.",d:"taiapparel.com",city:"Agoura Hills",st:'CA',t:422,ind:"Textiles, Apparel and Luxury Goods"},
  {c:"International Textile & Apparel Inc.",d:"tracietung.com",city:"Los Angeles",st:'CA',t:414,ind:"Textiles, Apparel and Luxury Goods"},
  {c:"Jobar International Inc.",d:"jobar.com",city:"Carson",st:'CA',t:413,ind:"Specialty Retail"},
  {c:"Pets Global Inc.",d:"pets-global.com",city:"Santa Clarita",st:'CA',t:392,ind:"Specialty Retail"},
  {c:"Home Legend",d:"homelegend.com",city:"Fontana",st:'CA',t:385,ind:"Household Durables"},
  {c:"Cavalini Inc.",d:"cavalini.com",city:"Los Angeles",st:'CA',t:376,ind:"Textiles, Apparel and Luxury Goods"},
  {c:"Daiwa Corporation",d:"globeride.co.jp",city:"Cypress",st:'CA',t:371,ind:"Leisure Products"},
  {c:"Pacific Sunwear Of California",d:"pacsun.com",city:"Anaheim",st:'CA',t:361,ind:"Textiles, Apparel and Luxury Goods"},
  {c:"Sagebrook Home",d:"sagebrookhome.com",city:"Commerce",st:'CA',t:352,ind:"Specialty Retail"},
  {c:"Janie And Jack",d:"janieandjack.com",city:"San Francisco",st:'CA',t:338,ind:"Textiles, Apparel and Luxury Goods"},
  {c:"Swat Fame Inc.",d:"swatfame.com",city:"City of Industry",st:'CA',t:334,ind:"Textiles, Apparel and Luxury Goods"},
  {c:"Tropitone Furniture Co. Inc.",d:"brownjordaninc.com",city:"Irvine",st:'CA',t:333,ind:"Household Durables"},
  {c:"Parachute Home Inc.",d:"parachutehome.com",city:"Culver City",st:'CA',t:331,ind:"Household Durables"},
  {c:"Jada Toys Inc.",d:"simbatoys.de",city:"City of Industry",st:'CA',t:330,ind:"Leisure Products"},
  {c:"The Bonkers Toy Co.",d:"bonkerstoys.com",city:"La Jolla",st:'CA',t:329,ind:"Specialty Retail"},
  {c:"Abc Home Furnishings Inc.",d:"abchome.com",city:"San Francisco",st:'CA',t:324,ind:"Specialty Retail"},
  {c:"Blue Ridge Home Fashions Inc.",d:"blueridgehome.com",city:"Baldwin Park",st:'CA',t:323,ind:"Household Durables"},
  {c:"Allied Home Llc",d:"alliedhomebedding.com",city:"Montebello",st:'CA',t:320,ind:"Textiles, Apparel and Luxury Goods"},
  {c:"Meyer Sound Laboratories Inc.",d:"meyersound.com",city:"Berkeley",st:'CA',t:311,ind:"Household Durables"},
  {c:"Rhythm Healthcare",d:"rhythmhc.com",city:"Corona",st:'CA',t:307,ind:"Specialty Retail"},
  {c:"At Home Good Inc.",d:"athome.com",city:"Corona",st:'CA',t:306,ind:"Specialty Retail"},
  {c:"Business & Pleasure Co. Llc",d:"businessandpleasureco.com",city:"Compton",st:'CA',t:304,ind:"Household Durables"},
  {c:"Aramark Uniform & Career Apparel",d:"vestis.com",city:"Burbank",st:'CA',t:302,ind:"Textiles, Apparel and Luxury Goods"},
  {c:"Jakks Pacific Inc.",d:"jakks.com",city:"Malibu",st:'CA',t:295,ind:"Leisure Products"},
  {c:"Tyr Sport, Inc.",d:"swimwearanywhere.com",city:"Huntington Beach",st:'CA',t:291,ind:"Textiles, Apparel and Luxury Goods"},
  {c:"Le Chandelle Inc.",d:"lechandellecandles.com",city:"Diamond Bar",st:'CA',t:290,ind:"Household Durables"},
  {c:"East West Imp. Exp. Inc.",d:"eastwestinc.net",city:"Vernon",st:'CA',t:284,ind:"Specialty Retail"},
  {c:"Hybrid Promotions, Llc",d:"hybridapparel.com",city:"Huntington Beach",st:'CA',t:275,ind:"Textiles, Apparel and Luxury Goods"},
  {c:"Enriquez Materials & Quilting Inc.",d:"enriquezquilting.com",city:"Commerce",st:'CA',t:274,ind:"Household Durables"},
  {c:"Shimano North America Holding Inc.",d:"shimano.com",city:"Irvine",st:'CA',t:273,ind:"Leisure Products"},
  {c:"Revival Rugs Inc.",d:"revivalrugs.com",city:"Oakland",st:'CA',t:265,ind:"Household Durables"},
  {c:"Punch Studio",d:"punchstudio.com",city:"Culver City",st:'CA',t:265,ind:"Household Durables"},
  {c:"Stansport",d:"stansport.com",city:"Los Angeles",st:'CA',t:262,ind:"Leisure Products"},
  {c:"Trend Smart America Ltd.",d:"cec.com.cn",city:"San Diego",st:'CA',t:261,ind:"Specialty Retail"},
  {c:"Phase Ii Products Inc.",d:"phaseii.com",city:"San Diego",st:'CA',t:259,ind:"Household Durables"},
  {c:"Ariat International Inc",d:"ariat.com",city:"Union City",st:'CA',t:259,ind:"Textiles, Apparel and Luxury Goods"},
  {c:"Eurostar Inc.",d:"investors.footlocker-inc.com",city:"Los Angeles",st:'CA',t:253,ind:"Specialty Retail"},
  {c:"Material Supply Inc.",d:"store.acpro.com",city:"Fontana",st:'CA',t:248,ind:"Specialty Retail"},
  {c:"Caltric",d:"caltric.com",city:"Los Angeles",st:'CA',t:244,ind:"Specialty Retail"},
  {c:"Fortune Swimwear Llc",d:"coaststylegroupbrands.com",city:"Culver City",st:'CA',t:242,ind:"Textiles, Apparel and Luxury Goods"},
  {c:"Colours",d:"gocolours.com",city:"Carson",st:'CA',t:235,ind:"Specialty Retail"},
  {c:"Amrapur Overseas, Inc.",d:"amrapur.com",city:"Garden Grove",st:'CA',t:235,ind:"Textiles, Apparel and Luxury Goods"},
  {c:"My Favorite Co. Inc.",d:"myfavoriteco.com",city:"Los Angeles",st:'CA',t:233,ind:"Leisure Products"},
  {c:"Bear Down Brands Llc",d:"pureenrichment.com",city:"Huntington Beach",st:'CA',t:227,ind:"Household Durables"},
  {c:"Playmates Toys Inc.",d:"playmates.net",city:"El Segundo",st:'CA',t:220,ind:"Leisure Products"},
  {c:"Z Supply Llc",d:"zsupplyllc.com",city:"Irvine",st:'CA',t:216,ind:"Textiles, Apparel and Luxury Goods"},
  {c:"Zenoff Products Inc.",d:"mybrestfriend.com",city:"Foster City",st:'CA',t:213,ind:"Specialty Retail"},
  {c:"Sierra Living Concepts Inc.",d:"sierralivingconcepts.com",city:"Fremont",st:'CA',t:212,ind:"Specialty Retail"},
  {c:"T3 Micro Inc.",d:"t3micro.com",city:"Venice",st:'CA',t:209,ind:"Household Durables"},
  {c:"Bia Cordon Bleu Inc.",d:"biacordonblu.com",city:"Galt",st:'CA',t:207,ind:"Household Durables"},
  {c:"Boo Young Co. Inc.",d:"byoungco.com",city:"Carson",st:'CA',t:206,ind:"Specialty Retail"},
  {c:"Honeylove Sculptwear Inc.",d:"honeylove.ly",city:"San Francisco",st:'CA',t:203,ind:"Specialty Retail"},
  {c:"Restoration Hardware",d:"rh.com",city:"Corte Madera",st:'CA',t:202,ind:"Household Durables"},
  {c:"Andamiro Usa",d:"andamirousa.com",city:"Gardena",st:'CA',t:201,ind:"Leisure Products"},
  {c:"Zigi Usa Llc",d:"ziginy.com",city:"Torrance",st:'CA',t:199,ind:"Specialty Retail"},
  {c:"Tabletops Unlimited Inc.",d:"tabletopsunltd.com",city:"Carson",st:'CA',t:197,ind:"Household Durables"},
  {c:"Vesture Corp",d:"microcoretechnology.com",city:"Burbank",st:'CA',t:196,ind:"Household Durables"},
  {c:"Aver Information Inc.",d:"aver.com",city:"Fremont",st:'CA',t:195,ind:"Household Durables"}
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
// Search response on $json (Apollo `people`); company context from prior code node (HTTP replaced the item).
const ctx = $('Build people search').item.json;
const people = ($json.people || $json.contacts || []);
const PRI = ['owner','president','ceo','coo','chief operating','operations','supply chain','logistics','distribution','warehouse','fulfillment'];
const rank = p => { const t=(p.title||'').toLowerCase(); const i=PRI.findIndex(k=>t.includes(k)); return i<0?99:i; };
const picked = people.filter(p=>p&&(p.id||p.first_name)).sort((a,b)=>rank(a)-rank(b)).slice(0,2)
  .map(p=>({ id:p.id, first_name:p.first_name, last_name:p.last_name, title:p.title, linkedin_url:p.linkedin_url, seniority:p.seniority }));
if (!picked.length) return [];
const org = (people[0] && people[0].organization) || {};
return [{ json: { company:ctx.company, domain:ctx.domain, city:ctx.city, state:ctx.state, teu:ctx.teu, industry:ctx.industry, emp:org.estimated_num_employees||null, org_industry:org.industry||'', picked } }];

// ===== "Build scoring prompt" =====
// Score this importer vs the Cubework fit rubric and draft an opener. Industry-aware: uses c.industry.
const c = $json;
const ind = c.industry || 'consumer goods';
const rubric = `You are scoring a US importer in the "${ind}" category as a prospect for Cubework's flexible, month-to-month warehouse space near the Ports of LA/Long Beach (Inland Empire) and other Cubework metros. The ideal prospect moves real container volume but is NOT so large it already owns its distribution.\nScore 7 factors: volume_trend(0-20 higher TEU=outgrowing space); right_size(0-20 mid-size; PENALIZE giants that own DCs and tiny importers); seasonality(0-15 category spikes); dtc(0-15 holds own inventory); bulk(0-10 bulky goods like furniture/home/sporting score high); recurring(0-10); timing(0-10 expansion/new DC/hiring).\nTiers: Hot>=70, Warm 45-69, Watch<45. Score conservatively when data is thin.\nReturn ONLY minified JSON: {\"total\":n,\"tier\":\"Hot|Warm|Watch\",\"why_now\":\"one sentence\",\"email_subject\":\"...\",\"email_body\":\"~80 words, value-led, lead with port-proximity + flexible space for this company's bulky/seasonal inventory, reference the company and its category specifically, offer to share how similar importers structure overflow space, never use the phrase follow up, sign as Justin\"}`;
const candidate = JSON.stringify({ company:c.company, industry:ind, domain:c.domain, state:c.state, teu:c.teu, employees:c.emp, org_industry:c.org_industry });
const requestBody = { model:'gpt-4o', max_tokens:700, response_format:{ type:'json_object' },
  messages:[ { role:'system', content:rubric }, { role:'user', content:'Company:\n'+candidate } ] };
return [{ json: { ...c, requestBody } }];

// ===== "Gate + build email reveal" =====
// OpenAI response on $json.choices[0].message.content; context from 'Pick best contacts'.
// Keep Hot/Warm only (giants tier Watch -> dropped BEFORE spending any email credit).
// Email reveal: reveal_personal_emails=true (1 credit each); phones=false (revealed later on reply).
const ctx = $('Pick best contacts').item.json;
let parsed = {};
try { const t=($json.choices&&$json.choices[0]&&$json.choices[0].message&&$json.choices[0].message.content)||$json.text||'{}';
  parsed = JSON.parse(t.trim().replace(/^```json/i,'').replace(/```$/,'').trim()); } catch(e){ return []; }
const tier = parsed.tier || 'Watch';
if (tier === 'Watch') return [];
const enrichBody = { reveal_personal_emails:true, reveal_phone_number:false,
  details: ctx.picked.map(p => p.id ? { id:p.id } : { first_name:p.first_name, last_name:p.last_name, domain:ctx.domain }) };
return [{ json: { ...ctx, parsed, tier, enrichBody } }];

// ===== "Build prospect doc" =====
// Build a rich Firestore `outreach` doc from the Apollo enrichment record + org firmographics.
// Context from 'Gate + build email reveal'; enrichment response (Apollo `matches`) on $json.
// Capturing the extra fields is FREE (same response we already paid for). Deterministic id
// ap-<domain> => re-runs skip existing (never clobber your Status edits). Direct phone empty until reveal-on-reply.
const ctx = $('Gate + build email reveal').item.json;
const m   = ($json.matches || [])[0] || {};
const org = m.organization || {};
const p0  = (ctx.picked && ctx.picked[0]) || {};
const email = m.email || (m.personal_emails && m.personal_emails[0]) || '';
const fullName = m.name || ((m.first_name||p0.first_name||'') + ' ' + (m.last_name||p0.last_name||'')).trim();
const title = m.title || p0.title || '';
const now = new Date().toISOString();
const slug = 'ap-' + ctx.domain.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
const S = v => ({ stringValue: (v==null?'':String(v)) });
const I = v => ({ integerValue: String(Math.round(Number(v)||0)) });
const pct = v => (v==null||v==='' ? '' : (Math.round(Number(v)*1000)/10) + '%');
const fields = {
  company:S(ctx.company), domain:S(ctx.domain),
  // contact
  first_name:S(fullName), contact:S(title), seniority:S(m.seniority||p0.seniority||''),
  department:S((m.departments&&m.departments[0])||''), headline:S(m.headline||''), photo:S(m.photo_url||''),
  email:S(email), email_status:S(m.email_status||''), linkedin:S(m.linkedin_url||p0.linkedin_url||''),
  person_loc:S([m.city,m.state].filter(Boolean).join(', ')), phone:S(''),
  // company + timing signals
  industry:S(org.industry||ctx.industry||''), employees:I(org.estimated_num_employees),
  founded:S(org.founded_year||''),
  annual_revenue:S(org.annual_revenue_printed || org.annual_revenue || ''),
  total_funding:S(org.total_funding_printed || org.total_funding || ''),
  latest_funding:S([org.latest_funding_stage, org.latest_funding_round_date].filter(Boolean).join(' \u00b7 ')),
  growth_6mo:S(pct(org.organization_headcount_six_month_growth)),
  growth_12mo:S(pct(org.organization_headcount_twelve_month_growth)),
  growth_24mo:S(pct(org.organization_headcount_twenty_four_month_growth)),
  num_jobs:I(org.organization_num_jobs || org.num_jobs || 0),
  description:S(String(org.short_description||'').slice(0,600)),
  // logistics
  org_phone:S(org.phone || org.primary_phone || org.sanitized_phone || ''),
  org_address:S(org.raw_address || [org.street_address,org.city,org.state].filter(Boolean).join(', ')),
  org_state:S(org.state||ctx.state||''), org_website:S(org.website_url || ('https://'+ctx.domain)),
  org_linkedin:S(org.linkedin_url||''),
  teu:I(ctx.teu),
  // pitch
  prospect_tier:S(ctx.tier), prospect_score:I(ctx.parsed.total!=null?ctx.parsed.total:0),
  why_now:S(ctx.parsed.why_now||''), email_subject:S(ctx.parsed.email_subject||''), email_body:S(ctx.parsed.email_body||''),
  status:S(''), prospect_source:S('Apollo'), createdAt:{ timestampValue: now }
};
return [{ json: { slug, hasEmail: !!email, fsBody: { fields } } }];

