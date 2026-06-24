# 30d — Launch Outreach

## The task
*(Couldn't pull this from the app — Firestore is locked to the email allowlist, so the read returns 403. Paste the task's entries here and I'll fold them in.)*

## Industries outreach — what's done so far

**Built the whole outreach pipeline** (Apollo → Do or Wait "📧 Outreach" tab). Nothing is auto-emailed; drafts wait for review.

- **Source data:** Christine's workbook (S&P / Panjiva import records), importers tab → qualified to California-first, multiple industries, TEU 150–10,000.
- **Batches run through Apollo (workflow 12):**
  - Batch 1 — CA core-fit: Household Durables, Specialty Retail, Apparel, Leisure (~139 companies).
  - Batch 2 — CA Distributors + Trading Companies (~125 companies).
- **Per company the pipeline:** Apollo People Search (free) → picks 1–2 warehousing-title contacts → reveals email (1 credit; phones off until reply) → OpenAI scores + drafts an opener from the real firmographics → writes a rich prospect doc to Firestore. No score gate — every qualified company is written; tier is just a label.
- **Research/personalize agent (workflow 13):** the 🔎 button runs live web research + a personalized, house-style email (logistics-operator voice, value-led, no "lease", ~90–120 words) and patches it onto the prospect.
- **Outreach tab UI:** spreadsheet-style table overlaid live from Firestore; filters by industry / status / sort (defaults to "has email"); row → detail modal with company intel, research brief, draft email (open-in-email / copy), editable status, and an ✕ Invalid flag to prune bad-fits.
- **Guardrails:** California-first to conserve Apollo credits; manual-send model (no Mail.Send scope needed).

## New vertical in progress
- **Korean LA Fashion District** (batch 3) — hybrid Apollo discovery + in-person floor scout, scout-first before spending reveal credits. See `korean-fashion-district-plan.md`.

## Next
- Run Apollo discovery for the Fashion District batch.
- Business cards being ordered (Kuan).
