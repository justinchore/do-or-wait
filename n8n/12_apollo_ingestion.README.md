# Workflow 12 — Apollo Ingestion (CA core-fit → Outreach tab)

**Status:** ready-to-import, `active:false`. Manual trigger. Writes to Firestore **`outreach`** (the app's 📧 Outreach tab reads it live). **Nothing is emailed.**

## What it does (per company)

Finds the right warehousing decision-makers in Apollo (free search), **reveals their email**, then scores the company with OpenAI using the *revealed firmographics*, drafts an opener, and writes a rich prospect doc. **No score gate — every qualified company is written** (the CA + TEU qualification already happened when the list was built; tier is just a label).

## Node chain

```
Run / Test → CA core-fit input → Loop companies
  → Build people search → Apollo People Search (FREE) → Pick best contacts
  → Apollo reveal email (1 credit) → Build scoring prompt → Score + draft (OpenAI)
  → Build prospect doc → Create prospect in Firestore → (loop)
```

Enrich-**then**-score (so `timing`/growth are data-driven from real Apollo signals, not guessed). `splitInBatches` v3, loop body on output index 1; `continueOnFail` on the network nodes.

## Credits

- People Search = **free**. Email reveal = **1 credit** per contact; phones are **not** revealed (`reveal_phone_number:false`, 8 credits) — those happen later, on reply.
- We reveal **1–2 contacts per company for every company** (no gate). Full CA batch (139 cos) ≈ **150–280 credits**.

## The list

`CA core-fit input` embeds **139 California companies** across Household Durables, Specialty Retail, Apparel, Leisure Products (TEU 150–10,000; Samsung/Harman dropped). `TEST_DOMAINS` defaults to 3 (`livingspaces.com`, `sceptre.com`, `fashionnova.com`) — clear it (`= []`) to run all 139. To run another batch, regenerate that array (shape `{c,d,city,st,t,ind}`).

## Credentials (re-pick after import)

- **Apollo API** — `httpHeaderAuth`, header `X-Api-Key`, your **master** key → the two Apollo nodes.
- **OpenAI API** — `openAiApi` credential → Score + draft node (model `gpt-4o`).
- **Google Service Account** — your scoped service-account credential (`Firebase_SDK_do_or_wait`, datastore scope) → Create prospect in Firestore.

## How to run

1. Delete the old workflow 12, **re-import** this JSON, **re-select the 3 credentials** on their nodes.
2. **Execute** — runs the 3-company test. Open them in the Outreach tab modal; confirm contact, email, score, draft, and the rich company fields (growth/revenue/funding) populate.
3. Set `TEST_DOMAINS = []` → run all 139.

## ⚠ Verify on first run (Apollo response shapes, built from docs)

- People Search returns hits under `people[]` (each with `id`, `title`, `organization`).
- Bulk enrichment = `/api/v1/people/bulk_match`, accepts `details:[{id}]`, returns `matches[]` with `email` (when `reveal_personal_emails:true`) and a rich `organization` object (employees, founded, revenue, funding, `organization_headcount_*_growth`).
- If the Email column / modal fields come back blank, it's a field-path tweak in **Pick best contacts** / **Build prospect doc** — tell me which field and I'll fix it.

## Files
- `12_apollo_ingestion.json` — import this.
- `apollo_ingestion.nodes.js` — paste-ready Code-node copies.

Sources: [People API Search](https://docs.apollo.io/reference/people-api-search) · [Bulk People Enrichment](https://docs.apollo.io/reference/bulk-people-enrichment)
