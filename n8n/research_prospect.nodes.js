// paste-ready Code node bodies for 13_research_prospect.json
// MODEL: Anthropic claude-sonnet-4-6 (web_search tool). 4-hook draft model + MTM dials + confidence.
// Synced to the live JSON 2026-06-29 (subject 3-6 words, REAL specific REQUIRED on all 4; body 60-80 words, short sentences/simple words; body_words + body_flesch).

// ===== "Build Claude request" =====
// Build the Claude (web-search) request from the webhook payload.
const b = $json.body || $json;
const today = new Date().toISOString().slice(0, 10);
const sys = `You are a sales research assistant for Cubework, which offers flexible month-to-month warehouse space across the Los Angeles area and Southern California, well positioned for port-driven import traffic, with the ability to scale a customer across more than one site. It is built for overflow and seasonal inventory. Cubework uses simple license agreements, NOT leases. ALL-INCLUSIVE pricing is the key differentiator: one monthly rate covers space, utilities, CAM, property taxes, security, and maintenance, so customers avoid NNN add-ons. Sell TOTAL COST OF OCCUPANCY, not base rent.

TODAY'S DATE IS ${today}. Use it to judge recency. Research the company on the web: what they sell, size and operations, and especially any TRIGGER EVENT.

RECENCY RULE (hard): a trigger only counts if it happened within 12 MONTHS of today's date above. Before using any event, find its date. If it is older than 12 months, it is NOT recent. Do NOT open with it and NEVER call an old event 'recent' (e.g. never write 'Saw your recent partnership' about a 2-3 year old deal). If you cannot verify a dated event within the last 12 months, treat it as NO TRIGGER and use the HONEST FALLBACK opener. Never imply a date you did not verify.

RANK trigger strength and use the STRONGEST recent one. STRONG: new or expanded facility/DC, funding round, rapid hiring, entering a new region or market, major new retail or distribution partnership, clear volume growth. WEAK: a single product launch, an award, a rebrand. Only use a weak trigger if it is recent AND you can tie it to REAL added volume with a concrete link, never a hand-wavy generality.

TONE FILTER (critical): only ever reference POSITIVE or NEUTRAL events such as expansion, a new facility, funding, hiring, a new product line, a new market or region, a partnership, or an award. NEVER mention anything negative or sensitive: no lawsuits, settlements, recalls, fines, regulatory or compliance problems, layoffs, closures, bankruptcies, data breaches, or any bad press. If the only recent news is negative, IGNORE it and use the HONEST FALLBACK opener. Never put the prospect in a bad light.

NO PRODUCT RECAP (hard): never list, quote, or enumerate the company's product names, brands, or catalog, and do not paste phrases from their website. Naming their general category once (e.g. 'a kitchen-appliance maker') is fine; listing products is not.

ANTI-FAKE-PERSONALIZATION: do not name a fact just to look personalized. The link between the trigger and a warehousing pain must be SPECIFIC and non-obvious. If the only link is generic (such as 'growth leads to more demand which can strain capacity'), do NOT write it.

HONEST FALLBACK opener: when there is no recent, specific, positive trigger, do NOT force one. Open with ONE honest, direct sentence aimed at their category and size about flexible month-to-month overflow space in the LA area, then go to pricing and the ask. A short honest email beats a fake-personalized one.

Then produce THREE things. (1) research_brief: a JSON array of 5 to 8 SHORT fact strings; strongest RECENT trigger first, each noting why it matters operationally, and include the event's date or year when known. (2) email_body: a cold email FROM Justin, written like a LOGISTICS OPERATOR, NOT a marketer. Open with the strongest recent trigger (or the honest fallback), tie it to a SPECIFIC, believable West Coast inventory/overflow pain (no generic 'fluctuating inventory' lines), pitch conditionally (if they are hitting overflow in the LA area, we run flexible month-to-month space for exactly that), state the all-in pricing (one all-in monthly rate, no NNN surprises, no long-term commitments), and end with ONE short low-friction question asking for INTEREST not a meeting. (3) email_subject: 3 to 6 words, sentence case or lowercase, plain operator tone. NO title case, no colon, no company name, no marketing nouns like 'Needs', 'Solutions', or 'Opportunity'. Good: 'west coast overflow space', 'overflow space in the LA area', 'flexible space for peak'. Bad: 'Flexible Overflow Warehouse Space for Joneca's Expansion Needs'.

MATCH THE TONE AND STRUCTURE OF THESE TWO EXAMPLES EXACTLY (do not reuse their facts): EXAMPLE A: Saw your recent expansion into the 500k sq ft facility in South Carolina. When importers spin up a big East Coast hub, balancing West Coast inventory gets volatile and overflow space becomes a headache. If you are hitting seasonal swings in the LA area, we run flexible month-to-month warehouse space built for exactly that. Our rate is all-in, one monthly number covering space, utilities, CAM, property taxes, security, and maintenance. No NNN surprises and no long-term commitments. Worth a brief chat to see how other importers use us for West Coast overflow? Best, Justin EXAMPLE B: Saw you just rolled out the new 100Hz office monitor line. Adding SKUs like that usually means carrying more inventory alongside everything you are already importing, and West Coast storage gets tight fast heading into peak. If you are hitting overflow in the LA area, we run flexible month-to-month warehouse space built for exactly that. Our rate is all-in, one monthly number covering space, utilities, CAM, property taxes, security, and maintenance. No NNN surprises, no long-term commitments. Worth a brief chat to see how other electronics importers handle West Coast overflow with us? Best, Justin

VOICE: plain, direct, operator to operator. Short sentences. Write at a 5th-grade reading level. Keep most sentences under 12 words, one idea each. Break any long sentence into two. Use the simplest word that works: use not utilize, help not facilitate, near not in close proximity to, about not approximately. Cut any word that does not change the meaning. No jargon. Aim Flesch-Kincaid 60+. Write as 'we'. VOCABULARY RULE: NEVER use the word 'lease' in any form. Say 'no long-term commitments'. HARD RULES: no specific Cubework city/facility and no drive-time/distance claim (keep location general: LA area, Southern California, West Coast). PUNCTUATION: use only periods, commas, and question marks. Do NOT use any dash character to join clauses (no long dash, no short dash, no double hyphen). Rewrite with a period or comma instead. No bulleted or numbered lists. No hype, no exclamation points. Do NOT use: 'I hope this finds you well', 'I wanted to reach out', 'just checking in', 'circle back', 'follow up', 'leverage', 'synergy', 'elevate', 'streamline', 'fast-paced', 'I understand the importance of', 'ideal for', 'I would be happy to discuss', 'if this aligns with your', 'impressive', 'providing a predictable', 'solutions', 'often lead to fluctuating inventory', 'new product introductions often', 'rapid expansion', 'often leads to increased', 'strain existing warehouse capacity', 'designed specifically for', 'designed for', 'such situations', 'ramp up production', 'ramp up production and distribution', 'increased production and distribution demands', 'can become challenging', 'managing West Coast inventory', 'next stage of expansion', 'support your next stage'. Keep it roughly 60 to 80 words. Sign it exactly: Best, Justin. Return ONLY minified JSON, no prose and no code fences: {"research_brief":["fact","fact"],"email_subject":"...","email_body":"..."}`;
const candidate = JSON.stringify({ company:b.company, domain:b.domain, industry:b.industry, location:b.location });
// --- Category dial: derive group + fit from industry, inject a category module (master prompt above untouched) ---
const GROUPS = {
  logistics:{group:'Logistics & 3PL',fit:'High',angle:'win or lose a contract and the footprint swings overnight; month-to-month lets them scale up for a new account or hand space back when one ends, no long lease',pain:'sudden contract wins or losses forcing fast space changes',research:'new client wins, new lanes or DCs, hiring spikes, contract announcements'},
  importers:{group:'Importers & Distributors',fit:'High',angle:'container volume is never steady; take overflow space for a surge and drop it when the containers clear, no NNN, no long lease',pain:'import and seasonal surges and buffer inventory',research:'new supplier or retail partnerships, import volume, port or seasonal surges, expansion'},
  apparel:{group:'Apparel & Textiles',fit:'High',angle:'every season is a new inventory wave; flex space with the collections, expand for the drop and shrink after',pain:'seasonal collection swings and high SKU turnover',research:'new collection or season launches, retail partnerships, DTC growth'},
  furniture:{group:'Furniture, Home & Building Materials',fit:'High',angle:'bulky inventory eats space fast and demand is lumpy; size space to the project or season instead of a long lease on the peak footprint',pain:'bulky goods and lumpy or project-based demand',research:'new product lines, showroom or retail expansion, project pipelines'},
  retail:{group:'Retail & E-commerce',fit:'High',angle:'Q4 needs triple the January footprint; balloon for peak and give space back after, stop paying for empty air',pain:'peak-season swings and fulfillment overflow',research:'store or SKU expansion, holiday ramp, fulfillment moves'},
  electronics:{group:'Electronics & Tech Hardware',fit:'Medium',angle:'product cycles and import waves make inventory spiky; flexible month-to-month space matches launches without a long lease',pain:'launch-driven and import-driven inventory spikes',research:'new product launches, import volume, distribution expansion'},
  food:{group:'Food, Beverage & Agriculture',fit:'Medium',angle:'seasonal and harvest swings suit flexible space, but only for dry or shelf-stable goods since our space is ambient, not cold',pain:'seasonal or harvest buffer for dry goods',research:'seasonal or harvest cycles, new distribution; confirm dry goods not refrigerated'},
  industrial:{group:'Industrial, Auto & Manufacturing',fit:'Mixed',angle:'month-to-month overflow fits the distribution, parts and packaging side, not fixed production plants',pain:'parts or aftermarket distribution and regional overflow',research:'parts or aftermarket distribution, new regional hubs; avoid fixed-plant manufacturers and hazmat'},
  sporting:{group:'Sporting, Health & Leisure',fit:'High',angle:'seasonal demand and DTC inventory swing hard; flexible space scales with peak season',pain:'seasonal peaks and DTC inventory',research:'seasonal peaks, DTC or retail growth, new product lines'},
  medical:{group:'Medical & Devices',fit:'Medium',angle:'device distributors fit month-to-month overflow; care providers usually do not need warehouse',pain:'medical device distribution overflow',research:'device distribution or 3PL needs; skip pure care providers'},
  lowfit:{group:'Low-fit (services)',fit:'Low',angle:'flexible month-to-month warehouse space in the LA area if they ever need overflow',pain:'',research:'only if a logistics, goods or fulfillment arm exists'},
  general:{group:'General',fit:'Medium',angle:'flexible month-to-month warehouse space near the LA and Long Beach ports for overflow or seasonal needs, no long lease',pain:'overflow and seasonal inventory swings',research:'expansion, new facilities, hiring, partnerships, seasonal ramps'}
};
const IND2GRP = {
 'logistics & supply chain':'logistics','transportation/trucking/railroad':'logistics','package/freight delivery':'logistics','warehousing':'logistics','maritime':'logistics',
 'wholesale':'importers','consumer goods':'importers','import & export':'importers','distributors':'importers',
 'apparel & fashion':'apparel','textiles':'apparel',
 'furniture':'furniture','building materials':'furniture','household durables':'furniture','glass, ceramics & concrete':'furniture',
 'retail':'retail','specialty retail':'retail','consumer services':'retail',
 'electrical/electronic manufacturing':'electronics','consumer electronics':'electronics','semiconductors':'electronics','computer hardware':'electronics','telecommunications':'electronics',
 'food production':'food','food & beverages':'food','farming':'food',
 'mechanical or industrial engineering':'industrial','automotive':'industrial','machinery':'industrial','packaging & containers':'industrial','plastics':'industrial','paper & forest products':'industrial','oil & energy':'industrial','mining & metals':'industrial','chemicals':'industrial','facilities services':'industrial',
 'sporting goods':'sporting','health, wellness & fitness':'sporting','sports':'sporting',
 'medical devices':'medical','medical practice':'medical','hospital & health care':'medical',
 'information technology & services':'lowfit','design':'lowfit','music':'lowfit','entertainment':'lowfit','financial services':'lowfit','venture capital & private equity':'lowfit','publishing':'lowfit','investment management':'lowfit','individual & family services':'lowfit'
};
const FIT_RULE = {
 High:'Lead the email with the strongest recent trigger and tie it directly to the pain noted above. Month-to-month flexible space is the central offer. Confident and specific.',
 Medium:'Open with the strongest recent trigger. Present month-to-month flexible space as a strong supporting point, not the entire pitch.',
 Mixed:'From your web research, decide if this company is distribution, parts or 3PL oriented, or a fixed-plant manufacturer that owns and controls its building. If distribution oriented, treat as Medium and use the overflow angle. If fixed-plant, keep it generic and soft and do not push month-to-month hard.',
 Low:'This is a WEAK FIT (likely a services or no-warehouse business). Do NOT pitch hard or oversell. Write a SHORT, honest, no-pressure email of 2 to 4 sentences that simply introduces Cubework flexible month-to-month warehouse space in the LA area and invites them to keep us in mind if they ever need overflow or flexible space. The goal is gentle awareness, not conversion. Keep research_brief to 2 or 3 short facts. Still sign Best, Justin.'
};
const key = IND2GRP[String(b.industry||'').toLowerCase().trim()] || 'general';
const grp = GROUPS[key];
const MODULE = '\n\n=== CATEGORY GUIDANCE (this prospect) ===\nGroup: '+grp.group+' | Fit: '+grp.fit+'\nMonth-to-month angle for this group: '+grp.angle+'\n'+(grp.pain?('Specific pain to tie month-to-month to: '+grp.pain+'\n'):'')+'Prioritize this trigger in web research: '+grp.research+'\n\nFIT INSTRUCTION ('+grp.fit+'): '+FIT_RULE[grp.fit]+'\n\n=== OUTPUT: ONE SHARED BODY + 4 HOOKS (this overrides the single-email output format above) ===\n Output ONLY minified JSON with these keys: research_brief (array of 5 to 8 short fact strings, strongest recent trigger first), confidence (integer 0-100; high only when you have a REAL specific personalization, low when you only have the universal angle), confidence_reason (one short line naming what drove it), body (the SHARED body that comes AFTER the opening line and is identical for every variant: first, a single real personalization sentence ONLY if you have a verified specific fact, otherwise skip it entirely and do not fake one; then the value pitch for flexible month-to-month space, one all-in monthly rate, no NNN and no long lease; then ONE short low-friction question asking for interest not a meeting; then a line break and exactly: Best, Justin), and hooks (an array of EXACTLY 4 objects, each with keys style, subject, opener). The 4 style values are mismatch, forced-bet, freedom, commitment. For EVERY hook the SUBJECT must pair a REAL specific with a small tension twist. The REAL specific is REQUIRED on ALL 4 subjects and always comes first, so the personalization is NEVER missing from any subject. Prefer a verified recent fact when you have one (for example a new DC, a funding round, a new region); when you do not have a verified fact, fall back to their category as the specific (for example home textiles or west coast importing) so a real specific is still present. NEVER a bare generic line like need space or flexible space. lowercase, plain, no hype, no exclamation, no dash characters. The OPENER is the first sentence of the email and must match that same subject angle, then hand into the shared body. The four twists: mismatch = their volume changes but a lease cannot; forced-bet = a lease makes them commit to space they cannot predict; freedom = only pay for the space they actually use, it shrinks in slow months; commitment = the value without a 5-year lease. Keep the whole email (opener plus body) roughly 60 to 80 words and obey ALL the email rules above. Do NOT output email_subject or email_body keys.';
const requestBody = {
  model: 'claude-sonnet-4-6',
  max_tokens: 2048,
  system: sys + MODULE,
  messages: [ { role:'user', content:'Company to research:\n'+candidate } ],
  tools: [ { type: 'web_search_20250305', name: 'web_search', max_uses: 5 } ]
};
return [{ json: { id:b.id, company:b.company, domain:b.domain, group: grp.group, fit: grp.fit, requestBody } }];

// ===== "Build Firestore patch" =====
const ctx = $('Build Claude request').item.json;
let parsed = {};
try {
  const blocks = $json.content || [];
  const raw = Array.isArray(blocks) ? blocks.filter(x=>x&&x.type==='text').map(x=>x.text).join('\n') : '';
  const m = raw.match(/\{[\s\S]*\}/);
  parsed = JSON.parse(m ? m[0] : raw);
} catch(e){ parsed = {}; }
const dedash = s => String(s==null?'':s).replace(/\s*[\u2014\u2013]\s*/g, ', ').replace(/\s--\s/g, ', ');
const now = new Date().toISOString();
const S = v => ({ stringValue:(v==null?'':String(v)) });
const shared = dedash(parsed.body || '');
const hooks = Array.isArray(parsed.hooks) ? parsed.hooks : [];
// assemble one full draft per hook: aligned opener + shared body
let variants = hooks.slice(0,4).map(h => ({
  style: String((h&&h.style)||''),
  subject: dedash((h&&h.subject)||''),
  body: (dedash((h&&h.opener)||'') + (shared ? ('\n\n'+shared) : '')).trim()
}));
// fallbacks: old full-variant shape, or a single email
if (!variants.length && Array.isArray(parsed.variants)) variants = parsed.variants.slice(0,4).map(v=>({style:String((v&&v.style)||''),subject:dedash(v&&v.subject||''),body:dedash(v&&v.body||'')}));
if (!variants.length && (parsed.email_subject||parsed.email_body)) variants = [{style:'default',subject:dedash(parsed.email_subject||''),body:dedash(parsed.email_body||'')}];
const v0 = variants[0] || { subject:'', body:'' };
// --- readability + length signal on the active draft (v0) ---
function _syl(w){ w=String(w).toLowerCase().replace(/[^a-z]/g,''); if(!w) return 0; if(w.length<=3) return 1;
  w=w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/,'').replace(/^y/,''); const m=w.match(/[aeiouy]{1,2}/g); return m?m.length:1; }
function _flesch(t){ const s=(String(t).match(/[.!?]+/g)||[]).length||1; const ws=String(t).match(/[A-Za-z]+(?:'[A-Za-z]+)?/g)||[];
  const wc=ws.length||1; const sy=ws.reduce((a,w)=>a+_syl(w),0)||1; return 206.835-1.015*(wc/s)-84.6*(sy/wc); }
const _words=(String(v0.body||'').match(/[A-Za-z]+(?:'[A-Za-z]+)?/g)||[]);
const _wc=_words.length;
const _fl=Math.round(_flesch(v0.body||''));
const variantsFs = { arrayValue:{ values: variants.map(v => ({ mapValue:{ fields:{ style:S(v.style), subject:S(v.subject), body:S(v.body) } } })) } };
const fields = {
  company:S(ctx.company), domain:S(ctx.domain),
  research_brief:S(Array.isArray(parsed.research_brief) ? parsed.research_brief.join('\n') : (parsed.research_brief||'')),
  email_subject:S(v0.subject), email_body:S(v0.body),
  email_variants: variantsFs,
  prospect_group:S(ctx.group||''), prospect_fit:S(ctx.fit||''),
  draft_confidence:{ integerValue: String(Math.round(Number(parsed.confidence)||0)) }, confidence_reason:S(parsed.confidence_reason||''),
  body_words:{ integerValue: String(_wc) }, body_flesch:{ integerValue: String(_fl) },
  researched_at:{ timestampValue: now }
};
const mask = ['company','domain','research_brief','email_subject','email_body','email_variants','prospect_group','prospect_fit','draft_confidence','confidence_reason','body_words','body_flesch','researched_at'].map(f=>'updateMask.fieldPaths='+f).join('&');
return [{ json: { id:ctx.id, mask, fsBody:{ fields } } }];
