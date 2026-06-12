# Workflow 8 — Prospect Finder (DRAFT, not active)

**Status:** draft / ready-to-import. `active:false`. Do **not** turn it on until the data feed (below) is wired — the rest is built and testable today against the stub row.

## What it does

Nightly (cron `0 4 * * *`), scores importers against the `cubework-prospect-finder` rubric and writes the Hot/Warm ones straight into the **`leads`** collection, so they show up on the Leads board next morning as `stage:'cold'`, `is_importer:true`. The score, the "why now," and a drafted opener land in an **initial thread note**, which the app already renders — so this needs **no `index.html` change** to be visible.

## Node chain

```
Nightly 4am → Get import data (STUB) → Port gate + normalize → Loop candidates
  → Build scoring prompt → Score + draft (Claude) → Build lead doc → Create lead in Firestore → (loop)
```

Mirrors the Follow-up Scanner (workflow 6): scheduleTrigger, Firestore via HTTP REST, splitInBatches v3 with the **loop body on output index 1**, `continueOnFail` on the network nodes.

## The one gating dependency — the data feed

The `Get import data (STUB — swap feed)` node currently emits one sample row so the chain runs end-to-end. Replace it with one of:

- **Option A — File drop (mirrors availability sync):** a Microsoft Graph / HTTP node that reads the latest ImportYeti CSV export you drop in SharePoint/OneDrive, plus a small parser to the row shape below. Works with the cheaper export-only ImportYeti plan.
- **Option B — ImportYeti API:** an HTTP Request node hitting the ImportYeti API, mapped to the row shape. Fully hands-off; needs the API tier.

Row shape the rest of the workflow expects (one object per importer):

```
company, category, dest_port, shipments_12m, shipments_total,
supplier_count, hq_city, hq_state, product_desc
```

## Credentials

- **Google Service Account — do-or-wait** — reused from your other workflows (Firestore write). Replace `REPLACE_WITH_CREDENTIAL_ID`.
- **Anthropic API — do-or-wait** — *new*, the one genuinely new ingredient. An `httpHeaderAuth` credential with header name `x-api-key` and your Anthropic key as the value. The node also sends `anthropic-version: 2023-06-01`. Replace `REPLACE_WITH_CREDENTIAL_ID`.

## Dedup / re-run safety

Each lead is created with a deterministic id, `iy-<company-slug>`, via Firestore `createDocument?documentId=`. On re-runs an existing prospect returns `ALREADY_EXISTS` (409) and is skipped (`continueOnFail`), so **your edits and thread notes are never clobbered**. (Re-scoring an existing lead is a deliberate later enhancement, not done here.)

## Leads-schema mapping

Writes: `company`, `segment` (`Importer — <category>`), `is_importer:true`, `stage:'cold'`, `prospect_source`, `prospect_tier`, `prospect_score`, `prospect_dest_port`, `createdAt`, and `entries[]` with one `kind:'note'` brief (score + why-now + buyer + draft opener). No `email` is set — these are fresh prospects, so the Follow-up Scanner correctly ignores them until you add a contact.

## How to test before the feed is live

1. Import `8_prospect_finder.json`, set the two credentials.
2. Run it manually — the stub row flows through; confirm a `iy-sample-patio-co` lead appears on the board with the note.
3. Delete that test lead, then swap the STUB node for the real feed when ready.

## Open follow-ups (when we finalize)

- Decide feed = Option A or B (held pending the ImportYeti trial).
- Optionally surface `prospect_score`/`prospect_tier` as a card badge in `index.html` (small `window.*`-exposed render tweak) instead of only in the note.
- Optionally wire the draft into the app's `pending_email` flow (needs workflow 1's `pending_email` shape) so it renders in the email preview with ✉️ Open-in-email.
