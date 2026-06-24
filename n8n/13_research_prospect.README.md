# Workflow 13 — Research & Personalize (OpenAI web search)

**Status:** ready-to-import. **Request-driven** (webhook, not cron) — fired by the 🔎 Research button on an Outreach prospect. Import it and **set it Active** (it's a webhook, so it must be active to receive calls).

## What it does

Given a company, OpenAI's **`gpt-4o-search-preview`** searches the web *inside the API call*, then writes (1) a **research brief** (recent news, what they sell, products, fit signals) and (2) a **personalized cold email** that references real facts about that company. Both are written back onto the Firestore `outreach/{id}` doc, and the app's Outreach modal refreshes to show them. No Claude, no separate search service — just your OpenAI key.

## Flow

```
Webhook (POST /research-prospect  {id, company, domain, industry, location})
  → Build OpenAI request → OpenAI research + draft (gpt-4o-search-preview, web_search_options)
  → Build Firestore patch → Write research to Firestore (PATCH outreach/{id}) → Respond
```

## Trigger path

The app POSTs to `…workers.dev/webhook/research-prospect` (the same Cloudflare proxy as your other webhooks), which forwards to this workflow's webhook. The 🔎 button is in each prospect's detail modal.

## Credentials (both already exist)

- **OpenAI API** (`openAiApi`) — on *OpenAI research + draft*. Model `gpt-4o-search-preview`. **Note:** search-preview models don't accept `temperature`/`response_format`, so the prompt asks for JSON and the next node parses it.
- **Google service account** (`Firebase_SDK_do_or_wait`) — on *Write research to Firestore* (PATCH, updates only `research_brief`, `email_subject`, `email_body`, `researched_at`, `company`, `domain` — the rest of the doc is untouched).

## Cost

Per click: a small OpenAI **web-search tool fee** + tokens (~1 short search + ~1k output tokens). On-demand, one prospect at a time — pennies each.

## Setup

1. Import `13_research_prospect.json`, set the 2 credentials, **activate** it.
2. Confirm your Cloudflare worker forwards `/webhook/research-prospect` (it forwards `/webhook/*` like the others, so nothing to add).
3. Deploy the updated `index.html` (adds the 🔎 button + `RESEARCH_WEBHOOK`).
4. Open a prospect in the Outreach tab → **🔎 Research & draft** → ~15s later the brief + rewritten email appear in the modal.

## Voice

The draft currently uses a clean, friendly-direct sales voice. To make it sound like **you**, paste a few of your real sent emails and I'll fold your tone into the system prompt (one-line change in *Build OpenAI request*).

## Files
- `13_research_prospect.json` — import this.
- `research_prospect.nodes.js` — paste-ready Code-node copies.
