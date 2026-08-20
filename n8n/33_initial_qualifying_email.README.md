# Workflow 33 — Send Initial Qualifying Email

Sends Cubework's standard first-touch qualifying email automatically, the moment a new
Yardi-sourced lead lands in Firestore. This is deliberately narrow — it does **not**
revive the 5-touch sequencer (workflows 1–3, still off by design), and it does not touch
manually-created or property_outreach-promoted leads.

---

## Verification pass (2026-08-18, before first import)

Ran the actual Code-node JS against mocked Firestore/Graph responses (not just read
through it) before handing this off. Caught and fixed three real issues:

- **Dropped the template's `* ` bullet markers** — the first draft's amenity list was
  missing the leading `* ` on all 13 lines from
  `Sales/Templates/First-Touch Qualifying Email Template.md`. Fixed; verified the
  rendered body now has all 13 bullets intact.
- **`Draft created OK?` used a string `notEmpty` operator** that wasn't confirmed to
  exist in this n8n version's IF-node schema. Replaced with the same
  `{{ $json.id ? 1 : 0 }} > 0` number-comparison shape `Any valid leads?` already uses
  (proven working in workflow 2) — and confirmed it correctly routes both the
  success case and the `continueOnFail`-error case (`{error:...}`, no `id`) to the
  right branch.
- **`Send draft message` was sending an unnecessary empty `{}` body** on the Graph
  `/send` action, which takes no request body per the Graph API. Switched to no body.

Also re-confirmed: JSON parses, all three Code nodes pass `node --check`, and the full
mock pipeline (real-shaped lead + a "Jay Test" row + a lead missing an email) filters
down to exactly the one real lead, splits Calicold's real `location` string into
property + address correctly, and produces a correctly-shaped Firestore patch that
appends to (rather than clobbers) existing `email_links`/`entries`.

What's still *unverified* because it needs a real send (see "Things to verify" below) —
this pass checked the code is correct, not that Graph/Outlook behave exactly as assumed.

---

## Dependency: the workflow 32 fix must ship first (or same time)

This workflow keys off two fields — `source: "yardi"` and `qualifying_email_status:
"pending"` — that only exist on leads created by the **updated**
`32_yardi_sheet_to_firestore_sync_fixed_v2.json` (added 2026-08-18, same edit that already
had the pending `createdAt`/`archived`/`seq_status` fix). If workflow 33 is imported and
activated before the new workflow 32 is re-imported, it's harmless — it'll just find zero
matching leads every run until 32 ships. Once 32 is live, every *new* Yardi lead from then
on gets both fields at creation, and workflow 33 picks them up within its 2-minute poll.

**Why not key off `yardi_milestone` instead** (worth remembering if this ever comes up
again): checked two real leads live on 2026-08-18 — Calicold (a genuine fresh Yardi lead)
has `yardi_milestone: ""` (blank), while an old SunStrong/Rigoberto deal from June, already
at `contract_sent`, has `yardi_milestone: "Tour Scheduled (Sales)"` set. Something else
syncs that field onto matched leads independent of how the doc was created, so it's not a
safe marker for "this is a fresh lead from this pipeline." `source`/`qualifying_email_status`
are set *only* by this one node, so an EQUAL filter on both is safe.

**No backfill needed either way** — every lead already in Firestore before the workflow 32
fix ships has neither field, so workflow 33's query structurally can't match historical
backlog. Nothing to clean up before turning this on.

---

## What it does

1. **Every 2 minutes**, queries Firestore for `leads` where `source == "yardi"` AND
   `qualifying_email_status == "pending"` (same explicit-value-match style every other
   query in this app already uses, e.g. workflow 2's `seq_status == "send_approved"`).
2. **Parses + filters**: skips anything with "test" in the company/contact/name/email
   (the loose-end "Jay Test"/"Justin Test" rows aren't filtered out upstream in
   `yardi_export.py`, so this is the only guard against emailing them for real), and
   skips anything without a plausible email address.
3. **Renders** the General/location-known variant of
   `Sales/Templates/First-Touch Qualifying Email Template.md` verbatim — amenity bullets,
   no pricing, no tour language, ends at "Best," with no signature block. Workflow 32
   writes `location` as `"{property} ({address})"`, so this splits it back into the
   property name and street for the template's "our [Location] location on
   [Street/Area]" line.
4. **Sends via Graph, two calls**: `POST /messages` (create as a draft — this is the one
   that returns `id`/`conversationId`/`webLink`, since `POST /sendMail` returns nothing),
   then `POST /messages/{id}/send`. This is exactly why `Mail.ReadWrite` was needed
   alongside `Mail.Send` — a plain send-mail call can't hand back anything to link.
5. **Records the send** on the lead: `qualifying_email_status → "sent"`,
   `qualifying_email_sent_at`, a new `email_links[]` entry (same shape the app already
   renders — shows up immediately as a clickable thread chip, and the app's existing
   reply-refresh polling picks up future replies on it with no new UI work), and a thread
   entry (`kind: "email"`) so it shows in the lead's activity like any other outbound touch.
6. **Posts a Teams card** ("📧 Qualifying Email Sent") to the same webhook workflow 32
   already uses for new-lead notifications — so you see every send happen without
   checking n8n, per your ask to have visibility while this beds in.

## Reused, not new

No new Azure app, no new credentials. Reuses:
- `Google Service Account — do-or-wait` (Firestore)
- `Microsoft OAuth2 — Cubework Outlook` (Graph — now needs `Mail.Send` + `Mail.ReadWrite`
  granted with admin consent, which you said is done)
- The same Teams/Power Automate webhook URL workflow 32 posts to
- `OUTLOOK_USER_ID` env var, already set to `justin.cho@cubework.com`

## Things to verify on the first real send (flagged, not yet confirmed live)

- **Subject line**: the source template has no subject of its own (it's normally used as
  a manual reply). This workflow uses `"Re: Your inquiry about Cubework {{property}}"` —
  confirm the wording, or tell me what you'd rather it say.
- **webLink after send**: the draft's `webLink`/`conversationId` are captured *before* the
  `/send` call moves the message to Sent Items. `conversationId` is a thread-level id and
  is unaffected by folder moves; `webLink` should also keep working since Graph's send
  action moves the existing item rather than recreating it — but this project has already
  hit real webLink quirks before (see `fixThreadUrl()`), so worth clicking the first
  real `email_links` chip in the app to confirm it opens the actual sent thread.
- **Address parsing**: verified against Calicold's real `location` string
  (`"CA Santa Fe Springs (8741 Pioneer Blvd., Santa Fe Springs, CA, 90670)"`) — splits
  correctly into property + address. Locations with no address on file (just the bare
  property name, no parens) fall back to the template's cold "share your location
  preference" line instead of a broken "on undefined."
- **`graphMessageId` — added 2026-08-19, needs the same live-send confirmation as
  webLink above.** Justin's call: don't throw away the raw Graph message id the
  "Create draft message" response returns — a future workflow that sends real
  follow-ups as actual in-thread replies (rather than a disconnected new email) needs
  it to call Graph's `POST /messages/{id}/reply`, and `webLink`/`conversationId` alone
  aren't enough for that (they're click-to-open-only, not send-a-reply-to). Now stored
  as `email_links[].graphMessageId` in the "Build lead patch" node, captured from
  `draft.id` before the `/send` call moves the item to Sent Items — same timing as the
  existing `webLink` capture.
  **Immutable-id header — checked and added directly to `33_initial_qualifying_email.json`
  (2026-08-19), not left as a to-do:** Graph message ids are only guaranteed stable
  across a folder move (Drafts → Sent Items counts) if the request used the `Prefer:
  IdType="ImmutableId"` header. Checked both Graph HTTP Request nodes directly — neither
  **"Create draft message"** nor **"Send draft message"** had it. Added
  `sendHeaders: true` + a `Prefer: IdType="ImmutableId"` header parameter to both (same
  `headerParameters` shape workflow 17's Claude node already uses for its
  `anthropic-version` header). **Still needs a real live send to fully confirm**
  end-to-end — this only guarantees the id itself won't change across the folder move;
  it doesn't yet prove a `/reply` call against that id actually lands in the same
  Outlook conversation the way clicking Reply on the webLink would. Confirm on the first
  live send: capture the id, send, then immediately try a Graph `GET /messages/{id}`
  against the captured id to see if it still resolves post-send.

## Deploy

1. Re-import `32_yardi_sheet_to_firestore_sync_fixed_v2.json` into the live workflow 32
   (already on your list; this edit just rides along with it).
2. Import `33_initial_qualifying_email.json` as a new workflow.
3. Open the four HTTP Request nodes and confirm credentials map to the two existing ones
   above (replace `REPLACE_WITH_CREDENTIAL_ID`).
4. Confirm `OUTLOOK_USER_ID` is set (already is, per Step 2 of `SETUP.md`).
5. **Activate.** Watch the first several real sends via the Teams card before considering
   it fully trusted unattended — same soft-launch approach the Yardi Lead Watcher itself
   went through.

## Testing before going live

1. Manually create a test lead in Firestore (or via the app) with `source: "yardi"`,
   `qualifying_email_status: "pending"`, a real `location` in the
   `"Property (address)"` form, and an email address you control.
2. In n8n, open workflow 33 → **Test workflow**.
3. Confirm the email arrives, the lead now shows `qualifying_email_status: "sent"` and a
   new `email_links` entry, and the Teams card posted.
4. Click the new `email_links` chip in the app and confirm it opens the real sent thread.
