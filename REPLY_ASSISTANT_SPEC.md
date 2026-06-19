# Reply Assistant — Design Spec

**Status:** Proposed · **Author:** drafted with Claude for Justin Cho · **Date:** 2026-06-17
**Goal:** Bring the "select a lead email → generate an availability-matched reply → refine it conversationally" workflow *inside* Do or Wait, so it no longer lives half in Claude and half in the app.

---

## 1. Why

Today the workflow is split:
- **Do or Wait** holds the leads, the live availability (`availability` collection, synced from SharePoint via n8n), and pricing.
- **Claude (separately)** is where the actual work happened: match the broker's prospects to available units, apply pricing, draft the reply in house style, and — critically — **iterate by conversation** ("wider net," "drop Fontana," "soften that line," "include holds if thin").

The matching is deterministic and portable. The thing the static app *cannot* do today is the **conversational refinement** — that needs a live LLM endpoint. This spec covers closing both halves.

## 2. What "done" looks like (UX walkthrough)

On the **Leads** tab, open a lead that has an inbound email (e.g. Kaeden / eXp):

1. Click **✍️ Draft reply**. A panel opens showing the lead's latest inbound email on the left.
2. Pick a **reply type**: `Present Availability` · `Follow-up` · `Intro / Flexibility` · `Custom`.
3. For `Present Availability`, the app:
   - triggers a **fresh availability sync** (reuses the existing sync-first export logic),
   - runs the **matcher** (below) against the prospect requirements parsed from the email,
   - sends the matched units + pricing + house style + the inbound email to **Claude**, and
   - drops an **editable draft** into the panel.
4. A **chat box** sits under the draft. Justin types "wider net on #3" or "drop Fontana, soften the usage line" → the draft updates in place. Same back-and-forth as working with Claude directly.
5. **Save** → writes the final draft to the lead thread (and/or pushes an Outlook draft via the existing Graph integration). Optionally logs a contact brief.

## 3. Architecture / data flow

```
Browser (Do or Wait, index.html)
  │  1. fresh sync (existing AVAIL_WEBHOOK → n8n WF4 → Firestore)
  │  2. read availability + pricing from Firestore (already live in availMap / pricing)
  │  3. run matcher() in-browser (deterministic JS — no LLM)
  │  4. POST {emailText, replyType, tone, matchedUnits, pricing, houseStyle, profile_md, chatHistory}
  ▼
Cloudflare Worker  (existing: plain-credit-5962...workers.dev)  — holds the LLM_API_KEY as a secret
  │  → forwards to the LLM Messages API (or via n8n; either works)
  ▼
LLM  → returns {draft, proposedProfileUpdate?}
  ▲
  └─ draft renders in the panel; chat turns repeat step 4 (sending profile_md, not full history)
     proposed profile update shown as a diff → you accept → write leads/{id}.profile_md
Save → Firestore (lead thread entry) and/or Outlook draft (existing n8n Graph cred)
```

Two viable routes for the LLM call — **pick one in build**:
- **A. Cloudflare Worker → Anthropic directly.** Simplest, lowest latency. Add `CLAUDE_API_KEY` as a Worker secret; Worker adds the `x-api-key`/`anthropic-version` headers and proxies. Browser never sees the key.
- **B. n8n workflow → Anthropic.** Keeps all automation in n8n (consistent with WF1–10), easier to log/observe, but one more hop. Reuses the Worker only as the CORS proxy it already is.

Recommendation: **B** if you want the call logged/auditable alongside the other workflows; **A** if you want it snappy. Either keeps the key server-side.

## 4. Components

### 4.1 Matcher (deterministic, in-browser JS)
Port the logic already proven out with Claude:
- **Input:** prospect requirements `{sfMin, sfMax, budget, clearMin, areaPref, use}` (one per prospect) + `availMap` (live) + site rate card.
- **Rules:** unit is a candidate if `Vacant && !hold && type∈{WH,OFFICE} && sf>0` and `sf` within ±25% of the requested range; `monthly = sf × siteRate(band)` (Walnut "K" units = $2.50/SF; office uses office rate); keep `monthly ≤ budget`; sort by **proximity rank** (OC → border → City of Industry/Walnut → Compton → IE) then price.
- **Thin handling (≤ 2 in-budget):** also return a **wider-net** list (over budget, flagged `+$X`) and **HOLD units with their `notes`** (a hold may free up / be negotiable; several sit in Santa Ana / La Mirada, closest to OC).
- **Output:** structured match object per prospect → fed to the LLM and also renderable as a table in-app.

This is the same math currently run in Python; it becomes a pure JS function (no API cost, instant).

### 4.2 Reply types (prompt presets)
Each type = a system/instruction preset that wraps the matched data:
- **Present Availability** — per-prospect options, rough monthly numbers, house style, low-pressure, qualifying questions where useful.
- **Follow-up** — value-add nudge, never the word "follow up" (per house rule), references prior touch.
- **Intro / Flexibility** — the warm "happy to help, here's what could fit" opener.
- **Custom** — freeform; the chat box is the whole interaction.

House style + the "never say follow up / lead with value / low-pressure" rules live in a constant the presets share.

**Tone control.** Alongside reply type, a **Tone** selector shapes voice per draft: `Warm / low-pressure` (default) · `Concise` · `Formal` · `Enthusiastic` · `Custom`. There are three layers, applied in order: (1) **house style** (baseline, always on), (2) **per-lead tone guardrails** stored in the lead Profile (§4.5) — e.g. "this broker likes brevity, no fluff," (3) **this-draft tone** from the selector / chat. Lower layers override higher ones, so a one-off "make it more formal" doesn't permanently change the lead's voice unless you save it into the profile.

### 4.5 Per-lead Profile (persistent context — the "customer_profile.md")
A living markdown brief per lead that the assistant **reads on every draft/turn** and **proposes updates to** as the thread progresses — so context never has to be reloaded. Stored as `leads/{id}.profile_md` (markdown text), editable in-app in a textarea (view/edit toggle, same UX as the Notes tab). It mirrors the per-lead `CLAUDE.md` practice already used in the Sales folders.

**What it holds (suggested sections):**
- **Who / where we are** — contact, company, stage, last touch, what's outstanding.
- **What's been said** — running summary of Justin's instructions and decisions ("offer Reyes/Stimson, soft-pedal Santa Ana," "drop Fontana," "6 prospects with specs").
- **Tone guardrails** — durable voice rules for *this* lead (brevity, formality, words to avoid).
- **Constraints / facts** — budgets, target areas, usage caveats, deposit method, anything quoted.
- **Open questions** — what still needs confirming before quoting.

**How it stays current (with guardrails against drift):**
- On reading a **new inbound email** or after you give instructions in chat, the assistant returns a **proposed profile update** as a diff (added/changed lines), not a silent overwrite.
- **You confirm** (one-click accept, or edit then save) before it persists — so the profile can't quietly corrupt. Append/merge by section rather than rewrite; stamp `profile_updated_at`.
- The profile is the **compact running context** sent to the model each turn (plus the current email + matched data), instead of replaying the whole history → cheaper, faster, and more consistent. Strong **prompt-caching** candidate.

### 4.3 Chat refinement loop
- Maintain `chatHistory[]` (alternating user instruction / assistant draft) in app state.
- Each turn re-sends: house style + matched data (or current draft) + history + new instruction. Static context (house style, pricing) is a good **prompt-caching** candidate to cut cost/latency.
- Draft area is directly editable too; manual edits become the new baseline for the next turn.

### 4.4 Draft storage / send
- **Save to thread:** new lead entry `kind:'note'` (or a new `kind:'draft'`) with the text — keeps it with the lead, doesn't touch the follow-up clock.
- **Push to Outlook:** reuse the n8n Graph path (cred `Microsoft account 3`) to create a draft in Justin's mailbox for final review/send. (Mirrors how `pending_email` already surfaces n8n-drafted emails for approval.)

## 5. Firestore additions (minimal)
- `leads/{id}.profile_md` — markdown string, the persistent per-lead Profile (§4.5). Editable in-app; assistant proposes updates you confirm.
- `leads/{id}.profile_updated_at` — ISO timestamp of the last profile change.
- `leads/{id}.reply_drafts[]` *(optional)* — `{type, tone, text, created_at}` history, or just reuse thread entries.
- Drafts can be saved as thread entries; only `profile_md` / `profile_updated_at` are needed for v1.

## 6. API requirement & cost — the approval ask

**What's needed:** one **LLM API key**, stored as a server-side secret in the Cloudflare Worker or n8n. This is the only new external dependency.

**Model choice — recommended default: Claude Sonnet 4.6.**
Rationale: drafting/editing short, house-style sales emails with conversational refinement is a *writing* task, not a hard-reasoning one — so model quality differences are modest here, and **correctness is already guaranteed by the deterministic matcher** (the model only writes prose around verified units/SF/pricing; it can't invent a unit or a number). Sonnet is chosen because its strengths are exactly what's left: tone fidelity (low-pressure, "never say follow up"), following fussy multi-part instructions first-try ("wider net on #3, drop Fontana, soften that line"), and cleanly juggling messy multi-prospect emails with holds/notes — i.e. fewer corrections. At our volume that polish costs **~$5/month** (see below), which makes "buy the most reliable writer" an easy call.

**Architecture is model-agnostic:** the provider + model is a single config value in the Worker/n8n call. Swapping is a one-string change, no rework — so this choice carries no lock-in. **Alternate (near-peer):** GPT-5 (full) — comparable quality and cost; pick if OpenAI is preferred. Cheaper tiers (GPT-5 mini, Gemini 2.5 Flash, Claude Haiku 4.5) are perfectly capable for this task if cost ever needs trimming, especially for the refinement turns.

**Current API pricing** (per million tokens, verified 2026-06-17):
| Model | Input | Output | Role |
|---|---|---|---|
| **Claude Sonnet 4.6** (default) | $3 | $15 | Drafting + refinement |
| GPT-5 (full) | ~$3–higher | ~$15+ | Alternate, near-peer |
| Claude Haiku 4.5 | $1 | $5 | Cheap-tier option |
| Gemini 2.5 Flash | $0.30 | $2.50 | Cheap-tier option |
| GPT-5 mini | $0.125 | $1.00 | Cheapest option |

Prompt caching (~90% off cached input) and batch (50% off) available on Claude.

**Cost estimate at our volume** (rough, conservative):
- One **Present Availability** draft ≈ 3k input + ~700 output tokens → **~$0.02** on Sonnet (~$0.008 on Haiku).
- Each **refinement turn** ≈ similar → ~$0.02 on Sonnet.
- A typical lead reply (1 draft + ~4 tweaks) ≈ **~$0.10**.
- **50 lead replies/month ≈ $5/month**; 200/month ≈ $20/month. Prompt caching the static context pushes this lower.

So: **single-digit to low-double-digit dollars per month** at realistic volume — usage-based, no seat/subscription. Worth framing the approval as "pennies per client reply."

## 7. Security
- API key lives **only** in the Worker/n8n server side — never in `index.html` or the browser (the app is public on GitHub Pages, so a client-side key would be exposed).
- The Worker should restrict the proxied endpoint (e.g., simple shared token / origin check) so it can't be used as an open Claude relay.
- No customer PII beyond what's already in the lead/email goes to the API; availability + pricing are internal but not sensitive.

## 8. Build phases
1. **Matcher in JS** — port the matching; show matched units per lead in-app (no LLM). *Immediately useful, zero API.*
2. **Per-lead Profile** — `profile_md` field + in-app view/edit (no LLM yet; you write it, or seed from existing Sales `CLAUDE.md`). Gives standing context immediately.
3. **Draft generation** — wire the LLM endpoint (Worker/n8n + key); reply type + tone produce a one-shot draft into an editable panel, reading the Profile as context. *Needs API approval.*
4. **Chat refinement + profile auto-update** — conversational loop (sends Profile, not full history) + proposed profile-update diffs you confirm + prompt caching.
5. **Send path** — save to thread + push Outlook draft.
6. **Polish** — more reply types/tones, auto-parse prospect specs from the raw email, per-prospect "regenerate."

Phase 1 can ship before the API is approved; 2+ depend on the key.

## 9. Open questions / decisions
- **Worker vs n8n** for the LLM call (§3 A/B).
- **Where do prospect specs come from** — typed/pasted into the panel for v1, or auto-parsed from the inbound email (LLM extraction) later?
- **Draft destination** — thread entry only, Outlook draft, or both, for v1.
- **Profile auto-update UX** — always show a diff to confirm (recommended), or allow trusted auto-save for low-risk additions? And do we cap/auto-summarize the Profile so it doesn't grow unbounded over a long thread?
- **Who else uses it** — if it's just Justin, simplest auth on the Worker is fine; if the team, revisit.

## 10. Out of scope (for now)
Auto-sending email (always human-approved), CRM sync beyond the lead thread, multi-language, attachments/brochure auto-insertion (could be a later reply-type enhancement).

---

*Sources for pricing: [Claude API pricing](https://docs.claude.com/en/docs/about-claude/pricing) · [Claude Haiku 4.5](https://www.anthropic.com/news/claude-haiku-4-5).*
