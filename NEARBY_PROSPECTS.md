# 📍 Nearby Prospects — how it works

Companion doc to `CLAUDE.md` (see the 2026-07-20 and 2026-07-21 sessions there for the full build/debug history). This file is the plain-English explainer: why the feature exists, how it's built, and how to actually use it day to day.

---

## Why

Every Cubework property sits near dozens of businesses that could plausibly need warehouse/flex industrial space — importers, distributors, 3PLs, fulfillment centers, manufacturers — but nobody had a way to systematically find and reach out to them. Two existing tabs don't cover this gap:

- **📧 Outreach** was built on Apollo (a B2B contact database), but that subscription is now cancelled — it's dead for finding new companies.
- **🏢 Prop Outreach** works from Yardi call-sheet exports of tenants who *already* inquired about a specific property. It's a backlog of existing leads, not a way to discover brand-new nearby businesses that have never contacted Cubework.

**Nearby Prospects fills that gap**: pick a property, click one button, and get a list of real local businesses in target categories — plus, where available, a named contact (not just a phone number) to reach out to. That last part matters: a plain Google Maps search gives you a business's main line, but rarely tells you *who* to actually email.

## How

### The data source: CoreClaw
[CoreClaw](https://coreclaw.com) is a pay-per-result web scraping service. This feature uses its **Google Maps Scraper Worker** (slug `01KPD6M5YQADCQKGVKPDZVYC63`), which searches Google Maps by keyword + location and returns each business's name, address, phone, website, category, and rating.

The key feature is its **leads enrichment** option (`max_leads_per_place`): turning it on adds a named contact per business — full name, job title, LinkedIn profile, and sometimes a work email or mobile number, pulled from LinkedIn-style data. This is what solves the "who do I email" problem. Cost is about **$1.20 per 1,000 successful results** — cheap; a full 9-category run for one property costs a few cents to a dollar or so.

### The pipeline
```
App button click
   → n8n workflow 25 ("Site Outreach Discovery")
      → CoreClaw: submit a scrape run per category (9 categories)
      → poll until each run finishes
      → pull paginated results
      → dedupe by Google's place_id
      → write to Firestore via workflow 20 (generic writer)
   → Firestore collection: site_outreach/{place_id}
   → App tab reads it live and renders it
```

**n8n workflow 25** (`n8n/25_site_outreach_discovery.json`) does the heavy lifting: for each of the 9 search categories (importer, distribution company, wholesale distributor, 3PL logistics company, freight forwarder, ecommerce fulfillment center, trucking company, manufacturer, moving and storage company), it submits a CoreClaw scrape job, waits for it to finish (polling every 15s, capped at 5 minutes per category), pulls the results, and tags each row with which category surfaced it. Once every category is done, everything gets deduped by Google's `place_id` (so re-running discovery on the same property never creates duplicates) and written to Firestore.

**Why it's a safe write, even on repeat runs:** the Firestore write only ever touches the CoreClaw-sourced fields (name, address, contact info, category, etc.) — never `status`, `notes`, `attempts`, or `archived`. So re-discovering a property refreshes the business list without ever wiping out call history or notes you've already logged on a business.

**Firestore collection: `site_outreach/{place_id}`** — one document per business, keyed by Google's real place ID. Fields include the business basics (`name`, `address`, `website`, `phone`, `search_category`, `google_category`, `rating`), the enriched contact (`contact_name`, `contact_title`, `contact_email`, `contact_phone`, `contact_linkedin` — any of these can be blank if CoreClaw didn't find one), and your own tracking fields (`status`, `attempts[]`, `notes`, `archived`, `promoted_lead_id`).

### The app tab
The 📍 Nearby Prospects tab (right after 🏢 Prop Outreach) groups results by property, then by search category, in collapsible cards. Clicking a business opens a detail modal with its contact info, a status dropdown, one-tap call-outcome logging, free-text notes, and a "🎯 Promote to lead" button.

---

## How to use it

**1. Run discovery on a property.**
Open the 📍 Nearby Prospects tab. If the property has no data yet, use the "Discover" dropdown at the top to pick it from your known locations and click **🔎 Discover nearby companies**. If it already has data, expand its card and use the inline **🔎 Re-discover this property** button instead.

This kicks off a real scrape — it takes a few minutes (up to ~5 min per category, run across 9 categories), so the button shows a "this can take a few minutes" note rather than looking stuck. You can leave the tab and check back.

**2. Review the results.**
Once discovery finishes, the property's card fills in with businesses grouped by category (importer, 3PL, manufacturer, etc.). Each row shows the business name and a quick glance at whether a contact was found.

**3. Open a business to see the full picture.**
Click a row to open its detail modal:
- **Website / phone** — click-through links.
- **Contact block** — the named contact CoreClaw found (name, title, email, LinkedIn). If there's a phone but no email, it's shown labeled "direct — no email on file" as your best fallback. If nothing was found at all, it says so plainly rather than guessing.
- **Status dropdown** — mark where things stand (not contacted, attempted, reached, interested, not interested, bad number, do not call, promoted).
- **Log a call** — one-tap buttons for the outcome of an attempt (No answer / Voicemail / Interested / Not interested / Bad number / Do not call). This appends to the business's call history automatically. Logging "Not interested" a **second** time auto-archives the record so it stops cluttering your active list.
- **Notes** — free text for anything worth remembering.
- **Archive/Restore** — manually put a business away (or bring it back) any time, independent of the auto-archive rule above.

**4. Reach out.**
There's no auto-send here — you reach out yourself (email/call/text) using the contact info shown, then log the outcome via the Status dropdown or the Log a call buttons so the record stays current.

**5. Promote a real lead.**
Once a business responds with genuine interest, click **🎯 Promote to lead** in its modal. This creates a real entry on the Leads tab (starting at the `cold` stage, since it's a brand-new relationship) and marks the Nearby Prospects record as promoted, so it's clear it's been converted.

**6. Archived and filtering.**
Use the status filter dropdown to narrow the list (e.g. show only "Interested," or only "Archived" to review what's been put away). The search box filters by name/category text.

---

## Where things stand (as of 2026-07-22)

- CoreClaw account is set up and verified against a real key.
- The workflow's field mapping was originally built from CoreClaw's docs alone (no account existed yet) and had several wrong field names — these were all corrected against real API responses (see `CLAUDE.md`'s 2026-07-21 (cont.) session for the full list of fixes: `place_id` not `cid`, `keywords` as an array not a string, results live at `data.list` not `data`, contact fields come from `leads_enrichment[]`, etc.).
- Three n8n HTTP Request nodes ("Get run detail," "Get results page," "Write via workflow 20") had a Send Body / Specify Body import bug that silently sent empty request bodies — all three were found and fixed directly in the n8n UI.
- A real end-to-end test (single category, Ontario Airport) confirmed 20 correctly-mapped records land in Firestore with working contact/phone/email fields.
- `index.html`'s contact-block display and "Promote to lead" phone fallback were updated to use the verified field names and pushed live.
- **Not yet done:** a full 9-category discovery run (the test so far only ran 1 category) — run this for real whenever you're ready to seed a property's full prospect list.
