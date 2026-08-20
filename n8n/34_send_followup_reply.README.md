# Workflow 34 — Send Follow-up Reply

Sends a follow-up as a **real Outlook reply** into an existing conversation — the piece
Justin's batch-approve goal has been blocked on since the 2026-08-20 pivot (see project
memory `followup-auto-escalation.md`). Everything upstream of this (capturing
`graphMessageId` on workflows 33 and 11) was groundwork; this is the workflow that
actually calls Graph's reply API against those captured ids for the first time.

**Currently restricted to one lead — see "Safety gate" below. Do not remove that gate
without Justin's explicit sign-off.**

---

## What it does

1. **Webhook** receives `{ leadId, subject, body, label, followupNum }` from the app
   (`POST /webhook/send-followup-reply`, same `allowedOrigins: "*"` CORS pattern as
   workflows 11/17).
2. **Safety gate ("Test lead only?")** — hardcoded to only let `leadId ===
   "le178725127597794851"` (Bot Fake, contact `jchoustin91@gmail.com`) through. Anything
   else gets `{ ok: false, error: "blocked_not_test_lead" }` with no Graph calls made at
   all — not even a Firestore read. See "Safety gate" section below.
3. **Get lead** — plain Firestore `GET` on the doc (we already have the id, no need to
   search/runQuery like workflow 33 does for its Yardi poll).
4. **Pick reply target** — decodes the Firestore doc, walks `email_links[]` backward for
   the last entry with a non-empty `graphMessageId` (array is append-only, so last =
   newest — same assumption workflows 33/11 rely on).
5. **Has target?** — if nothing in `email_links[]` has a `graphMessageId` yet (e.g. this
   lead's thread was never resolved, or workflow 11 hasn't been re-run since its own
   `graphMessageId` fix), responds `{ ok: false, error: "no_graph_message_id" }` instead
   of failing silently.
6. **Create reply draft** — `POST /messages/{id}/createReply` (the `Prefer:
   IdType="ImmutableId"` header on every Graph call, same as workflows 33/11). This
   creates a **draft** reply — pre-addressed to the original sender, subject
   auto-set to `RE: ...`, original message auto-quoted below — and returns the full
   message resource (`id`/`conversationId`/`webLink`), the same reason workflow 33
   creates-then-sends instead of calling `/sendMail` directly.
7. **Draft created OK?** — same `$json.id ? 1 : 0 > 0` shape as workflow 33's check;
   `continueOnFail` on the HTTP node means a Graph error lands here as `{error:...}`,
   routing to its own error Respond node instead of killing the run.
8. **Convert body to HTML** — turns the app's plain-text follow-up body (paragraphs
   separated by `\n\n`, soft breaks by single `\n`) into HTML `<div>`/`<br>` markup.
   **This conversion didn't exist before this workflow.** Graph HTML bodies don't
   auto-render raw newlines the way `mailto:` (and a plain-text compose window) do — a
   bare `\n\n` just sits there as literal whitespace once `contentType` is `'HTML'`.
9. **PATCH reply draft body** — replaces the draft's body with that HTML. **This
   overwrites the quoted-original-message content Graph auto-included on createReply** —
   deliberate for now, to keep this simple and match what the app's existing manual
   `mailto:` follow-ups already look like (no quoted history). Revisit if Justin wants the
   quoted thread kept visible in the reply.
10. **Send reply** — `POST /messages/{draftId}/send`, no body (same as workflow 33's
    `/send` call).
11. **Build lead patch** — appends a new `email_links[]` entry using **this reply's own**
    `graphMessageId`/`conversationId`/`webLink` (not the id we replied into) — so a
    follow-up #2 later chains onto follow-up #1's message instead of always replying to
    the original qualifying email. Also appends an `entries[]` row and updates the
    glance fields `last_followup_label` / `last_followup_num` / `last_followup_sent_at`
    (round 6 of the 2026-08-19 escalation work — this workflow is now responsible for
    keeping those current for this send path, replacing the app's own
    `logFollowupSent()`).
12. **Update lead in Firestore** — same PATCH-with-`updateMask` pattern as workflow 33.
13. **Notify Teams** — same Power Automate/Teams webhook workflows 32/33 already post to,
    card titled "✉️ Follow-up Sent (reply)".
14. **Respond - success** — `{ ok: true, leadId, graphMessageId }`, CORS header included.

Error branches (blocked lead, no thread, draft-create failure) each get their own
`respondToWebhook` node so the app always gets a clean JSON response instead of a raw
n8n error page.

---

## Safety gate (Justin's explicit call, 2026-08-20)

> "We should keep it only for my fake lead though. I don't want it to send out anything
> to real clients yet."

The very first node after the webhook hardcodes the check:

```
leftValue:  {{ $json.body.leadId }}
rightValue: "le178725127597794851"
operator:   string equals
```

`le178725127597794851` is Bot Fake — the dummy lead built specifically for this test
(contact `jchoustin91@gmail.com`, already has a real `graphMessageId` from workflow 33's
qualifying-email send). Anything else short-circuits before any Firestore read or Graph
call happens at all.

**This is deliberately the simplest possible gate — a hardcoded id, not a lead flag or
config toggle** — specifically so it can't accidentally match a real lead through some
data quirk. It is also deliberately temporary. Do not widen or remove it without Justin
explicitly signing off, and when that happens, this needs a real design pass (this was
already flagged as a to-do before batch-approve UI work starts — see
`followup-auto-escalation.md`): a config-driven allowlist, a `testLead` flag read from
Firestore, or the real batch-approve review step, rather than just deleting this IF node.

---

## Real risk — RESOLVED 2026-08-20, live-tested twice

Workflows 33 and 11 only proved a `graphMessageId` **survives capture** (and, for 33,
survives the send/folder-move). Neither of them ever called `/createReply` against one.
This was the first workflow to actually make that Graph call, and whether it lands
correctly in the same Outlook conversation was completely unproven going in.

All three open questions below are now confirmed, via two real live sends against Bot
Fake (`jchoustin91@gmail.com`), after the recipient and signature fixes documented in the
"Live test" sections below:

- **Threading**: confirmed — the reply shows up in the same conversation thread as Bot
  Fake's original qualifying email, in the actual Outlook/Gmail conversation view, not as
  a separate item.
- **Overwriting the draft body** (dropping Graph's auto-quoted original message, step 9)
  does not break threading or display — confirmed same test.
- **Chaining**: confirmed — a second follow-up (`followupNum: 2`), sent using the walk-
  backward logic in "Pick reply target," replied into follow-up #1's own captured
  `graphMessageId` and threaded correctly, not back into the original qualifying email.
  This is the exact mechanism batch-approve depends on for leads with a longer follow-up
  history, and it works.

---

## Live test #1 (2026-08-20) — real bug found and fixed

First real send against Bot Fake: Teams card posted ("Follow-up Sent (reply)"), `Send
reply` node reported success in 253ms — looked clean end to end. **It wasn't.** Checking
the actual n8n execution data for the `Send reply` node's input showed:

```
toRecipients: [ { emailAddress: { name: "Justin Cho", address: "justin.cho@cubework.com" } } ]
```

The reply was addressed back to Justin, not to Bot Fake (`jchoustin91@gmail.com`) — it
never left his own mailbox in any meaningful sense; it just landed in his own inbox as if
he'd emailed himself, and the workflow reported success because, from Graph's point of
view, it was one.

**Root cause:** `POST /messages/{id}/createReply` builds its draft's `toRecipients` from
the *sender* of the message being replied to — standard "hit Reply" semantics. But
`email_links[].graphMessageId` always points at the last **outbound** message (the
qualifying email, or a prior follow-up) — something Justin/the system sent, not something
the lead sent. Replying to your own sent message means Graph's default recipient is
you. This isn't a fluke of the test lead; it will happen on every real lead too, every
time, since the whole design point of walking `email_links[]` is to find the last message
*we* sent.

**Fix applied:** `Convert body to HTML` now also passes through `picked.lead.email` as
`toEmail`, and `PATCH reply draft body` now explicitly overwrites `toRecipients` to
`[{ emailAddress: { address: toEmail } }]` in the same call that sets the HTML body —
never trusting whatever `createReply` defaulted to. Conversation threading itself
(`conversationId`) is a property of the message/thread, not of who mails it, so forcing
the recipient this way shouldn't affect threading — but that's exactly the next thing to
confirm live, not assume.

**Not yet re-tested after this fix** — the change is in `34_send_followup_reply.json` as
of this write-up, but the next live send is what actually proves it works. Re-run the full
test sequence below (steps 3-4 especially) before trusting this.

---

## Live test #2 (2026-08-20) — recipient + HTML paragraphs confirmed, signature missing

After the recipient fix: real send landed at `jchoustin91@gmail.com` with correct
paragraph breaks (the `\n\n`-to-`<div>` conversion rendered properly, not squished). Two
real things confirmed working. But the email had no signature — same gap workflow 33 hit
and already solved, just not carried over here. This is an automated Graph send, not
something going out through Justin's actual Outlook client, so there's no client-side
signature to fall back on (unlike the app's manual `mailto:` follow-ups, where Outlook
auto-signs — see project memory `no-signature-block-in-drafts.md`, which is specifically
about that different path and doesn't apply to this one).

**Fix applied:** `Convert body to HTML` now appends the exact same signature block
workflow 33's `Render qualifying email` node already uses (name/title, address, cell,
Cubework logo, confidentiality notice) after the converted body, inside the same wrapping
`<div>`. Verified by running the actual node code standalone with a mock draft/lead —
output HTML confirmed correct paragraph structure followed by the full signature block.

**Not yet re-tested live** — same as the recipient fix above, this needs one more real
send to confirm the signature actually renders correctly in Outlook (not just that the
HTML string looks right in isolation).

---

## Live test #3 (2026-08-20) — signature confirmed, real content, chaining confirmed

Third send: `followupNum: 2`, real value-prop copy (no long commitment, flat rate, no
NNN, fast move-in) instead of the earlier throwaway test text. Recipient confirmed
displaying as Justin sending to Bot Fake, signature rendered correctly (name/title,
address, cell, logo, confidentiality notice all present and formatted), paragraph breaks
clean. Justin confirmed directly: **same conversation thread as the original qualifying
email and follow-up #1.** This closes out every item in the "Real risk" section above —
recipient, HTML rendering, signature, threading, and chaining are all now proven with
real sends, not just code review.

**Still not tested:** the safety-gate block path (step 8 in the test sequence below —
POSTing with a non-Bot-Fake `leadId` and confirming it's refused). Worth doing once before
calling this fully done, even though it's the simplest node in the workflow.

---

## Reused, not new

No new Azure app, no new credentials, no new Teams webhook. Reuses exactly what
workflow 33 already established:
- `Firebase_SDK_do_or_wait` — Firestore (`googleApi`, id `7IVvQuErxEJPoaMY`)
- `outlook_send` — Graph (`oAuth2Api`, id `fg9qH0vT1CbMbZzU`)
- The same Power Automate/Teams webhook URL

---

## Testing before trusting this live

1. Import `34_send_followup_reply.json` as a new workflow. It ships `"active": false` —
   leave it that way; test via n8n's "Listen for test event" / manual execute, not a live
   activation, since this has no schedule trigger to accidentally fire anyway.
2. Open the five HTTP Request nodes (`Get lead`, `Create reply draft`,
   `PATCH reply draft body`, `Send reply`, `Update lead in Firestore`) and confirm each
   credential dropdown resolved correctly after import.
3. POST to the webhook:
   ```json
   {
     "leadId": "le178725127597794851",
     "subject": "quick nudge",
     "body": "Hi there,\n\nJust wanted to put Cubework back on your radar.\n\nAny updates?\n\nBest,",
     "label": "Nudge",
     "followupNum": 1
   }
   ```
4. **Check the inbox at jchoustin91@gmail.com** — does the reply show up threaded under
   Bot Fake's original qualifying email, or as a separate item? This is the real test;
   everything else can be perfectly correct and this can still fail.
5. Check Firestore: new `email_links[]` entry with a *different* `graphMessageId` than
   the one you replied into, new `entries[]` row, `last_followup_*` fields all set.
6. Check the Teams card posted.
7. POST again with `followupNum: 2` — confirm it replies into follow-up #1's message
   (walk-backward logic in "Pick reply target" should pick up the newest link), not back
   into the original qualifying email. This is the actual chaining behavior batch-approve
   depends on.
8. Try POSTing with some other real `leadId` — confirm you get back
   `{ ok: false, error: "blocked_not_test_lead" }` and nothing else happens (no Firestore
   read, no Graph call, no Teams card).

Only after all of the above checks out should this move toward wider use — and even
then, per the safety gate section above, that needs Justin's explicit sign-off plus a
real (non-hardcoded) gate design, not just deleting the IF node.

## Deploy

1. Import `34_send_followup_reply.json` as a new workflow (new webhook path,
   `send-followup-reply` — nothing to import over).
2. Confirm credentials on the five HTTP nodes.
3. Run the full test sequence above against Bot Fake.
4. Leave `active: false` and the safety gate in place until Justin says otherwise.
5. Once proven: wire the webhook through the existing Cloudflare Worker proxy (same
   pattern as `yardi-sheet-sync`/`resolve-thread`/`generate-followup`), then build the
   batch-approve UI in `index.html`, then design the real (non-hardcoded) safety gate for
   wider rollout — one step at a time, confirming with Justin before each.
