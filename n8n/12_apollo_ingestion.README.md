# Workflow 12 — Apollo Ingestion (Household Durables → Google Sheet)

**Status:** ready-to-import, `active:false`. Manual trigger (run on demand per industry). Defaults to a **3-company test run**. **Output goes to a Google Sheet — nothing is written to your Leads board, and nothing is emailed.**

## What it does

For each prospect company it: finds the right warehousing decision-makers in Apollo (free), scores the company with Claude against the Cubework fit rubric, reveals an email **only for Hot/Warm keepers**, drafts an opener, and **appends a row to a Google Sheet** you can go down — call/email/log by hand. No leads created, no sends.

## Node chain

```
Run / Test (manual) → Household Durables input → Loop companies
  → Build people search → Apollo People Search (FREE) → Pick best contacts
  → Build scoring prompt → Score + draft (OpenAI) → Gate + build email reveal
  → Apollo reveal email (1 credit) → Build sheet row → Append to Google Sheet → (loop)
```

`splitInBatches` v3 with the **loop body on output index 1**; `continueOnFail` on the network nodes.

## Credit-smart ordering

Search + scoring are **free**. An Apollo email credit (1 each) is spent only on companies that score **Hot/Warm** — giants tier *Watch* and are dropped *before* any reveal. **Phones are not revealed** (`reveal_phone_number:false`, 8 credits) — that happens later, on reply.

## The Google Sheet (one-time setup)

1. Create a Google Sheet, e.g. **"Apollo Prospects"**, with a tab named **`Household Durables`**.
2. Put this header row in row 1 (the node auto-maps by these names):

   `Company | Contact | Title | Email | Phone | Domain | City | State | TEU | Tier | Score | Why now | Email subject | Email body | LinkedIn | Status | Created`

3. **Share the sheet (Editor) with your service-account email** (the `client_email` in the `Google Service Account — do-or-wait` JSON, ends `@…iam.gserviceaccount.com`), and make sure the **Google Sheets API is enabled** on that GCP project.
4. In the **"Append to Google Sheet"** node: it's pre-set to `authentication: serviceAccount` using your existing Google SA credential. Paste your spreadsheet ID into `documentId` (replace `REPLACE_WITH_SPREADSHEET_ID`), confirm the sheet name, and that the credential is selected. *(After import, resource-locator fields sometimes need a quick re-pick in the node UI — just reselect the document/sheet.)*

## Credentials (2 — both already exist + 1 new Apollo)

- **Apollo API — do-or-wait** *(new)* — `httpHeaderAuth`, header **`X-Api-Key`**, value = your Apollo **master** API key (Settings → Integrations → API; must be a *master* key — the search endpoint rejects regular keys).
- **OpenAI API — do-or-wait** *(new)* — n8n `openAiApi` credential (your OpenAI API key). Powers the scoring + draft node (model `gpt-4o`; swap to `gpt-4o-mini` in "Build scoring prompt" for cheaper volume).
- **Google Service Account — do-or-wait** — reused (writes the sheet).

## How to run

1. Import `12_apollo_ingestion.json`, set the Apollo credential, finish the sheet setup above.
2. **Test (default):** input node has `TEST_DOMAINS = ['flexsteel.com','mylibertyfurniture.com','curtisint.com']` — only those 3 run. **Execute Workflow** → confirm 3 rows append with contact, email, score, and a draft. (~3 email credits.)
3. **Full run:** set `TEST_DOMAINS = []` → re-execute → all 238 domain-ready Household Durables companies.

## Scaling to the next industry

Regenerate the embedded `companies` array for that industry (shape `{c,d,city,st,t}`) and paste into the input node; point the sheet node at a new tab. Everything else is industry-agnostic. (Ask me to generate any industry's array.)

## Moving to the Leads board later

When you're ready to push these into the app (call/text/log + follow-up clock), we swap the last two nodes back to **Build lead doc → Create lead in Firestore** — that code is preserved in `apollo_ingestion.nodes.js` (the "Build lead doc (alt)" block) and in git history. One-step change.

## Phone-on-reply (Phase 1b — not yet built)

When a prospect replies and you want to call, reveal that one phone (8 credits) via a small `people/match` call (`reveal_phone_number:true`) and drop it in the Phone column. Say the word and I'll add it.

## ⚠ Verify on the FIRST test run (Apollo response shapes, built from docs, untested live)

- People Search (`/mixed_people/api_search`) returns hits under **`people[]`** (each with `id`, `title`, `organization`).
- Bulk enrichment = **`/api/v1/people/bulk_match`**, accepts `details:[{id}]`, returns **`matches[]`** with `email` when `reveal_personal_emails:true`.
- Search `people[].id` is accepted by `bulk_match` (name+domain fallback is coded).

If the Email column comes back blank on the test, that's the tell — it's a one-line fix in "Pick best contacts" / "Build sheet row".

## Files
- `12_apollo_ingestion.json` — the workflow (import this).
- `apollo_ingestion.nodes.js` — paste-ready Code-node copies (incl. the Build-lead-doc alt for the board).

Sources: [People API Search](https://docs.apollo.io/reference/people-api-search) · [Bulk People Enrichment](https://docs.apollo.io/reference/bulk-people-enrichment)
