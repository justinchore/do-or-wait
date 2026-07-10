# Workflow 24 — Assistant Chat (MCP connector)

Backs the in-app **🤖 Assistant** tab — a chat panel built into `index.html` itself,
not Claude Desktop / claude.ai conversation mode. The reason to build it this way:
conversation mode narrates every tool call in the transcript, and that's a UI choice
of that surface, not something the API forces. Owning the chat UI means only the
final reply is ever rendered — no tool-call play-by-play.

## How it works

Webhook `assistant-chat` (POST, synchronous response) → **Build Claude request**
(system prompt + the app's message history + Anthropic's native **MCP connector**:
`mcp_servers` pointed at the do-or-wait Cloud Run remote MCP server, `tools:
[{type:'mcp_toolset', mcp_server_name:'do-or-wait'}]` with no allow/deny list, so
every tool the connector exposes is available — Tasks, Leads, Notes, Outreach,
Property Outreach, Availability, Pricing, Rate Bands, Renewals, Roster) → **Call
Claude (MCP connector)** (`POST https://api.anthropic.com/v1/messages`, beta header
`anthropic-beta: mcp-client-2025-11-20` — Claude calls the MCP tools **server-side**,
inside this one API call, no manual tool loop needed here) → **Build response**
(keeps ONLY the `type:'text'` content blocks as `reply`; separately collects any
`mcp_tool_use` block names into `toolsUsed`, an optional signal the app can show as
a small opt-in chip, or ignore entirely — this is the field that lets Justin peek
at what was used without it being forced into the transcript) → **Respond**.

## Setup (not yet imported)

1. Import `24_assistant_chat.json` as a **new** workflow (brand-new webhook path,
   no conflict risk).
2. Pick the **Anthropic API** credential on "Call Claude (MCP connector)" — same
   credential already used by workflows 13/17/22, just a dropdown pick.
3. **Set the MCP URL — hardcode it in the node, don't use an n8n env var
   (2026-07-10 correction, see below).** Open the **"Build Claude request"** Code
   node and replace the line
   `const mcpUrl = ($env.DOW_MCP_URL || '').trim();`
   with a literal string:
   `const mcpUrl = 'https://<your-service>.run.app/mcp/<your MCP_ACCESS_TOKEN>';`
   — the same full URL already used as the custom-connector Server URL in claude.ai
   (see `Sales/DoOrWait_MCP/DEPLOY.md` §3). This lives ONLY inside your private n8n
   instance (the node's saved parameter, not the exported/committed JSON), so it
   never ends up in the public GitHub repo. **Why not an env var:** `$env.DOW_MCP_URL`
   still works fine in the Code node itself, but this n8n instance doesn't have
   real host-level env var access wired up, and n8n's own in-app "Environment
   variables" panel (Settings → Variables) turns out to be a paid/licensed
   feature this instance doesn't have — hitting an upgrade wall there is expected,
   not a misconfiguration. Hardcoding in the node sidesteps it entirely and is
   actually the safer choice for a secret anyway. If host-level env vars are ever
   wired up later (see `Sales/DoOrWait_MCP/CLOUD_RUN_CONTINUOUS_DEPLOY.md`-style
   host access), the `$env.DOW_MCP_URL` line can be restored instead.
4. Activate.
5. Test: POST `{"messages":[{"role":"user","text":"list my open leads"}]}` to
   `https://plain-credit-5962.jchoustin91.workers.dev/webhook/assistant-chat` and
   confirm you get back `{"ok":true,"reply":"...","toolsUsed":[...]}` with no
   tool-call detail baked into `reply` itself.

## Design notes / tradeoffs

- **No per-request auth beyond the webhook's own URL**, matching every other
  webhook in this project (resolve-thread, research-prospect, generate-followup,
  property-outreach-draft, etc.) — none of them check a caller token either. This
  endpoint is a bit different in kind because every call spends real Anthropic API
  money, so the practical safety net is a **spend cap in the Anthropic Console**
  (Settings → Limits), not endpoint auth. Worth reconsidering if this URL ever
  needs to be shared more widely than it is today.
- **History is sent as plain text only**, not full content blocks. The app sends
  `{role, text}` for every turn, including past assistant turns — so a previous
  turn's `mcp_tool_use`/`mcp_tool_result` blocks are never replayed back to Claude.
  This keeps the request small and the transcript clean, at the cost of Claude
  needing to re-call a tool if a later turn needs data it already fetched earlier
  in the conversation. Acceptable simplification for v1; revisit if that
  re-fetching shows up as a noticeable cost or latency problem.
- **Tool scope is "everything the connector exposes"** (Justin's call) — no
  allowlist/denylist via `configs`. If a future version wants a narrower or
  read-only assistant, the MCP connector's `default_config`/`configs` pattern
  (see the Claude Platform Docs "MCP connector" page) is the natural way to do it
  without touching `tools.js` itself.
- **Model:** `claude-sonnet-4-6`, same default already established for wf13/17/22
  in this project.
- **`continueOnFail: true`** on the Claude HTTP node so a Claude API error (bad
  key, no credit, rate limit) surfaces as `{ok:false, error:"..."}` through
  **Build response** and **Respond**, instead of n8n's generic error page — same
  `res.ok`-checked pattern the app already uses for `researchProspect` /
  `generateFollowup` / `generatePODraft`.
- **Prompt caching (added 2026-07-10).** Justin noticed every message resends the
  full system prompt, which is real waste since it's identical every turn. Fixed
  with a single top-level `cache_control: { type: 'ephemeral' }` field on the
  request body — this turns on Anthropic's "automatic caching," which caches the
  repeated prefix (tool definitions from the MCP connector, then the system
  prompt, then earlier messages, in that order) and moves the cache breakpoint
  forward itself as the conversation grows, no manual bookkeeping needed. Cache
  reads are billed at ~10% of normal input price and process faster than a full
  re-read, so this cuts both cost and latency on every turn after the first
  within a session (default 5-minute cache lifetime, refreshed at no extra cost
  on each hit). It does NOT reduce what the browser sends over the wire each
  time — that's unavoidable with a stateless request/response API — it just
  stops Anthropic from fully reprocessing and rebilling the repeated portion.
  **Build response** now also returns `cacheRead`/`cacheWrite` (from
  `usage.cache_read_input_tokens`/`cache_creation_input_tokens`) so cache
  effectiveness can be checked directly in a test response — `cacheRead` should
  be non-zero on the 2nd+ message of a session that's within the 5-minute
  window. Since Justin's usage is occasional rather than back-to-back, this
  mostly pays off within an active back-and-forth, not across separate visits
  hours apart — the 1-hour cache (`cache_control:{type:'ephemeral',ttl:'1h'}`,
  ~2x write cost instead of 1.25x, same ~10% read cost) is the option to reach
  for if longer-gap reuse ever matters more than it does today.
