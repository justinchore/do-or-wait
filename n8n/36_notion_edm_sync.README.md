# Workflow 36 — Notion eDM MQL Sync (Do or Wait → Notion, one-way)

Marketing hands eDM-sourced MQLs to Sales via a Notion database ("👤 eDM MQL
Recording & Tracking", under Brand Marketing → eDM Lifecycle Hub). Sales was
expected to keep that row's **Handoff Status** and **Outreach History** fields
current by hand as the lead gets worked — duplicate manual entry on top of
what's already logged in Do or Wait for every touch. This workflow removes
that duplicate step: Do or Wait stays the one place Justin/Lucy actually work
leads, and this pushes the current state into Notion on a schedule.

**Direction is one-way: Do or Wait → Notion.** Nothing here creates or reads
back from Do or Wait. New MQLs still have to already exist as Do or Wait leads
(matched by email) for this to find them — it does not create leads.

**Currently only ~3 of ~200 Do or Wait leads have a matching Notion row** (this
sheet is scoped to eDM-sourced MQLs specifically, not every lead) — driving the
loop from Notion's small row count (rather than scanning all Do or Wait leads)
keeps each poll cheap regardless of how large Do or Wait's `leads` collection
gets.

## How it works

**Every day at 5pm** (schedule trigger) → **Query Notion eDM MQL database**
(POST to Notion's database-query endpoint, filtered to rows with a non-empty
Email) → **Flatten Notion rows** (Code node — Notion's query response comes
back as one item with a `results[]` array; this fans it out to one n8n item
per row: `pageId`, `email`, `notionName`) → **Query Firestore lead by email**
(Firestore `runQuery` against `leads`, exact match on `email` — same
credential/pattern as workflow 32's dedupe check and workflow 35's lookup) →
**Build sync payload** (Code node — matches each Notion row to its Firestore
result by array position, same `$input.all()` / parallel-array pattern as
workflow 32's "Check Match", written that way specifically to avoid the
first-item-only bug found live in that workflow on 2026-08-11) → **Lead found
in Do or Wait?** (IF) → **Update Notion page** (PATCH, only when matched) or
**Skip** (no-op, no error — most Notion rows *won't* match today, that's
expected, see above).

### Field mapping

`stage` (Do or Wait) → `Handoff Status` (Notion select):
| Do or Wait `stage` | Notion `Handoff Status` |
|---|---|
| `lead` / `tour` / `proposal` / `negotiation` | `BD Following Up` |
| `executed` | `Converted to SQL` |
| `dead` | `Lost/No Need` |

`Pending Handoff` / `Handed to BD` are left alone — those precede a lead
existing in Do or Wait at all, so this workflow never writes them.

`entries[]` (Do or Wait, excluding `kind:'note'` internal-only entries) →
`Outreach History` (Notion text field): rendered newest-first as
`YYYY-MM-DD [kind/dir] text`, capped at ~1900 chars (Notion rich_text elements
cap at 2000) with older entries truncated with a note rather than erroring.

**This is a full-overwrite mirror, not an append-only log.** Every poll
recomputes both fields from Do or Wait's current `entries[]`/`stage` and
replaces Notion's values outright — no cursor/sync-marker field was added to
the `leads/{id}` schema for this. Do or Wait is already the source of truth,
so re-deriving from it each run can't drift the way an append-with-cursor
approach could if a run were ever skipped or re-ordered. Tradeoff: if someone
manually edits Handoff Status or Outreach History directly in Notion, the next
poll overwrites it — this only works if Notion is treated as read-only output
for these two fields from here on.

### Known issue, fixed live 2026-08-26 — duplicate-lead matching

First real test run surfaced a bug: Robb Williams / Corporate Storage has a
stale **archived** duplicate lead in Do or Wait (`l17851637992140`, created
7/27, one stray "Calling" entry — a leftover from before the real lead
`l17861199203502h`, created 8/7, took over) with the *same email*. The
Firestore query originally ran with `limit: 1`, and Firestore returned the
archived duplicate instead of the active lead — Robb's Notion Outreach History
got overwritten with "Calling" instead of his real history, even though his
Handoff Status happened to compute correctly by coincidence (both leads had
`stage: 'lead'`).

**Resolution (same day, per Justin): fix the data, not the workflow.**
A same-day first fix widened the query to `limit: 5` with a
prefer-non-archived/most-recent tiebreaker in code — but Justin's call was
that this workflow shouldn't grow duplicate-tolerance logic to paper over a
data problem, so that was reverted. Instead, the actual duplicate was cleaned
up directly in Do or Wait: the archived duplicate (`l17851637992140`) was
marked `stage: 'dead'`, `dead_reason: 'Duplicate Lead'`, and
`merged_into_lead_id` pointing at the real lead (matching this project's own
established convention for handling duplicates, e.g. the 5 legacy leads
`CLAUDE.md` describes as `"duplicate - merged into X"` from the 2026-08-07
stage migration) — and its one real entry (a 7/27 "Calling" call, the actual
first contact with Robb, predating the second lead's first-touch email) was
merged into the surviving lead's `entries[]` so that history isn't lost. **The
bad Notion write was manually corrected** for Robb Williams' row directly.
The query in this workflow stays a plain `limit: 1` exact-match lookup, same
as it started.

## Setup (not yet imported — nothing here has run live)

1. **Create a Notion internal integration.** Go to
   [notion.so/my-integrations](https://www.notion.so/my-integrations) → New
   integration → give it a name (e.g. "Do or Wait Sync") → Internal → copy the
   generated secret.
2. **Share the database with that integration.** Open the "👤 eDM MQL
   Recording & Tracking" database in Notion → `...` menu (top right) →
   Connections → add the integration by name. Notion's API returns 404 for an
   unshared database even with a valid token — this step is easy to miss.
3. **New n8n credential needed.** In n8n, create a **Notion API** credential
   named `Notion_n8n`, paste in the integration secret from step 1.
4. **Rebind both HTTP Request nodes currently pointing at a placeholder
   credential** ("Query Notion eDM MQL database" and "Update Notion page") to
   the new `Notion_n8n` credential — the JSON as committed has
   `id: "REPLACE_ME"` on both, which will fail to authenticate until rebound.
5. Confirm `Firebase_SDK_do_or_wait` (already bound by id, same as every other
   workflow here) has Firestore **read** access — this workflow only reads via
   `runQuery`, doesn't write, so no new Firestore permission should be needed,
   but worth confirming given workflow 32's README flagged this as unverified
   the first time anything asked this credential to read rather than write.
6. Import as a **new** workflow (own schedule trigger, no webhook path, no
   conflict with anything else active).
7. Activate.
8. **Live test before trusting it:** pick one of the 3 leads currently in both
   systems, manually log a test update on it in Do or Wait, run this workflow
   once manually in n8n (▶ button, not waiting for the schedule), and confirm
   the matching Notion row's Handoff Status/Outreach History updated as
   expected. Then check a Notion row that has *no* Do or Wait match and
   confirm it's left untouched (not blanked, not errored).

## Design notes / tradeoffs

- **No back-fill / lead-creation direction.** Justin confirmed (2026-08-26)
  this only needs to go one way — Do or Wait is already the system leads get
  worked in, and new eDM MQLs land in Notion first by marketing's own process,
  not through this workflow.
- **Poll-based, not real-time.** Runs once daily rather than on a tight poll interval, since this is a status mirror, not something anyone watches live. Chosen over a Firestore-write-triggered
  webhook for the same reason workflow 10 (Renewals Sync) and others in this
  project default to schedule triggers — fewer moving parts, no new Cloud
  Function to maintain, and a once-daily refresh is plenty for a status
  mirror nobody is watching live.
- **Matching is exact-email only**, same tradeoff workflow 32 made for the
  Yardi dedupe check (a fuzzy-name match already caused a real false positive
  there — see that workflow's README). A Notion row with a typo'd or missing
  email simply never matches; nothing here surfaces that as an error today.
