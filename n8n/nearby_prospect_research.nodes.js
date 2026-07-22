// Paste-ready Code-node JS for n8n workflow 26 (Nearby Prospect Research & Draft).
// Companion to 26_nearby_prospect_research.json -- copy each block into the
// matching node's "JavaScript Code" field.
//
// Forked from workflow 13 (Outreach's Research & Personalize). Same Claude
// web-search research + 4-hook draft engine, same voice/tone master prompt,
// same output field names (research_brief, email_variants, draft_confidence,
// confidence_reason, prospect_group, prospect_fit, body_words, body_flesch)
// so the app can reuse the exact same modal-rendering code (VARLABEL, variant
// tabs, confidence chip) that Outreach already has. Two things changed from
// wf13: (1) input fields are site_outreach's own shape (name/website/
// search_category/google_category/address/city/state) instead of Apollo's
// (company/domain/industry/location); (2) the category-fit map (GROUPS) is
// keyed off Nearby Prospects' own 9 discovery categories instead of wf13's
// broad Apollo-industry taxonomy, since every business here was already
// pre-filtered into a warehouse-relevant category by the discovery search.
// Writes to site_outreach/{id}, not outreach/{id}.
// -----------------------------------------------------------------------

// ===== NODE "Build Claude request" ========================================
const b = $json.body || $json;
const today = new Date().toISOString().slice(0, 10);
const sys = `You are a sales research assistant for Cubework, which offers flexible month-to-month warehouse space across the Los Angeles area and Southern California, well positioned for port-driven import traffic, with the ability to scale a customer across more than one site. It is built for overflow and seasonal inventory. Cubework uses simple license agreements, NOT leases. ALL-INCLUSIVE pricing is the key differentiator: one monthly rate covers space, utilities, CAM, property taxes, security, and maintenance, so customers avoid NNN add-ons. Sell TOTAL COST OF OCCUPANCY, not base rent.

TODAY'S DATE IS ${today}. Use it to judge recency. Research the company on the web using its name and website: what they sell, size and operations, and especially any TRIGGER EVENT.

RECENCY RULE (hard): a trigger only counts if it happened within 12 MONTHS of today's date above. Before using any event, find its date. If it is older than 12 months, it is NOT recent. Do NOT open with it and NEVER call an old event 'recent' (e.g. never write 'Saw your recent partnership' about a 2-3 year old deal). If you cannot verify a dated event within the last 12 months, treat it as NO TRIGGER and use the HONEST FALLBACK opener. Never imply a date you did not verify.

RANK trigger strength and use the STRONGEST recent one. STRONG: new or expanded facility/DC, funding round, rapid hiring, entering a new region or market, major new retail or distribution partnership, clear volume growth. WEAK: a single product launch, an award, a rebrand. Only use a weak trigger if it is recent AND you can tie it to REAL added volume with a concrete link, never a hand-wavy generality.

TONE FILTER (critical): only ever reference POSITIVE or NEUTRAL events such as expansion, a new facility, funding, hiring, a new product line, a new market or region, a partnership, or an award. NEVER mention anything negative or sensitive: no lawsuits, settlements, recalls, fines, regulatory or compliance problems, layoffs, closures, bankruptcies, data breaches, or any bad press. If the only recent news is negative, IGNORE it and use the HONEST FALLBACK opener. Never put the prospect in a bad light.

NO PRODUCT RECAP (hard): never list, quote, or enumerate the company's product names, brands, or catalog, and do not paste phrases from their website. Naming their general category once (e.g. 'a kitchen-appliance maker') is fine; listing products is not.

ANTI-FAKE-PERSONALIZATION: do not name a fact just to look personalized. The link between the trigger and a warehousing pain must be SPECIFIC and non-obvious. If the only link is generic (such as 'growth leads to more demand which can strain capacity'), do NOT write it.

HONEST FALLBACK opener: when there is no recent, specific, positive trigger, do NOT force one. Open with ONE honest, direct sentence aimed at their category and size about flexible month-to-month overflow space in the LA area, then go to pricing and the ask. A short honest email beats a fake-personalized one.

Then produce THREE things. (1) research_brief: a JSON array of 5 to 8 SHORT fact strings; strongest RECENT trigger first, each noting why it matters operationally, and include the event's date or year when known. (2) email_body: a cold email FROM Justin, written like a LOGISTICS OPERATOR, NOT a marketer. Open with the strongest recent trigger (or the honest fallback), tie it to a SPECIFIC, believable West Coast inventory/overflow pain (no generic 'fluctuating inventory' lines), pitch conditionally (if they are hitting overflow in the LA area, we run flexible month-to-month space for exactly that), state the all-in pricing (one all-in monthly rate, no NNN surprises, no long-term commitments), and end with ONE short low-friction question asking for INTEREST not a meeting. (3) email_subject: 3 to 6 words, sentence case or lowercase, plain operator tone. NO title case, no colon, no company name, no marketing nouns like 'Needs', 'Solutions', or 'Opportunity'. Good: 'west coast overflow space', 'overflow space in the LA area', 'flexible space for peak'. Bad: 'Flexible Overflow Warehouse Space for Joneca's Expansion Needs'.

MATCH THE TONE AND STRUCTURE OF THESE TWO EXAMPLES EXACTLY (do not reuse their facts): EXAMPLE A: Saw your recent expansion into the 500k sq ft facility in South Carolina. When importers spin up a big East Coast hub, balancing West Coast inventory gets volatile and overflow space becomes a headache. If you are hitting seasonal swings in the LA area, we run flexible month-to-month warehouse space built for exactly that. Our rate is all-in, one monthly number covering space, utilities, CAM, property taxes, security, and maintenance. No NNN surprises and no long-term commitments. Worth a brief chat to see how other importers use us for West Coast overflow? Best, Justin EXAMPLE B: Saw you just rolled out the new 100Hz office monitor line. Adding SKUs like that usually means carrying more inventory alongside everything you are already importing, and West Coast storage gets tight fast heading into peak. If you are hitting overflow in the LA area, we run flexible month-to-month warehouse space built for exactly that. Our rate is all-in, one monthly number covering space, utilities, CAM, property taxes, security, and maintenance. No NNN surprises, no long-term commitments. Worth a brief chat to see how other electronics importers handle West Coast overflow with us? Best, Justin

VOICE: plain, direct, operator to operator. Short sentences. Write at a 5th-grade reading level. Keep most sentences under 12 words, one idea each. Break any long sentence into two. Use the simplest word that works: use not utilize, help not facilitate, near not in close proximity to, about not approximately. Cut any word that does not change the meaning. No jargon. Aim Flesch-Kincaid 60+. Write as 'we'. VOCABULARY RULE: NEVER use the word 'lease' in any form. Say 'no long-term commitments'. HARD RULES: no specific Cubework city/facility and no drive-time/distance claim (keep location general: LA area, Southern California, West Coast). PUNCTUATION: use only periods, commas, and question marks. Do NOT use any dash character to join clauses (no long dash, no short dash, no double hyphen). Rewrite with a period or comma instead. No bulleted or numbered lists. No hype, no exclamation points. Do NOT use: 'I hope this finds you well', 'I wanted to reach out', 'just checking in', 'circle back', 'follow up', 'leverage', 'synergy', 'elevate', 'streamline', 'fast-paced', 'I understand the importance of', 'ideal for', 'I would be happy to discuss', 'if this aligns with your', 'impressive', 'providing a predictable', 'solutions', 'often lead to fluctuating inventory', 'new product introductions often', 'rapid expansion', 'often leads to increased', 'strain existing warehouse capacity', 'designed specifically for', 'designed for', 'such situations', 'ramp up production', 'ramp up production and distribution', 'increased production and distribution demands', 'can become challenging', 'managing West Coast inventory', 'next stage of expansion', 'support your next stage'. Keep it roughly 60 to 80 words. Sign it exactly: Best, Justin. Return ONLY minified JSON, no prose and no code fences: {"research_brief":["fact","fact"],"email_subject":"...","email_body":"..."}`;
const candidate = JSON.stringify({ company:b.name, website:b.website, category:b.search_category, google_category:b.google_category, address:b.address, city:b.city, state:b.state });

// --- Category dial: derive group + fit from the discovery search_category. This
// list is much smaller than wf13's Apollo-industry taxonomy because Nearby
// Prospects only ever searches 9 pre-chosen warehouse-relevant categories, so
// there's no long tail of unrelated industries to bucket. Master prompt above
// is untouched; this only injects a small appended module. ---
const GROUPS = {
  'importer':{group:'Importers',fit:'High',angle:'container volume is never steady; take overflow space for a surge and drop it when the containers clear, no NNN, no long lease',pain:'import and seasonal surges and buffer inventory',research:'import volume, port activity, new supplier or retail partnerships, expansion'},
  'distribution company':{group:'Distribution',fit:'High',angle:'distribution volume swings with contracts and seasons; month-to-month lets them add space for a surge and hand it back after',pain:'contract-driven and seasonal volume swings',research:'new contracts or clients, new DCs, hiring spikes'},
  'wholesale distributor':{group:'Wholesale',fit:'High',angle:'wholesale volume is lumpy by season and by order size; flex space matches the swings instead of a long lease on peak footprint',pain:'seasonal or bulk-order inventory swings',research:'new product lines, new retail partnerships, seasonal ramps'},
  '3pl logistics company':{group:'3PL & Logistics',fit:'High',angle:'win or lose a client and the footprint swings overnight; month-to-month lets them scale for a new account or hand space back when one ends',pain:'client-driven space swings',research:'new client wins, new lanes or DCs, hiring spikes, contract announcements'},
  'freight forwarder':{group:'Freight Forwarding',fit:'High',angle:'freight volume moves with the shipping calendar; flexible space covers a surge without a long-term footprint',pain:'shipping-calendar-driven volume swings',research:'new trade lanes, volume growth, new offices or partnerships'},
  'ecommerce fulfillment center':{group:'Ecommerce Fulfillment',fit:'High',angle:'Q4 needs triple the January footprint; balloon for peak and give space back after, stop paying for empty air',pain:'peak-season and order-volume swings',research:'new brand clients, holiday ramp, fulfillment network expansion'},
  'trucking company':{group:'Trucking',fit:'Medium',angle:'month-to-month overflow space fits a trucking operation that also needs to stage or store freight, not just yard or parking',pain:'freight staging and overflow storage needs',research:'fleet growth, new routes or contracts, new terminals'},
  'manufacturer':{group:'Manufacturing',fit:'Mixed',angle:'month-to-month overflow fits the distribution, parts, and finished-goods storage side, not a fixed production plant itself',pain:'parts or finished-goods overflow storage',research:'new product lines, distribution expansion; avoid pitching hard to a fixed-plant operation'},
  'moving and storage company':{group:'Moving & Storage',fit:'Medium',angle:'flexible month-to-month space is a natural fit for overflow storage capacity beyond their own facility',pain:'overflow storage capacity',research:'business growth, new locations, storage demand signals'}
};
const FIT_RULE = {
  High:'Lead the email with the strongest recent trigger and tie it directly to the pain noted above. Month-to-month flexible space is the central offer. Confident and specific.',
  Medium:'Open with the strongest recent trigger. Present month-to-month flexible space as a strong supporting point, not the entire pitch.',
  Mixed:'From your web research, decide if this business is distribution, parts, or finished-goods oriented, or a fixed-plant manufacturer that owns and controls its own building. If distribution oriented, treat as Medium and use the overflow angle. If fixed-plant, keep it generic and soft and do not push month-to-month hard.',
  Low:'This is a WEAK FIT. Do NOT pitch hard or oversell. Write a SHORT, honest, no-pressure email of 2 to 4 sentences that simply introduces Cubework flexible month-to-month warehouse space in the LA area and invites them to keep us in mind if they ever need overflow or flexible space. Keep research_brief to 2 or 3 short facts. Still sign Best, Justin.'
};
const key = String(b.category||b.search_category||'').toLowerCase().trim();
const grp = GROUPS[key] || {group:'General',fit:'Medium',angle:'flexible month-to-month warehouse space near the LA and Long Beach ports for overflow or seasonal needs, no long lease',pain:'overflow and seasonal inventory swings',research:'expansion, new facilities, hiring, partnerships, seasonal ramps'};
const MODULE = '\n\n=== CATEGORY GUIDANCE (this prospect) ===\nGroup: '+grp.group+' | Fit: '+grp.fit+'\nMonth-to-month angle for this group: '+grp.angle+'\n'+(grp.pain?('Specific pain to tie month-to-month to: '+grp.pain+'\n'):'')+'Prioritize this trigger in web research: '+grp.research+'\n\nFIT INSTRUCTION ('+grp.fit+'): '+FIT_RULE[grp.fit]+'\n\n=== OUTPUT: ONE SHARED BODY + 4 HOOKS (this overrides the single-email output format above) ===\n Output ONLY minified JSON with these keys: research_brief (array of 5 to 8 short fact strings, strongest recent trigger first), confidence (integer 0-100; high only when you have a REAL specific personalization, low when you only have the universal angle), confidence_reason (one short line naming what drove it), body (the SHARED body that comes AFTER the opening line and is identical for every variant: first, a single real personalization sentence ONLY if you have a verified specific fact, otherwise skip it entirely and do not fake one; then the value pitch for flexible month-to-month space, one all-in monthly rate, no NNN and no long lease; then ONE short low-friction question asking for interest not a meeting; then a line break and exactly: Best, Justin), and hooks (an array of EXACTLY 4 objects, each with keys style, subject, opener). The 4 style values are mismatch, forced-bet, freedom, commitment. For EVERY hook the SUBJECT must pair a REAL specific with a small tension twist. The REAL specific is REQUIRED on ALL 4 subjects and always comes first, so the personalization is NEVER missing from any subject. Prefer a verified recent fact when you have one (for example a new DC, a funding round, a new region); when you do not have a verified fact, fall back to their category as the specific (for example home textiles or west coast importing) so a real specific is still present. NEVER a bare generic line like need space or flexible space. lowercase, plain, no hype, no exclamation, no dash characters. The OPENER is the first sentence of the email and must match that same subject angle, then hand into the shared body. The four twists: mismatch = their volume changes but a lease cannot; forced-bet = a lease makes them commit to space they cannot predict; freedom = only pay for the space they actually use, it shrinks in slow months; commitment = the value without a 5-year lease. Keep the whole email (opener plus body) roughly 60 to 80 words and obey ALL the email rules above. Do NOT output email_subject or email_body keys.';
const requestBody = {
  model: 'claude-sonnet-4-6',
  max_tokens: 2048,
  system: sys + MODULE,
  messages: [ { role:'user', content:'Business to research:\n'+candidate } ],
  tools: [ { type: 'web_search_20250305', name: 'web_search', max_uses: 5 } ]
};
return [{ json: { id:b.id, name:b.name, website:b.website, group: grp.group, fit: grp.fit, requestBody } }];

// ===== NODE "Build Firestore patch" =======================================
const ctx = $('Build Claude request').item.json;
let parsed = {};
try {
  const blocks = $json.content || [];
  const raw = Array.isArray(blocks) ? blocks.filter(x=>x&&x.type==='text').map(x=>x.text).join('\n') : '';
  const m = raw.match(/\{[\s\S]*\}/);
  parsed = JSON.parse(m ? m[0] : raw);
} catch(e){ parsed = {}; }
const dedash = s => String(s==null?'':s).replace(/\s*[—–]\s*/g, ', ').replace(/\s--\s/g, ', ');
const now = new Date().toISOString();
const S = v => ({ stringValue:(v==null?'':String(v)) });
const shared = dedash(parsed.body || '');
const hooks = Array.isArray(parsed.hooks) ? parsed.hooks : [];
let variants = hooks.slice(0,4).map(h => ({
  style: String((h&&h.style)||''),
  subject: dedash((h&&h.subject)||''),
  body: (dedash((h&&h.opener)||'') + (shared ? ('\n\n'+shared) : '')).trim()
}));
if (!variants.length && Array.isArray(parsed.variants)) variants = parsed.variants.slice(0,4).map(v=>({style:String((v&&v.style)||''),subject:dedash(v&&v.subject||''),body:dedash(v&&v.body||'')}));
if (!variants.length && (parsed.email_subject||parsed.email_body)) variants = [{style:'default',subject:dedash(parsed.email_subject||''),body:dedash(parsed.email_body||'')}];
const v0 = variants[0] || { subject:'', body:'' };
function _syl(w){ w=String(w).toLowerCase().replace(/[^a-z]/g,''); if(!w) return 0; if(w.length<=3) return 1;
  w=w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/,'').replace(/^y/,''); const m=w.match(/[aeiouy]{1,2}/g); return m?m.length:1; }
function _flesch(t){ const s=(String(t).match(/[.!?]+/g)||[]).length||1; const ws=String(t).match(/[A-Za-z]+(?:'[A-Za-z]+)?/g)||[];
  const wc=ws.length||1; const sy=ws.reduce((a,w)=>a+_syl(w),0)||1; return 206.835-1.015*(wc/s)-84.6*(sy/wc); }
const _words=(String(v0.body||'').match(/[A-Za-z]+(?:'[A-Za-z]+)?/g)||[]);
const _wc=_words.length;
const _fl=Math.round(_flesch(v0.body||''));
const variantsFs = { arrayValue:{ values: variants.map(v => ({ mapValue:{ fields:{ style:S(v.style), subject:S(v.subject), body:S(v.body) } } })) } };
const fields = {
  research_brief:S(Array.isArray(parsed.research_brief) ? parsed.research_brief.join('\n') : (parsed.research_brief||'')),
  email_subject:S(v0.subject), email_body:S(v0.body),
  email_variants: variantsFs,
  prospect_group:S(ctx.group||''), prospect_fit:S(ctx.fit||''),
  draft_confidence:{ integerValue: String(Math.round(Number(parsed.confidence)||0)) }, confidence_reason:S(parsed.confidence_reason||''),
  body_words:{ integerValue: String(_wc) }, body_flesch:{ integerValue: String(_fl) },
  researched_at:{ timestampValue: now }
};
const mask = ['research_brief','email_subject','email_body','email_variants','prospect_group','prospect_fit','draft_confidence','confidence_reason','body_words','body_flesch','researched_at'].map(f=>'updateMask.fieldPaths='+f).join('&');
return [{ json: { id:ctx.id, mask, fsBody:{ fields } } }];
