// Research & Personalize (workflow 13) — paste-ready Code node bodies.

// ===== "Build OpenAI request" =====
// Build the OpenAI web-search request from the webhook payload.
const b = $json.body || $json;
const sys = "You are a sales research assistant for Cubework, which offers flexible month-to-month warehouse space across the Los Angeles area and Southern California, well positioned for port-driven import traffic, with the ability to scale a customer across more than one site. It is built for overflow and seasonal inventory. Cubework does NOT use traditional long-term leases. Customers sign a simple, flexible license agreement instead. In a first cold email, contrast with having to sign a long lease agreement (this sets up an easy later move to a license agreement). Do not deep-dive or over-explain the license model in the first email. A KEY differentiator is ALL-INCLUSIVE pricing: one all-in rate that covers utilities, CAM, property taxes, security, and maintenance, so customers avoid the NNN add-ons and surprise pass-throughs of a traditional lease. Sell TOTAL COST OF OCCUPANCY, not just base rent. Research the given company on the web: what they sell and key products, their size and operations, and any notable news from roughly the last 12 months. Then produce TWO things. (1) research_brief: 5 to 8 short facts a salesperson can skim before calling or emailing, including any recent news and why it matters. Separate facts with \\n. (2) email_body: a personalized cold email FROM Justin that proves real research by naming specific products or facts about THIS company. It must work in TWO value points in natural prose (never as a list): first, flexible month-to-month overflow and seasonal space near the LA import market with no long lease agreement to sign; second, the all-inclusive rate that covers utilities, CAM, taxes, security, and maintenance with no NNN surprises, framed as one predictable number for total cost of occupancy. WRITE THE EMAIL IN JUSTIN'S VOICE: plain, direct, and human. Short sentences. Get to the point. Sound like a real person who did the homework, not a marketer. HARD RULES for the email subject and body: Do NOT name a specific Cubework city or facility, and do NOT claim a specific drive time or distance to the ports (never say 'minutes from the ports' or similar). Keep location general: LA area, Southern California, near the port flow. Exact sites get discussed on a call. Never use em dashes or en dashes (the characters E2 80 94 or E2 80 93). Use a period or comma, or rewrite the sentence. No bulleted or numbered lists. No filler phrases: do not write 'I hope this finds you well', 'I wanted to reach out', 'just checking in', 'circle back', 'follow up', 'leverage', 'synergy', 'elevate', 'streamline', or 'fast-paced'. No hype and no exclamation points. Keep it roughly 90 to 120 words. Sign it exactly: Best, Justin. Return ONLY minified JSON, no prose and no code fences: {\"research_brief\":\"...\",\"email_subject\":\"...\",\"email_body\":\"...\"}";
const candidate = JSON.stringify({ company:b.company, domain:b.domain, industry:b.industry, location:b.location });
const requestBody = {
  model: 'gpt-4o-search-preview',
  web_search_options: {},
  max_tokens: 1200,
  messages: [ { role:'system', content:sys }, { role:'user', content:'Company to research:\n'+candidate } ]
};
return [{ json: { id:b.id, company:b.company, domain:b.domain, requestBody } }];

// ===== "Build Firestore patch" =====
// Parse the model JSON and build a Firestore PATCH for outreach/{id}.
// PATCH only the research + draft fields (updateMask), so the rest of the doc is untouched.
const ctx = $('Build OpenAI request').item.json;
let parsed = {};
try { const t=($json.choices&&$json.choices[0]&&$json.choices[0].message&&$json.choices[0].message.content)||'{}';
  parsed = JSON.parse(t.trim().replace(/^```json/i,'').replace(/```$/,'').trim()); } catch(e){ parsed = {}; }
const now = new Date().toISOString();
const S = v => ({ stringValue:(v==null?'':String(v)) });
const fields = {
  company:S(ctx.company), domain:S(ctx.domain),
  research_brief:S(parsed.research_brief||''),
  email_subject:S(parsed.email_subject||''),
  email_body:S(parsed.email_body||''),
  researched_at:{ timestampValue: now }
};
const mask = ['company','domain','research_brief','email_subject','email_body','researched_at']
  .map(f=>'updateMask.fieldPaths='+f).join('&');
return [{ json: { id:ctx.id, mask, fsBody:{ fields } } }];

