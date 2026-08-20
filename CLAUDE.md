# Do or Wait — Project Brief for Claude

> **Note on this file:** This is the condensed, currently-true reference for the project — architecture, current schemas, current n8n/deploy status, current file manifest. The full chronological session-by-session history (detailed narratives, debugging stories, exact code/prompt snippets, superseded designs) has been moved to **`CLAUDE_HISTORY.md`** to keep this file small enough that sessions don't choke on it. When you need the full "why"/"how this was discovered" story behind anything summarized below, or need to recover exact pasted code/prompt text, check that file (it's organized by the same dated session headers referenced below).

## ⏸️ Open items — pick up here first (updated 2026-08-20)

> Full narrative/debugging history for everything below lives in `CLAUDE_HISTORY.md`, organized by the same dated headers. This section is current-state-only.

**Active thread: automating follow-up sending via a batch-approve queue.** Target confirmed with Justin: not full unattended auto-send, a fast human-reviewed batch-approve queue (~30 due leads, review+send in ~2 min). Hard prerequisite is real Outlook thread-continuity (reply into the existing conversation, never a new thread).
- Done: `graphMessageId` now captured in `email_links[]` — workflow 33 (qualifying email, **live-tested twice, confirmed correct**) and workflow 11 (thread resolver, **code-verified, not yet live-tested**). See `leads/{id}` schema below for field detail.
- Not yet built: the actual "send follow-up as a real Graph reply" n8n workflow (`POST /messages/{id}/reply`-family; tentatively workflow 34) — this is the next concrete step. Needs an HTML-newline-conversion step (Graph HTML bodies don't auto-render `\n\n` the way `mailto:` does), then the webhook wiring, then the batch-approve UI itself, then an end-to-end live test, then a safety-gate decision. Build one piece at a time per Justin's preference.

**Follow-up auto-escalation ladder (Nudge → Value → Break-up) — built, master switch OFF, not yet deployed.**
- `FOLLOWUP_AUTO_ESCALATE_ENABLED = false` at the top of the follow-up section gates the whole ladder feature. Flip to `true` + `git push` once tested against a real/dummy lead — while `false`, behavior is identical to pre-2026-08-19.
- Ladder rung is driven by `nextFollowupNum(lead)` (real sent+logged count), resets to 0 on any inbound reply or completed tour (`lastInboundTs`), and stops sending drafts after Break-up + continued silence (shows a Resolve-only prompt instead, via `renderFollowupResolveBlock`/`openFollowupResolve`).
- Independent of that switch (always active, correctness fixes to `isFollowupDue` itself): `isTourPending` suppresses nagging while a tour date is upcoming (tour scheduled is explicitly NOT a permanent stop — "we might need one down the line"); a lapsed `tour_date` anchors `contactInfo()`'s last-contact clock; `FOLLOWUP_STOP_MILESTONES` (agreement-drafted / signed-proposal-uploaded) is a permanent stop regardless of top-level stage; Dead/Executed are permanent stops as before.
- 🚫 No-show tour quick action — **confirmed live in production 2026-08-20** (Justin tested on a real lead).
- Glance fields `last_followup_label`/`last_followup_num`/`last_followup_sent_at` — written by `logFollowupSent()`, shown as a "✉️ Last follow-up" row in the lead detail panel. Pure display mirror, doesn't affect escalation logic.
- Cold-bucket copy fixed: first follow-up now says "Wanted to put Cubework **back** on your radar" (was a repeat cold-intro).
- QA'd this session: 11 automated logic scenarios (Node harness against a real dummy Firestore lead) + a 14-scenario manual browser checklist (`FOLLOWUP_QA_CHECKLIST.md`) — all passed.

**Upcoming Tours strip + tour quick actions (2026-08-17) — built, still needs `git push` to deploy.** `tour_date`/`tour_time` fields, the strip itself, ✅ Toured/🔁 Reschedule/✗ Cancelled actions, and the shared `#stage-resolve-overlay` (🏁 Update stage on follow-up nags) are all done — see "Key functions" below for the function names. Also fixed live in Firestore this thread (no code): a `stage:"won"` legacy-taxonomy leak on one lead (→ `executed`); a second lead with `stage:"contract_sent"` was left alone (deal genuinely still open). Not yet swept: ~35 leads still on the pre-8/7 `"contacted"` stage value from what looks like an active bulk-import path — worth a one-off scan for any `stage` outside the 6-value taxonomy.

**Yardi sync pipeline — LIVE end-to-end, one known data-integrity fix still not deployed.** `n8n/32_yardi_sheet_to_firestore_sync_fixed_v2.json` fixes workflow 32's Create Lead node missing `createdAt`/`archived`/`seq_status` on every new Yardi lead (confirmed root cause 2026-08-13/14, several leads already patched by hand). **Still needs:** Justin to import this fixed version via workflow 32's own ⋯ → Import from File (not the workflows list), then confirm the next real Yardi lead lands with all three fields and expands correctly in the app.

**Other unresolved from earlier sessions (status not reverified — check with Justin before assuming still true):**
- Contact enrichment for 📍 Nearby Prospects: UpLead (workflow 28) built but not yet imported — deploy checklist in the workflow inventory below.
- Workflow 26 (Nearby Prospect draft) and workflow 23's `site_outreach` reply-detection extension — import status unconfirmed; diff against a fresh live export before re-importing anything (see gotcha below).
- Home-desktop migration of the Yardi Lead Watcher — planned, not started.

---

## What this is
A web app for Justin Cho (Justin.Cho@cubework.com) at Cubework. Two deployed surfaces:
- **`index.html`** — the main tabbed app.
- **`tour.html`** — a separate standalone post-tour "numbers" tool (own auth gate, no tab bar), linked from the main app's tab bar as a plain new-tab link (📐 Tour Board ↗). See its own section below.

Deployed at: https://justinchore.github.io/do-or-wait/
Source: `C:\Users\jcho\Documents\Claude\Projects\do_or_wait\index.html` (+ `tour.html`) — single HTML files, push to GitHub to deploy.

### `index.html` tabs (in actual tab-bar order)
1. **Tasks** — DO/WAIT topic threads (digital sticky note system).
2. **Leads** — Sales pipeline. **Stage taxonomy replaced 2026-08-07 to match Yardi Deal Manager** — see Firestore collections below for the current values (`lead`/`tour`/`proposal`/`negotiation`/`executed`/`dead`, no longer cold/contacted/toured/proposal/won/lost).
3. **📧 Outreach** — Apollo-sourced cold-outreach prospect list. **Dead pipeline — Apollo subscription is cancelled, do not start new Apollo campaigns.** Existing prospects/drafts/reply-detection still function; just no new ingestion. Reads `outreach/{id}` overlaid on `outreach-seed.js`.
4. **🏢 Prop Outreach** — property-tied Yardi call-sheet backlogs (EXISTING tenant leads), separate from Outreach (unattached prospecting). Reads `property_outreach/{id}`, grouped by property then by call **wave** (fixed metadata, not computed live). Covers 4 properties: Ontario Airport, 2720 Pellissier, 2680-2690 Pellissier, CA Banana/Fontana.
5. **📍 Nearby Prospects** — per-site discovery of NEW nearby businesses via CoreClaw (Google Maps Scraper). Reads `site_outreach/{place_id}`, grouped by property then search category. Ontario Airport is running as a deliberate **low-stakes engagement pilot** (Justin: "not actually looking for conversion, we just need responses and engagement") — reply visibility is the real success metric there.
6. **📞 Playbook** — cold-call flow script + searchable Battle Cards reference.
7. **🏭 Avail** — real-time availability dashboard. Has ⬇ Export JSON (syncs-first, then downloads).
8. **🗂️ Roster** — staff contact directory, read-only, visible to Lucy (Avail-only role).
9. **🔗 Links** — SharePoint/Google Sheet link directory, full CRUD. NOT visible to Lucy.
10. **💲 Pricing** — national rate card, read-only, falls back to `pricing-seed.js`.
11. **📊 Rate Bands** — internal Sales/BD negotiating tool, staff-only (not Lucy).
12. **💡 Notes** — ideas/issues notebook.
13. **🤖 Assistant** — in-app Claude chat via Anthropic's native MCP connector against the do-or-wait Cloud Run MCP server. One persisted thread (`assistant_threads/main`).

**n8n import-status caveat:** several workflows' "imported/active in n8n" status has never been explicitly confirmed in a session (see the workflow inventory table below) — this doc can only track what got typed into it, not Justin's actual n8n instance.

---

## Tech stack
- **Frontend**: `index.html` + `tour.html` — vanilla JS, no framework, no build step.
- **Database**: Firebase Firestore (project `do-or-wait`). Rules locked down 2026-06-24 — read/write only for a signed-in user on the 3-email allowlist. Was previously open/no-auth.
- **App auth**: Firebase **email/password**, restricted to `ALLOWED_EMAILS` (jchoustin91@gmail.com, justin.cho@cubework.com, cubeworkautomation@gmail.com). Switched from Google sign-in (cross-domain redirect fails on mobile).
- **Storage**: Firebase Storage (voice notes, file attachments, PDFs). **Storage rules are NOT what the app assumed for over a year** — see "Firebase Storage rules" section below; fixed 2026-07-25.
- **Automation**: n8n at `https://ailinker.item.com` (self-hosted, behind nginx) — **Justin's plan is Managed n8n Cloud with no server/admin access** (confirmed 2026-08-07) — this rules out community nodes, Execute Command, custom images, Playwright/headless-browser nodes. New automation needing that (e.g. the Yardi sync) must run elsewhere (Claude cloud scheduled tasks).
- **CORS proxy**: Cloudflare Worker `https://plain-credit-5962.jchoustin91.workers.dev` — pure pass-through, forwards any `/webhook/<path>` to the same-named n8n path. Not a place with its own compute/secrets.
- **Microsoft OAuth2**: Azure app `n8n-cubework`, n8n credential named `Microsoft account 3` / also referenced as credential **`n8n-cubework`** (the `genericCredentialType`/`oAuth2Api` pattern — this is the PROVEN-working pattern for new workflows, not the older `predefinedCredentialType`/`microsoftOAuth2Api` pattern workflow 7/6 use).
- **Google Firestore service account credential**: `Firebase_SDK_do_or_wait` (datastore-scope Admin SDK key) — used by every n8n Firestore write (`predefinedCredentialType`/`googleApi`). Service accounts bypass Firestore security rules via IAM.
- **Anthropic API credential**: `anthropicApi` predefined type, reused across workflows 13/17/22/24/26.

---

## Architecture decision — stay vanilla single-file (revisit at triggers)
**Decided 2026-06-10, still in effect.** Keep `index.html`/`tour.html` as vanilla-JS single files, **no framework, no build step** — deploy simplicity + ease of single-file editing outweighs framework comfort. Triggers to reconsider: file gets hard to navigate (watch line count), another developer joins, or the `window.*`-exposure footgun / manual `esc()` templating cause **repeat** bugs. If migrating: **Preact + htm from a CDN**, not React+bundler. Deferred idea: side-by-side card comparison (cards are currently accordion/single-open) — cleaner with components, revisit at migration.

### Gotcha — function exposure (ES module scope), the most common bug class in this project
`<script type="module">` means functions are NOT global. Any function referenced from an inline `onclick=`/`onchange=`/`oninput=`/`ondrag*=` attribute MUST be added to the `window.* = ...` block near the bottom of the module, or it throws "X is not defined" at click time. When adding any new inline handler, always add the matching `window.` line. (This has caused real bugs multiple times across the project's history — see the drag bug origin story in `CLAUDE_HISTORY.md`.)

### Gotcha — the bash-mounted sandbox copy of this repo can be stale/truncated
Multiple sessions found the bash-mount path serving a stale, multi-day-old, or truncated (missing closing tags) copy of `index.html`/`tour.html` even right after edits landed via the direct-filesystem Read/Edit tools. **Workaround used throughout this project:** validate syntax (`node --check`, HTML tag-balance via Python's `html.parser`) against a fresh copy in the session's `outputs`/scratch directory (which mounts live), not the project-folder bash mount. Also true for n8n JSON files.

### Gotcha — n8n workflows can drift from their repo export
A workflow live in n8n for a while may have been hand-tweaked directly in the n8n UI (credentials picked, CORS settings added, node IDs changed on a past duplicate-then-delete cycle) with the change never synced back to the repo's exported JSON. **Before re-importing an update to an already-live workflow, get a fresh export from n8n and diff it against the repo file first** (name/parameters/credentials/ids, excluding jsCode body) — don't assume the repo copy is current. This bit workflow 25 for real on 2026-07-23 (see `CLAUDE_HISTORY.md` for the full story) — a blind re-import would have wiped 4-5 live credential bindings and reverted hand-added CORS headers.

### Gotcha — n8n re-import creates a duplicate unless done in-place
Importing a workflow JSON via the **workflows list** always creates a **new** workflow entity — if it shares a webhook path with the original, you get "Conflicting Webhook Path" and can't activate either. **To update an existing workflow: open the existing workflow itself and use its own ⋯ → Import from File** (replaces canvas in place, preserves workflow ID + credential bindings). Never import a canvas update from the workflows list.

---

## Firestore collections

### `topics/{id}`
Task threads. Fields: `title`, `archived`, `entries[]`, `createdAt`, `email_links[]`.

### `leads/{id}`
Sales leads (thread structure + lead fields). Core fields: `company`, `first_name`, `email`, `contact`, `phone`, `segment`, `location`, `sqft`, `leaseLength`, `moveIn`, `unit`, `unit_sf`, `dock`, `rate`, `included_items`, `alt_option`, `is_importer`, `current_step`, `last_touch_date`, `next_due_date`, `seq_status`, `pending_email`, `followup_draft` (`{subject, body, generated_at, source}` — source ∈ `thread`/`notes`/`thread+notes`), `email_links[]`.

**`tour_date` (YYYY-MM-DD) / `tour_time` (HH:MM, optional) — added 2026-08-17.** Set via the edit modal's Tour Date/Time row, shown only when `stage==='tour'`. Deliberately separate from `next_due_date` (which stays scoped to the dead sequencer's "next send" + generic follow-up scheduling). Feeds the Leads tab's "📅 Upcoming Tours" strip (`renderUpcomingToursStrip()`) — see Open Items above and "Key functions" below.

**Bookkeeping fields every lead is supposed to have: `id` (same value as the Firestore doc key, duplicated into the document body — the frontend's `toggleLeadCard(lead.id)` reads this field, not the doc key), `createdAt`, `updatedAt`, `archived` (bool).** These are NOT optional cosmetic metadata — a lead missing `createdAt` has failed to expand in the app (found live 2026-08-13/14, see Open Items). `create_lead` (the Firestore MCP connector) always sets these correctly; leads created via n8n workflow 20/32 are the ones at risk of missing them — check the Open Items section above before assuming this is fixed.

**`stage` — REPLACED 2026-08-07 to match Yardi Deal Manager's own vocabulary 1:1** (was cold/contacted/toured/proposal/won/lost). Current values: **`lead` / `tour` / `proposal` / `negotiation` / `executed` / `dead`**. Companion fields: `yardi_milestone` (free-text Sales-actionable substage per `YARDI_MILESTONES_BY_STAGE`, or blank), `dead_reason` (one of 13 Yardi Dead-Deal-Reason values, only meaningful when `stage==='dead'`, force-cleared otherwise), `yardi_deal_id` (Yardi deal GUID — not yet populated by anything; the eventual pull sync will set it; lead card renders a "🔗 View deal in Yardi ↗" link off it when present), `merged_into_lead_id` (new field from the migration — points to the surviving lead id for the 5 leads that used to encode `"duplicate - merged into X"` as their stage string).
- **`LEAD_STAGE_ORDER`** = `['lead','tour','proposal','negotiation','executed','dead']` (drives the 📶 Stage sort).
- **Filter buttons**: All/Lead/Tour/Proposal/Negotiation (Cold and Contacted, formerly separate filters, both now live under `lead`), plus 🔔 Follow-ups and ⏳ Waitlist (unchanged).
- **Closed-lead check everywhere in the app** (`isFollowupDue`, active/closed split, `isDeadPoolLead`, `dailyQueueItems`, `statusChip`) = `['executed','dead'].includes(stage||'lead')` (was `['won','lost']`). `isDeadPoolLead` (Space Match trigger) now fires on `stage==='dead'`.
- **`followupBucket(lead)`** (new) preserves the old cold-vs-contacted email-tone distinction that collapsing stages would have flattened: maps `stage`+`yardi_milestone` back onto the OLD template-bucket keys (`cold`/`contacted`/`toured`/`proposal`/`negotiation`) purely for picking which `FOLLOWUP_BY_STAGE` template to use. `negotiation` is currently **aliased to the `proposal` template** (no dedicated copy written yet — write real Negotiation-stage copy once real leads reach it).
- **Promote-to-lead defaults**: Property Outreach promotions → `stage:'lead', yardi_milestone:'Lead Contacted (Sales)'`; Nearby Prospects promotions → `stage:'lead', yardi_milestone:'Lead Assigned'`. Both clear `dead_reason:''`.
- **One-time migration done 2026-08-07**: all 97 existing leads were mapped from the old taxonomy (including two undocumented legacy values found live — `agreement` and `"duplicate - merged into <id>"` strings) onto the new one via 97 individual `update_lead` calls. Final distribution: 76 `lead`, 11 `dead`, 4 `tour`, 4 `negotiation`, 2 `proposal`. **Deploy note:** the migration already happened live in Firestore; if `index.html` hasn't been `git push`ed yet, the live site is still rendering these new values through old code (blank/fallback labels) — push promptly.
- **Known-recurring gotcha (found again 2026-08-17, see Open Items above): leads with a stage string outside the current 6-value taxonomy don't just render wrong — they're invisible to `isFollowupDue()`'s closed-stage check too**, so a lead stuck on a legacy value that SHOULD read as closed keeps nagging for follow-ups forever. Found live: `"won"` (SSC Cargo Lines, fixed → `executed`) and `"contract_sent"` (SunStrong Management, left alone — deal's genuinely still open, `followup_due` happens to read false anyway). Only actually dangerous for values that should map to `executed`/`dead` — a legacy value that should map to an *active* stage (see next bullet) behaves identically to `lead` for follow-up purposes, just wrong for the badge/milestone-dropdown/stage-sort.
- **Bigger instance of the same root cause, lower severity: ~35 leads (`query_collection`/`list_leads({stage:'contacted'})`, checked 2026-08-17) are still on the old taxonomy's `"contacted"` value** — nearly all created same-day (`le17869…`/`le17870…` ids), so this looks like an active bulk-import path (Apollo/cold-outreach batch?) still writing the pre-8/7 stage vocabulary rather than a one-off relapse. Not fixed yet (out of scope for the session that found it) — correct form is `stage:'lead', yardi_milestone:'Lead Contacted (Sales)'`. Worth a real sweep + fixing whatever's still writing `"contacted"` at the source before the next batch lands — a one-off `query_collection` scan for any `stage` value not in `['lead','tour','proposal','negotiation','executed','dead']` would catch both this and the `"won"`/`"contract_sent"` cases above in one pass.

**Linked email threads — `email_links[]`** (topics AND leads). Per entry: `{id, label, subject, contact, url, conversationId, resolving, hasNew, lastMsgDate}`. Resolved via `resolveThreadLink()` → n8n workflow 11 (Graph search for the newest matching message's `webLink`). `fixThreadUrl(u)` rebuilds a broken new-Outlook `webLink` into the one working deeplink form (`outlook.office365.com/mail/deeplink/read/<pathId>?ItemID=<ItemID>&exvsurl=1`) at render time — applied both app-side and inside workflow 11's write. Auto-refreshes on card expand and on tab-open (Leads/Tasks, 60s cooldown each), never a background poll. 🆕 badge + whole-card `has-new-mail` highlight + tab-bar badge when any linked thread has a newer message than last seen.
- **`graphMessageId`** — raw Graph message id, distinct from `conversationId`/`url` (click-to-open only). Needed so a send-as-reply workflow can call Graph's `POST /messages/{id}/reply`. Both capture points use the `Prefer: IdType="ImmutableId"` header (required since a send/folder-move can otherwise invalidate the id). **Workflow 33** captures it from the qualifying-email draft — confirmed correct via two real live sends. **Workflow 11** backfills it for threads found by search rather than sent by the app (covers most of the existing 30 leads) — code-verified, not yet live-tested. **Still unproven either way:** whether a real `/reply` call against either id actually lands in the right Outlook conversation — needs the send-as-reply workflow (see Open Items above) built and tested live.

**Follow-up fields** (written by n8n workflow 6 — Follow-up Scanner): `last_contact_date`, `last_contact_dir` (`out`/`in`), `days_since_contact`, `followup_contacted`, `followup_due` (≥3 **business** days AND `last_contact_dir==='out'`), `followup_checked_at`, `followup_snooze_until`.

**Update categories**: thread entries carry `kind` ∈ `note` (internal, not counted as contact) or a contact brief (`email`/`call`/`text`/`met`/`inbound`, counted; legacy no-`kind` entries grandfathered as contact). Follow-ups are **outbound-cold only** — due only if the most-recent contact was outbound AND ≥3 business days old; inbound contact means "needs a reply," which surfaces in the Do column via the inbound log's `type:'do'`.

**Waitlist fields**: `wl_on`, `wl_locations[]`, `wl_type`, `wl_sf_min`, `wl_sf_max`. Live-matched via `wlMatches(lead)` against `availMap`, no button/n8n.

**Space Match field**: `dm_snooze_until`. See "Space Matches" feature below — proactive re-engagement matcher for archived/dead leads, broader than Waitlist.

**Auto-logged follow-up sends (added 2026-07-27):** `logFollowupSent(lead,{subject,body,label})` appends a normal thread entry (`kind:'email', dir:'out', followupNum:N`) with the full subject+body as an attached text note, whenever a follow-up email is actually opened via `openFollowupEmail`/`openGeneratedFollowupEmail` (cycled templates OR the Claude-generated draft). This resets the lead's follow-up-due clock (same `kind:'email'` contact-counting rule everywhere else uses). Deliberately scoped to Leads-tab follow-ups only — NOT Space Match re-engagement emails, NOT any Outreach/Prop Outreach/Nearby Prospects draft-send button (7 such buttons exist app-wide; Justin explicitly said not to extend this there).
- **Glance-friendly last-follow-up fields (added 2026-08-19, Justin's ask — "having simple fields to see it at a glance is helpful"):** `logFollowupSent()` now also writes `last_followup_label` (string, e.g. `"Nudge"`/`"Value"`/`"Break-up"`/`"Generated, from thread"`), `last_followup_num` (mirrors the entry's `followupNum` — the all-time count, same number `nextFollowupNum()` produces), and `last_followup_sent_at` (ISO timestamp, mirrors the entry's `createdAt`) directly onto the lead doc. Purely a convenience mirror of what `entries[]` already has — every actual due/escalation check (`followupSentSinceReply`, `contactInfo`, `isFollowupDue`, etc.) still reads `entries[]` directly and does not depend on these three fields, so a stale or missing value here can never break the real ladder logic, only the at-a-glance view of it. Also now rendered in the app itself, not just Firestore: the lead detail panel's `seqRows` (`renderLeadDetails`) shows a new "✉️ Last follow-up" row (`#3 — Value · 2d ago`) whenever `last_followup_sent_at` is set.

### `notes/{id}`
💡 Notes tab. Fields: `trigger`, `why`, `fix`, `createdAt`, `updatedAt`, `_deleted` (soft-delete). View mode (read-only) + edit mode (textareas).

### `availability/{propId}`
Written by n8n after syncing each property's SharePoint file. Fields: `property`, `address`, `yardi_url`, `sharepoint_url`, `sheet_last_modified`, `synced_at`, `wh{}`, `office{}`, `dock{}`, `parking{}`, `units[]`, `pa{name,phone,email}`, `ownership` (`own`/`lease`/`''`), `lease_expiration`.

**App-edited fields survive sync** (written via REST PATCH + `updateMask.fieldPaths`, excluded from the sync's own updateMask): `pa`, `ownership`, `lease_expiration`, `future_plan_url`/`future_plan_storage_path`/`future_plan_note`/`future_plan_updated_at` (Future Plan PDF feature — inline `<iframe>` embed in the location card + Open-in-new-tab, uploaded to Firebase Storage `files/future-plan-{propId}-{timestamp}.pdf`).

Each `units[]` entry: `unit`, `type` (WH/OFFICE/DOCK/TRAILER), `sf`, `status`, `tenant`, `owner`, `phone`, `email`, `poc`, `notes`, `available` (bool), `hold` (bool).

### `pricing/current`
National rate card. Written by n8n Pricing Sync (**workflow 7** — auth pattern flagged 2026-07-07 as never verified live, still had a placeholder credential; check if this tab's data ever looks stale). Falls back to `pricing-seed.js`.

### `pricing_bd/current`
Internal Sales/BD rate-bands tool (📊 Rate Bands tab). Written by **workflow 18** (not confirmed imported/active). Fully separate sheet/collection from `pricing/current` (complementary, non-overlapping data). Fields per building: bands (RAISE/HOLD/LOWER tiers), occupancy_pct, addons, notes, below_break_even, promo. No snapshot fallback.

### `roster/current`
Staff contact directory (🗂️ Roster tab). Written by **workflow 19**, manual webhook only, no cron (not confirmed imported/active). Plain flat table per location: `local_staff`, `facility_manager`, `status`. Visible to Lucy (Avail-only role) — the one exception besides Avail itself.

### `property_outreach/{id}`
Property-tied Yardi call-sheet backlogs (🏢 Prop Outreach tab). `location` = hard propId. Written directly from browser + via n8n workflow 20 (bulk imports). Fields: `company`, `contact`/`phone`/`email`, `location`, `source`, `wave` (int, fixed at build time — NOT computed live, see `PO_WAVE_INFO`), `sqft`/`sqft_est`, `source_notes`, `status`, `attempts[]`, `last_contacted_at`, `promoted_lead_id`, `archived` (soft-hide; auto-set on 2nd "Not interested"), `cold_draft`/`draft_context` (see below). Covers 4 properties (Ontario Airport 289 records, Pellissier-2720 75, Pellissier-2680-2690 22, Banana/Fontana 42).

**Reply-detection fields** (written by workflow 23, LIVE): `reply_detected`, `reply_detected_at`, `reply_received_at`, `reply_subject`, `reply_snippet`, `reply_web_link`, `reply_seen`.

### `property_outreach_context/{locationId}`
Per-property cold-draft talking points: `available_space`, `discount`, `other`, `cubework_url` (all free text). Also **per-property prompt A/B fields**: `prompt_name`, `system_prompt` (overrides workflow 22's built-in `DEFAULT_SYS` for that property's drafts; both blank = use shared default). Every generated `cold_draft` permanently records which `prompt_name`/`system_prompt_used` produced it, so history stays attributable even if the property's prompt is later edited/renamed. Set via the Prop Outreach tab's per-property talking-points panel + collapsible prompt editor.

### `site_outreach/{id}`
Backs 📍 Nearby Prospects. Doc id = the real Google **`place_id`** (falls back to `data_id`; there is no `cid` field on this Worker's output — an earlier design assumption, corrected 2026-07-21). Written by n8n workflow 25 via workflow 20's `bulk_update` (masked partial write — never `bulk_create`, so a re-discovery run can never clobber `status`/`notes`/`attempts`/`archived`/`promoted_lead_id`; these fields are simply absent from every discovery write and the app defaults them at read time). Fields: `location`, `place_cid`, `name`, `address`, `city`, `state`, `website`, `phone`, `search_category` (one of 9 categories — first entry is `import export company`, changed from bare `importer` 2026-07-23 after it pulled in SoCal car-import/JDM noise; a `CATEGORY_DENYLIST` in the write step also drops rows whose `primary_category` matches car dealer/auto parts/auto repair/car wash/car rental/government office/flag store regardless of keyword), `google_category`, `all_categories[]`, `latitude`/`longitude`, `rating`, `review_count`, `contact_name`/`contact_title`/`contact_email`/`contact_linkedin`/`contact_phone` (picked from CoreClaw's `leads_enrichment[]`, prefers a contact with non-null email; frequently null — LinkedIn-sourced, not always email-verified), `discovered_at` (defaults to `last_seen_at` at read time if missing — deliberately never written by re-runs), `last_seen_at`, `status`, `attempts[]`, `last_contacted_at`, `notes`, `archived`, `promoted_lead_id`.

**CoreClaw's real field names were verified against a live account 2026-07-21** (see below for the corrected mapping — the original build guessed from prose docs with no account). **Research/draft fields** (written by workflow 26, forked from workflow 13): `research_brief`, `email_subject`/`email_body`, `email_variants[]` (4: mismatch/forced-bet/freedom/commitment), `prospect_group`/`prospect_fit` (derived from `search_category` via a small 9-entry map, not wf13's broad taxonomy), `draft_confidence`/`confidence_reason`, `body_words`/`body_flesch`, `researched_at` — deliberately the same field names as `outreach/{id}` so the app reuses Outreach's modal UI verbatim. **Reply-detection fields** (workflow 23 extension, file-only as of last update — see Open Items): same shape as the other two collections, but this collection's contact field is `contact_email` (not `email`), so the scanner uses a dedicated `extractMatchesSO()` matcher for it.

### `assistant_threads/main`
One doc — 🤖 Assistant tab's persisted conversation. `messages[]` = `{role, text, at, toolsUsed?}`. Only one thread exists (`newAssistantThread()` clears rather than creates a new doc).

### `renewals/current`
Per-tenant lease-renewal tracker. Written by n8n workflow 10 (Google Sheet CSV export, no creds) — LIVE, daily 7:30am. Matching against Avail locations is heuristic (place-token substring match); only synced CA/COI locations match today.

### `config/properties`
One doc, `properties[]` array: `id, driveId, itemId, property, address, yardi_url, sharepoint_url`.

### `sharepoint_links/{id}`
🔗 Links tab. `{id, label, url, category, notes, createdAt, updatedAt}`, full CRUD. Seeded once client-side from `SPLINKS_SEED` if the collection loads empty. Not visible to Lucy.

### `outreach/{id}`
📧 Outreach tab (dead Apollo pipeline, still readable/reply-tracked). Doc id `ap-<domain-slug>`. Rich Apollo-sourced fields (`company, domain, first_name, contact, seniority, ..., employees, description, teu, prospect_tier, prospect_score, email_subject, email_body, status, invalid, research_brief, prospect_source`), plus `prospect_group`/`prospect_fit`/`draft_confidence`/`confidence_reason`/`email_variants[]`/`body_words`/`body_flesch` (Claude 4-hook draft engine fields, workflow 13), phone fields from the (also dead) Apollo phone-reveal pipeline, and reply-detection fields (`reply_detected` etc., workflow 23, LIVE).

### `apollo_phone_map/{apolloPersonId}`
Dead-pipeline bridge collection: `{slug, email, mapped_at}` — matches an async Apollo phone-reveal push back to the right `outreach/{slug}` doc.

### `tour_sessions/current` and `tour_floorplans/{propId}`
See `tour.html` section below.

---

## `firestore.rules` — current state
Read/write only if `request.auth.token.email.lower()` is in the 3-email `ALLOWED_EMAILS` allowlist (no `email_verified` check — console-created accounts aren't verified). Explicit `match` blocks with a looser **read**-only carve-out for `isAnyAllowed()` (adds `lucy.wang@cubework.com` via `isAvailOnly()`) exist for: `availability/{propId}`, `config/properties`, `renewals/current`, `roster/current`. **Write** to all of these stays `isAllowed()`-only (the 3-email list). Everything else (including `leads`, `topics`, `notes`, `outreach`, `property_outreach`, `site_outreach`, `pricing/current`, `pricing_bd/current`, `assistant_threads`, `sharepoint_links`, `apollo_phone_map`) falls through to the catch-all `match /{document=**}` block — `isAllowed()`-only, zero access for Lucy no matter what the UI shows. Both allowlists (`AVAIL_ONLY_EMAILS` in `index.html`'s `isAvailOnly()` mirror, and the array in `firestore.rules`) must be kept in sync by hand.

**n8n Firestore writes bypass these rules entirely** — every n8n HTTP node authenticates as the `Firebase_SDK_do_or_wait` service account (IAM-based), not as an end user.

## Firebase Storage rules — current live state (fixed 2026-07-25, NOT what earlier docs assumed)
**Corrects a standing false assumption** (the 2026-07-09 Future Plan session claimed `files/` was "already permitted" — it was NOT; may have silently broken Future Plan PDF uploads, file attachments, and voice notes in production before this fix). Storage rules aren't checked into the repo (edited by hand in the Firebase console). Actual live rules:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{uid}/{allPaths=**} { allow read, write: if request.auth.uid == uid; }  // unused by this app
    match /files/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.token.email.lower() in
        ['jchoustin91@gmail.com', 'justin.cho@cubework.com'];
    }
    match /audio/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.token.email.lower() in
        ['jchoustin91@gmail.com', 'justin.cho@cubework.com'];
    }
  }
}
```
**Deliberately narrower than Firestore's 3-email list — only 2 accounts** (Justin's call: Storage doesn't need `cubeworkautomation@gmail.com`). Confirmed working via a live `uploadBytes` test after publishing.

---

## n8n workflow inventory — current status

| # | Workflow | Status |
|---|----------|--------|
| 1-3 | Email sequencer (queue_checker/send_trigger/reply_detector) | **OFF by design** — decided 2026-06-10, the Follow-up Scanner (6) replaced this need. Do not activate. |
| 4 | `4_availability_sync.json` | Redundant reference copy, superseded by 5. Deletion candidate. |
| 5 | `5_add_location.json` | **LIVE** — authoritative combined workflow (availability-sync + add-location + daily 3am cron sync of all locations). Edit in n8n UI or here, then re-export; always update in-place, never import from the workflows list. |
| 6 | Follow-up Scanner | **LIVE**, daily 7am. Flags leads cold 3+ business days via Outlook/Graph. Never sends. |
| 7 | Pricing Sync | Presumed running (daily 6am) but **auth pattern never verified live** — still had a placeholder credential as of 2026-07-07. |
| 8 | Prospect Finder (nightly Apollo import/score) | Dead in practice — part of the cancelled Apollo pipeline. |
| 9 | Floorplan image render | **Abandoned/deprecated**, do not import — floor-plan feature is link-only now (see below). |
| 10 | Renewals Sync | **LIVE**, daily 7:30am. |
| 11 | Resolve Thread Link | **LIVE**, must stay Active — powers 🔗 Email threads. |
| 12 | Apollo Ingestion | Dead — Apollo subscription cancelled. Do not use. |
| 13 | Research & Personalize (Claude 4-hook draft engine) | **Must be Active** — still used by Outreach's 🔎 button and forked into workflow 26 for Nearby Prospects. The Apollo *ingestion* pipeline feeding it is dead, but the drafting engine itself is live infra. |
| 14 | Apollo Org Discovery | Dead — Apollo cancelled. |
| 15 | Apollo Phone Callback | **LIVE, must stay Active** (webhook target for Apollo's async push) — but the Apollo pipeline it serves is dead. |
| 16a | Apollo Phone Reveal | Dead — Apollo cancelled. |
| 16b | Apollo Phone Write (poll-based) | **DELETED** — never worked (404s). |
| 17 | Generate Lead Follow-up | **LIVE**, imported and current. Has been re-imported several times to keep prompt edits live (2026-07-06/07/15/20, and again 2026-07-20 after discovering the live copy had drifted several versions stale) — **always diff/verify the live copy before assuming a past "re-imported" note is still true.** |
| 18 | Pricing BD Sync | **NOT confirmed imported/active** — flagged repeatedly, never resolved. |
| 19 | Roster Sync | **NOT confirmed imported/active** — flagged repeatedly, never resolved. |
| 20 | Firestore Writer (generic) | **LIVE** — the generic `{collection,action,items|fields}` → Firestore batchWrite webhook, used by many other workflows (23, 25, 32) and one-off migrations. Keep active. Only ever writes what the caller's `fields` includes — it does NOT inject `createdAt`/`archived`/`seq_status` defaults itself (see workflow 32's row below for where that gap actually lives). |
| 21 | Cleanup Ontario Outreach | One-off, done its job — safe to deactivate/delete. |
| 22 | Property Outreach Cold Draft | **NOT confirmed imported/active** — flagged repeatedly across several sessions of prompt edits, never resolved. |
| 23 | Outreach Reply Scanner | **LIVE**, imported and active (confirmed 2026-07-14) for `outreach` + `property_outreach`. Its `site_outreach` extension (2026-07-23) is **file-only, not yet re-imported** — diff against a fresh live export first (see gotcha above). |
| 24 | Assistant Chat | **LIVE**, imported and confirmed 2026-07-10, plus 2 post-import fixes applied directly in n8n (MCP URL hardcoded — `$env` vars aren't available on this plan; prompt caching via `cache_control:{type:'ephemeral'}`). |
| 25 | Site Outreach Discovery (CoreClaw) | **LIVE, imported and confirmed working** (2026-07-23 — a real full 9-category run for Ontario Airport came back clean). CoreClaw's real field names were verified against a live account 2026-07-21 (see `site_outreach` schema above) and the workflow was corrected to match. |
| 26 | Nearby Prospect Research & Draft | **Unconfirmed** — Justin said it "looks already imported" but this was never verified specifically, and no real draft has ever been generated through it. |
| 27 | Contact Enrichment Test Bench (PDL) | Imported and live, but **abandoned for contact enrichment** (masked contact fields with no fix found) — kept as a sandbox/record of what was tried, not wired into 25/26. |
| 28 | Contact Enrichment Test Bench (UpLead) | **NEW, not yet imported.** Current best candidate to replace CoreClaw's weak contacts — see Open Items above for the deploy checklist. |
| 29-31 | Site outreach discovery/enrichment (ZoomInfo variants) | Not audited in this pass — status unconfirmed, check before assuming live. |
| 32 | Yardi Sheet → Firestore Lead Sync | **LIVE** (confirmed by Justin 2026-08-14, despite the repo file's own `active:false`/README saying "not yet imported" — that's stale documentation, don't trust it). Reads the Sheet `yardi_export.py` writes, dedupes new rows against `leads` by email/phone, POSTs new ones to workflow 20. **Known bug, fix built but not deployed as of 2026-08-14:** its Create Lead node's payload is missing `createdAt`/`archived`/`seq_status` — see the 2026-08-13/14 open-items thread above. Fixed version sitting next to it as `32_yardi_sheet_to_firestore_sync_fixed_v2.json`, not yet imported. |

---

## Current locations (Avail-onboarded)
| propId | Property | Notes |
|--------|----------|-------|
| `pellissier-2720` | 2720 Pellissier, City of Industry | Short type codes (WH/OFFICE/DOCK/TRAILER). R-units = OFFICE |
| `11179-banana-fontana` | 11179 Banana, Fontana | DD-units = DOCK (DD01-DD14) |
| `reyes-compton` | Reyes, Rancho Dominguez | Spelled-out types (Warehouse/Office/Dedicated/Trailer) |
| `218-machlin-walnut` | 218 Machlin Ct, Walnut | Single-digit + 3-digit office unit IDs |
| `3950-airport-ontario` | Ontario Airport | Pilot site for Nearby Prospects + first `tour.html` site-plan mapping target |

More CA locations onboarded via Add Location; quick-fill entries in `LOCATION_PRESETS`. Property Outreach also covers 2 more properties with no matching Avail entry yet: `pellissier-2680-2690`.

---

## App structure — key functions (`index.html`)
- `renderAvailability()` / `renderLocCard`/`renderLocBody` — Avail tab, grouped by state, sort by SF or name (`setAvailSort`), search (`onAvailSearch`), unit filter chips (`setAvailFilter`), renewal badges from `renewals/current`.
- `renderFloorplans(propId)` — **link-only** (see Floor plans decision below), reads `sharepoint_url`/`yardi_url`.
- `triggerAvailSync(propId)` / `submitAddLocation()` — POST to Cloudflare Worker.
- Leads: drag-to-reorder (`leadDragStart/Over/Drop`, `order` field), `toggleHideWaitlist()`.
- `contactInfo(lead)` / `isFollowupDue(lead)` / `bizDaysBetween()` — follow-up-due logic, business-days based (weekends don't count as silence).
- `spaceMatches(lead)` / `isDeadPoolLead(lead)` / `renderSpaceMatchBlock(lead)` — proactive re-engagement matcher for archived/dead/waitlisted leads against live availability (broader than the Waitlist block, needs zero setup).
- `dailyQueueItems()` / `checkFollowupGate()` / `openFollowupQueue()` / `renderFuqCard()` — the daily follow-up gate+queue (see below) that replaced the old passive banners.
- `logTouch(leadId, kind, e)` — quick-log call/text/inbound (launches `tel:`/`sms:` AND logs in one tap).
- `generateFollowup()` / `renderFollowupDraftBlock()` — manual Claude-generated follow-up (workflow 17).
- `logFollowupSent()` / `nextFollowupNum()` — auto-logs sent follow-ups (2026-07-27, see Leads collection above).
- `renderUpcomingToursStrip()` / `jumpToTourLead(id)` — 📅 Upcoming Tours strip (2026-08-17, see Open Items + Leads collection above), reads `tour_date`/`tour_time`.
- `renderTourActionsBlock(lead)` / `markTourDone()` / `openRescheduleTour()` — ✅ Toured / 🔁 Reschedule quick actions on a tour-stage lead's card (2026-08-17, see Open Items above).
- `openStageResolve()` / `openTourCancel()` / `openFollowupResolve()` / `finalizeStageResolve()` + `#stage-resolve-overlay` — shared "what's the real status" prompt (Dead, always asks a reason, vs either back-to-Lead or Executed/Won depending on entry point). Used by ✗ Cancelled on tours and by 🏁 Update stage on follow-up-due nags (2026-08-17, see Open Items above).
- `fuqResolveStage()` — 🏁 Update stage button inside the daily follow-up queue modal, wraps `openFollowupResolve()` for whichever lead the queue is currently on (2026-08-17).

---

## Follow-up model — DECIDED 2026-06-10, still in effect: scanner only, sequencer OFF
Justin's rule: "no correspondence in 3 **business** days → follow up," where correspondence = Outlook email (either direction) OR a logged contact brief. Only **outbound-cold** leads surface as due (inbound = needs-reply, shown in the Do column instead). This is the Follow-up Scanner (workflow 6) + the 🔔 Follow-ups filter — the ONLY automatic follow-up mechanism. The 5-touch sequencer (workflows 1-3) is intentionally off (fixed cadence regardless of actual contact produces false notifications).

### Daily follow-up gate + queue (added 2026-07-10, replaced the old banners which are now REMOVED)
Justin found persistent in-tab banners (🔔 Follow-ups, 🌱 Space Matches) suffered banner blindness — ignored once, then invisible forever. **Replaced with a gate**: on every app open (not once/day — deliberately more insistent), if anything is due, a modal appears with exactly **Review now** (opens a one-lead-at-a-time queue) or **Not now** (free, instant, no state written — re-evaluates fresh next load). Combines Follow-ups-due + Space-Match items into one queue. Per-card actions: ✉️ Send, 📁 Archive, Snooze, Skip. **Archive's effect is asymmetric by design**: removes a lead from the follow-up side permanently, but an archived lead can still resurface as a space-match item (Space Match's whole point is watching archived/dead leads). The old banners (`#followup-banner`, `#space-match-banner`/toggle/list) and their dead code were fully removed — the 🔔 Follow-ups filter button+badge stays (it's a browsing filter, not a banner).

### Follow-up templates (client-side, `followupMsgsFor`/`followupTplIdx`, auto-escalates by default — see 2026-08-19 Open item above — still overridable via "↻" or picked explicitly in the queue)
Current set per lead-bucket: the stage-specific first message (`FOLLOWUP_BY_STAGE`, keyed by `followupBucket(lead)`), **Nudge** (`FOLLOWUP_NUDGE` — light, low-pressure, no value props), **Random value** (`FOLLOWUP_VALUE` — now picks one of 4 real anonymized Cubework case studies via `fuRandomCaseStudy(lead)`, chosen by the lead's estimated size via `followupTargetSf(lead)`, each ending with a direct call/text invite), and **Break-up** (`FOLLOWUP_BREAKUP` — the last-touch message). **No hardcoded sign-off anywhere** (removed 2026-07-15 — Justin's email client already appends one; `FU_SIGN` is now `''`). **No em/en dashes anywhere in these templates** (house style, enforced after a couple of regressions). **No holds offered in client-facing copy** (never promise to hold space before an agreement is signed — this was fixed out of the `contacted`/`toured` templates 2026-07-20). No fabricated availability/pricing is ever injected into these templates (the old `fuAvail()`/`followupUnitStillOpen()`/`followupAvailMatches()` helpers were removed entirely 2026-07-20 as a real bug — they were quoting stale specific sf numbers Justin didn't want stated; `followupTargetSf()` itself was kept, still used by the deliberate Space Match feature which DOES intentionally quote real live availability).

### Email sequencer (workflows 1-3) — OFF, kept only for reference
5-touch manual-send cadence. Workflow 1 drafts + writes `pending_email`; app renders with Open-in-email/Mark-sent; workflow 3 flips replies to `seq_status='replied'`. Workflow 2 (auto-sender) is unused (would need `Mail.Send` Graph scope). Not currently run.

---

## Floor plans — LINK to SharePoint Site Plan (FINAL, decided 2026-06-17/18)
**Whole floor-plan reconstruction feature abandoned in-app.** After trying auto-reconstruction (Graph + `.xlsx` color-region), uploaded images, and a LibreOffice weekly render — none scaled or stayed accurate enough. Final state: `renderFloorplans` just reads `sharepoint_url`/`yardi_url` off the availability doc and renders "📄 Open Site Plan (SharePoint) ↗" / "📐 Blueprint" (the Yardi Deal Manager link — "Blueprint" is this app's established name for `yardi_url`, not the PDF drawings). No rendering, upload, editor, or n8n workflow for this anymore. All the dead artifacts (`n8n/8_floorplan_sync.json`, `n8n/9_floorplan_image_render.json`, `n8n/render_siteplan.py`, root `floorplan-seed.js`) were deleted from the repo. **Full history of what was tried (color-region reconstruction, image upload, LibreOffice render) is in `CLAUDE_HISTORY.md`** if ever revisited.

---

## `tour.html` — standalone post-tour "numbers" tool (built 2026-07-24, iterated through 2026-07-28)
A separate file from `index.html`, own auth gate (same Firebase project, same `ALLOWED_EMAILS` — NOT extended to Lucy, since it involves live pricing entry), no tab bar — structurally nothing else reachable. Deploys via `git push` like `index.html`.

**Two Firestore collections** (both fall under the existing catch-all rule, no rules change needed):
- `tour_sessions/current` — one live working-session doc: `customerName`, `primaryProp`, `compareProps[]`, `highlighted` (`{propId:[unitId,...]}`), `addons` (`{key:{checked,price}}`), `pricing` (`{rate, sf, term, notes}` — Discount field was removed 2026-07-25), `comparePricing` (`{propId:{rate,sf}}` — per-property rough totals in Compare view), `commuteAddr1`/`commuteAddr2`. "＋ New session" overwrites it after a confirm — no session history is kept.
- `tour_floorplans/{propId}` — `{imageUrl, storagePath, boxes:[{unitId,x,y,w,h}] (as % of image), updatedAt}`. Manually mapped per property by Justin (click-to-place editor); properties without a mapped plan fall back to a plain grouped unit grid automatically. Ontario Airport is the pilot site (image not yet uploaded as of the last update).

**No Prep/Customer mode split** (removed 2026-07-24 — the tool is a **shared calculator** built live with the customer; the only real privacy boundary is Cubework's internal Rate Bands data, which was never wired into this tool at all — pricing here is always manual entry). Tenant/contact info for occupied units is never rendered anywhere in this tool (unit rows only ever show id/sf/status) — this is by design, not a mode check.

**Current layout (as of 2026-07-27 cont. #2):** a tabbed configurator — **Units** (collapsible-by-type grid with status filter chips Available/Hold/Occupied/All, default Available), **Site plan** (mapped-image editor/view), **Compare locations** (cards with warehouse/office avail-sf bars scaled to the max property shown, each card also has its own small rough deal calculator — Rate/SF/Total, no add-ons, deliberately simpler than the main sidebar) — plus an always-visible sticky **Deal Summary sidebar** (selected-units summary, Rate $/sf × SF = Base rent, add-ons with prices, Term, Total, Notes).

**Property header row** has Sync (same `availability-sync` webhook as the main app), SharePoint, Blueprint (Yardi link), and 🗺️ **Commute** (opens a modal: up to 2 origin addresses → geocoded via free Nominatim, routed via free OSRM demo server, rendered on a Leaflet/OSM map with drive time + mileage per address — **first feature in this project depending on unauthenticated third-party services with no SLA**; degrades gracefully to an inline error if either is down).

**Dark navy/amber/Cubework-green theme** (2026-07-27 cont. #4/#6) — `--do` amber `#f59e0b` (CTAs/total/active tab), `--wait` blue `#3b82f6` (selection highlight only, kept visually distinct from the amber CTA color), Cubework's real brand green `#38D430` for the "Available" pill and two accent divider lines.

**Known gotcha fixed twice in this file: `oninput` on any field that round-trips through `saveSession()`'s live Firestore listener causes a cursor-jump-while-typing bug** (the listener's `render()` rebuilds the whole DOM on every keystroke, destroying the focused input). **Fix pattern: always use `onchange`, never `oninput`,** for any field writing to `tourSession`. Also: the overlay's click-outside-to-close logic must check that BOTH mousedown and click landed on the backdrop (`window._cmDownTarget`), or dragging inside a modal (e.g. panning the embedded Leaflet map) closes the whole modal.

**Not built:** session history (single live doc only), pricing auto-pulled from Rate Bands (always manual), Lead linkage (declined — Justin creates leads before touring), full unit-level detail in Compare (just the avail-sf bars + rough calc today).

---

## File locations
```
do_or_wait/
  index.html            ← main app (push to GitHub to deploy)
  tour.html             ← standalone post-tour numbers tool (push to deploy)
  pricing-seed.js       ← Pricing-tab fallback snapshot (regenerate from master xlsx, not hand-edited)
  outreach-seed.js      ← cumulative CA outreach-prospect seed, overlaid live by `outreach` collection
  Copy of New Master List_ Price.xlsx ← master price sheet (source for pricing-seed.js), GITIGNORED
  REPLY_ASSISTANT_SPEC.md / reply_assistant_flow.mermaid ← design spec, status Proposed, NOT built
  firestore.rules / FIRESTORE_SECURITY.md ← Firestore security rules + rationale doc
  .gitignore
  sharepoint_location_links.txt ← SharePoint URLs for CA locations (preset input)
  firestore-mcp/        ← SOURCE for the "Do or Wait — Firestore" MCP connector (see below). Deployed build lags this repo's server.js.
  n8n/                  ← see the workflow inventory table above for per-file status; every numbered workflow has a matching .json (+ often a paste-ready .nodes.js Code-node mirror and/or .README.md)
  outreach/              ← outreach-campaign working files (CSVs, plans, cadence docs) — not read at runtime
  location_blueprints_sp/ ← per-location Site Plan CSV/xlsx exports — floorplan-parser dev fixtures only, feature abandoned
  note_emls/             ← drop .eml files here; Claude extracts trigger/why/fix notes via the Firestore MCP connector's create_note tool, processed emails move to note_emls/processed/
```
**Known cleanup already done:** `.writetest.tmp`, an old one-off report, `n8n/16b_apollo_phone_write.json` (dead poll path), stale README pointing at a never-created file, all dead floor-plan-reconstruction n8n/py files, a `blueprints/` JPG folder from a since-corrected `tour.html` misunderstanding. `n8n/4_availability_sync.json` is a redundant-but-harmless reference copy, still on disk.

### "Do or Wait — Firestore" MCP connector
Lets Claude read/write live Firestore directly (list/create/update tasks·leads·notes, get_availability/pricing/renewals, trigger/sync availability, `query_collection`/`get_document` escape hatches). Runs on Justin's machine (sandboxes can't reach Firestore directly). The deployed build is a desktop-extension that signs in with an allowlisted email/password account (passes the locked rules); the repo's `firestore-mcp/server.js` is its SOURCE and lags the deployed build (still shows the older unauthenticated-REST approach). **Availability isn't guaranteed session-to-session** — check the tool list before assuming it's attached. Known gap: `create_note`/`update_note` predate the `trigger` field — workaround is prefixing trigger text into `why`.

---

## Quick reference — webhook URLs (all via `https://plain-credit-5962.jchoustin91.workers.dev/webhook/<path>` unless noted)
- `availability-sync` — POST `{propId}` (workflow 4/5, LIVE)
- `add-location` — POST full location payload (workflow 5, LIVE)
- `resolve-thread` — POST `{subject,contact}` → `{found,webLink,conversationId}` (workflow 11, LIVE)
- `research-prospect` — POST `{id,company,domain,industry,location}` → PATCHes `outreach/{id}` (workflow 13, must be Active)
- `generate-followup` — POST `{leadId,company,first_name,contact,segment,stage,unit,unit_sf,conversationId,notesText}` → PATCHes `leads/{id}.followup_draft` (workflow 17, LIVE)
- `pricing-bd-sync` — POST `{}` (workflow 18, status unconfirmed)
- `roster-sync` — POST `{}` (workflow 19, status unconfirmed)
- `firestore-write` — POST `{collection,action,items|fields,id?}`, action ∈ create/bulk_create/update/bulk_update (workflow 20, LIVE)
- `property-outreach-draft` — POST `{id,company,location,wave,sqft,sqft_est,source_notes,available_space,discount,other,cubework_url,prompt_name,system_prompt}` → PATCHes `property_outreach/{id}.cold_draft` (workflow 22, status unconfirmed)
- `outreach-reply-scan` — POST `{}`, manual immediate scan (workflow 23, LIVE; also runs its own 2hr cron)
- `assistant-chat` — POST `{messages}` → `{ok,reply,toolsUsed}` (workflow 24, LIVE)
- `site-outreach-discover` — POST `{propId,address,categories?}` → writes `site_outreach/{place_id}` (workflow 25, LIVE)
- `nearby-prospect-research` — POST `{id,name,website,search_category,google_category,address,city,state}` → PATCHes `site_outreach/{id}` (workflow 26, status unconfirmed)
- `contact-enrich-test` — POST `{name,website,city,state,category}` or `{reveal_id}` (workflow 27, PDL, live but abandoned for this purpose)
- `contact-enrich-uplead-test` — POST `{domain,job_function?,job_sub_function?,management_level?,title?,num_results?,count_only?}` (workflow 28, UpLead, NOT yet imported)
- n8n base: `https://ailinker.item.com`

---

## Deferred / not-built feature ideas (revisit if they keep coming up)
- **Leads Do/Wait rethink** (raised 2026-07-06, tabled): replace the Do/Wait split with an explicit next-action+date per lead, banded by urgency. Justin: "interesting, but not sure it's worth it."
- **Auto-generating a *Claude* follow-up draft (workflow 17) the instant `followup_due` flips true** — currently only drafts on manual ✨ click. Deliberately NOT built yet (2026-08-19, Justin's call) — the generic-template auto-escalation (see Open items above) ships first so the cadence itself gets proven out before adding Claude generation cost/complexity on top.
- **Auto-staging a ready-to-send Outlook draft** instead of a `mailto:` redirect.
- **A prompt-comparison view** for the per-property cold-draft A/B testing feature (grouped by `prompt_name`, once real reply/interest data accumulates).
- **Side-by-side card comparison** in the main app (would need the Preact migration).
- Reply Assistant (`REPLY_ASSISTANT_SPEC.md`) — designed, never built.
