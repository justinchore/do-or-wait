# Do or Wait — Firestore MCP connector

A small [MCP](https://modelcontextprotocol.io) server that lets Claude read and write
the **do-or-wait** Firestore database directly. Because the app listens with
`onSnapshot`, anything Claude writes here appears in the app **live** — no refresh.

It runs as a local process on **your** machine (so it can reach Firestore; sandboxes
can't), and needs no credentials beyond the app's public web API key, since this
project's Firestore rules are open.

## What Claude can do once it's connected

| Area | Tools |
|------|-------|
| **Tasks** (Tasks tab) | `list_tasks`, `get_task`, `create_task`, `add_task_update`, `update_task` (rename / archive) |
| **Leads** (Leads pipeline) | `list_leads`, `get_lead`, `create_lead`, `update_lead`, `add_lead_update` |
| **Notes** (Notes tab) | `list_notes`, `create_note`, `update_note` |
| **Read-only context** | `get_availability`, `get_pricing`, `get_renewals`, `list_locations` |
| **Run the sync** | `trigger_availability_sync` (one location, waits for fresh data), `sync_all_locations` (every site) |
| **Escape hatches** | `get_document`, `query_collection` |

`trigger_availability_sync` POSTs `{propId}` to your Cloudflare Worker webhook (the
same call the app's ⟳ refresh makes), then polls Firestore until the new `synced_at`
lands — so Claude can refresh a location and answer an availability/occupancy question
in one turn. Pricing and renewals run on n8n cron schedules (no webhook), so those
can't be triggered on demand. Override the webhook with the `SYNC_WEBHOOK` env var.

`add_task_update` / `add_lead_update` append entries with the same shape the app
writes, so DO/WAIT columns and the 3-day follow-up clock behave correctly.

For leads, **`kind` is required** — Claude infers the category from how you phrase the
log and never defaults, so things land in the right bucket:

| You say… | kind | direction | counts as contact? |
|----------|------|-----------|--------------------|
| "called / phoned / left a voicemail for them" | `call` | outbound → Wait | yes |
| "texted them" | `text` | outbound → Wait | yes |
| "emailed / sent the proposal / replied to them" | `email` | outbound → Wait | yes |
| "met them / did a tour" | `met` | outbound → Wait | yes |
| "they replied / heard back / they reached out" | `inbound` | inbound → **Do** | yes |
| "talked to Kevin / looked into locations" | `note` | internal | **no** |

If the category is ambiguous the server rejects the write rather than guessing, so a
log never gets silently mis-filed as an internal note.

## Install (one time)

Requires **Node 18+** (uses built-in `fetch`).

```bash
cd firestore-mcp
npm install
npm test        # offline checks — codec round-trips + tool registry
```

Then register it with Claude. On **Windows**, edit:

```
%APPDATA%\Claude\claude_desktop_config.json
```

Add (create the file / the `mcpServers` key if absent):

```json
{
  "mcpServers": {
    "do-or-wait": {
      "command": "node",
      "args": ["C:\\Users\\jcho\\Documents\\Claude\\Projects\\do_or_wait\\firestore-mcp\\server.js"]
    }
  }
}
```

Restart the Claude desktop app. The `do-or-wait` tools then appear in any
conversation, and you can just say things like *"mark the Walnut Robotics task as
waiting on insurance"* or *"log that Veho emailed back about Fontana."*

## Config overrides (optional)

Set in the `env` block of the config entry if you ever need to point elsewhere:

- `FIRESTORE_PROJECT` — default `do-or-wait`
- `FIRESTORE_API_KEY` — default = the app's web key

```json
"do-or-wait": {
  "command": "node",
  "args": ["...\\server.js"],
  "env": { "FIRESTORE_PROJECT": "do-or-wait" }
}
```

## How writes work (so they always match the app)

The app saves each document whole (`setDoc`). This server mirrors that: for an
update it reads the current doc, modifies the decoded object in memory, and
`PATCH`es back the affected top-level fields (the entire `entries` array, `archived`,
etc.). New docs are created with the app's id conventions (`t…` topics, `l…` leads,
`e…` entries). JS values are converted to/from Firestore's typed `Value` format,
preserving integers vs. doubles.

## Files

```
firestore-mcp/
  server.js       ← the MCP server (all tools)
  selftest.js     ← offline codec + registry tests (npm test)
  package.json
  README.md
```
