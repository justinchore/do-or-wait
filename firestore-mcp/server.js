#!/usr/bin/env node
/**
 * Do or Wait — Firestore MCP connector
 * ------------------------------------------------------------------
 * A local Model Context Protocol server that lets Claude read and write
 * the "do-or-wait" Firestore database directly. Because the app listens
 * with onSnapshot, any write here shows up in the app immediately.
 *
 * Runs on YOUR machine (Node 18+), not in any sandbox, so it can reach
 * firestore.googleapis.com. Firestore rules for this project are open
 * (no auth), so the public web API key is all that's needed.
 *
 * Config can be overridden with env vars:
 *   FIRESTORE_PROJECT   (default: do-or-wait)
 *   FIRESTORE_API_KEY   (default: the app's web key)
 *
 * Exposed as tools (see TOOLS below):
 *   Tasks:  list_tasks, get_task, create_task, add_task_update, update_task
 *   Leads:  list_leads, get_lead, create_lead, update_lead, add_lead_update
 *   Notes:  list_notes, create_note, update_note
 *   Read:   get_availability, get_pricing, get_renewals, list_locations
 *   Raw:    get_document, query_collection
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { pathToFileURL } from "node:url";

// ───────────────────────────── config ─────────────────────────────
const PROJECT = process.env.FIRESTORE_PROJECT || "do-or-wait";
const API_KEY =
  process.env.FIRESTORE_API_KEY || "AIzaSyBQ-1dSWkXnh5Ju2lVKsUieCx3r-lZc08U";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
// n8n availability sync is triggered via the Cloudflare Worker webhook
// (same call the app's ⟳ refresh makes). Override with SYNC_WEBHOOK if it moves.
const SYNC_WEBHOOK =
  process.env.SYNC_WEBHOOK ||
  "https://plain-credit-5962.jchoustin91.workers.dev/webhook/availability-sync";

// ─────────────────── Firestore <-> JS value codec ───────────────────
function encodeValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number")
    return Number.isInteger(v)
      ? { integerValue: String(v) }
      : { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v))
    return { arrayValue: { values: v.map(encodeValue) } };
  if (typeof v === "object")
    return { mapValue: { fields: encodeFields(v) } };
  return { stringValue: String(v) };
}

function encodeFields(obj) {
  const fields = {};
  for (const k of Object.keys(obj)) {
    if (k === "_id") continue; // _id is the doc name, never a field
    if (obj[k] === undefined) continue;
    fields[k] = encodeValue(obj[k]);
  }
  return fields;
}

function decodeValue(val) {
  if (!val || typeof val !== "object") return null;
  if ("nullValue" in val) return null;
  if ("booleanValue" in val) return val.booleanValue;
  if ("integerValue" in val) return parseInt(val.integerValue, 10);
  if ("doubleValue" in val) return val.doubleValue;
  if ("stringValue" in val) return val.stringValue;
  if ("timestampValue" in val) return val.timestampValue;
  if ("referenceValue" in val) return val.referenceValue;
  if ("geoPointValue" in val) return val.geoPointValue;
  if ("bytesValue" in val) return val.bytesValue;
  if ("arrayValue" in val)
    return (val.arrayValue.values || []).map(decodeValue);
  if ("mapValue" in val) return decodeFields(val.mapValue.fields || {});
  return null;
}

function decodeFields(fields) {
  const o = {};
  for (const k of Object.keys(fields)) o[k] = decodeValue(fields[k]);
  return o;
}

function decodeDoc(doc) {
  const o = decodeFields(doc.fields || {});
  o._id = doc.name.split("/").pop();
  return o;
}

// ───────────────────────── HTTP helpers ─────────────────────────
async function fsList(coll) {
  const docs = [];
  let pageToken = "";
  do {
    const url = `${BASE}/${coll}?key=${API_KEY}&pageSize=300${
      pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""
    }`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`list ${coll}: ${r.status} ${await r.text()}`);
    const j = await r.json();
    (j.documents || []).forEach((d) => docs.push(decodeDoc(d)));
    pageToken = j.nextPageToken || "";
  } while (pageToken);
  return docs;
}

async function fsGet(coll, id) {
  const r = await fetch(`${BASE}/${coll}/${encodeURIComponent(id)}?key=${API_KEY}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`get ${coll}/${id}: ${r.status} ${await r.text()}`);
  return decodeDoc(await r.json());
}

/**
 * Merge-patch the given top-level fields. Each listed field is fully
 * replaced (so passing the whole `entries` array replaces it), and any
 * server field not listed is left untouched. Creates the doc if missing.
 */
async function fsPatch(coll, id, fields) {
  const mask = Object.keys(fields)
    .filter((k) => k !== "_id")
    .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
    .join("&");
  const url = `${BASE}/${coll}/${encodeURIComponent(id)}?key=${API_KEY}&${mask}`;
  const r = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: encodeFields(fields) }),
  });
  if (!r.ok) throw new Error(`patch ${coll}/${id}: ${r.status} ${await r.text()}`);
  return decodeDoc(await r.json());
}

async function appendEntry(coll, id, entry) {
  const doc = await fsGet(coll, id);
  if (!doc) throw new Error(`${coll}/${id} not found`);
  const entries = Array.isArray(doc.entries) ? doc.entries : [];
  entries.push(entry);
  await fsPatch(coll, id, { entries });
  return { _id: id, entry, totalEntries: entries.length };
}

// Trigger the n8n availability sync for one location and (optionally) wait for
// the Firestore write-back, mirroring the app's Avail-export approach: capture a
// baseline synced_at, POST the webhook, then poll until synced_at advances.
async function syncLocation(propId, { wait = true, timeoutSec = 90 } = {}) {
  const before = await fsGet("availability", propId);
  const baseline = before?.synced_at || null;
  const res = await fetch(SYNC_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ propId }),
  });
  if (!res.ok)
    throw new Error(`sync webhook for ${propId}: ${res.status} ${await res.text()}`);
  if (!wait) return { propId, triggered: true, waited: false, synced_at: baseline };
  const deadline = Date.now() + timeoutSec * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    const now = await fsGet("availability", propId);
    if (now?.synced_at && now.synced_at !== baseline)
      return { propId, triggered: true, synced: true, synced_at: now.synced_at };
  }
  return {
    propId,
    triggered: true,
    synced: false,
    note: `No write-back within ${timeoutSec}s; data may still be last-known.`,
    synced_at: baseline,
  };
}

// ───────────────────────── small utils ─────────────────────────
const nowIso = () => new Date().toISOString();
let _seq = 0;
const genId = (p) => `${p}${Date.now()}${(_seq++).toString(36)}`;

// status of a task/lead thread, mirroring the app's currentStatus()
function currentStatus(item) {
  const entries = item.entries || [];
  if (!entries.length) return "new";
  const lastOpen = [...entries].reverse().find((e) => !e.done);
  return lastOpen?.type || entries[entries.length - 1]?.type || "do";
}

function taskSummary(t) {
  const entries = t.entries || [];
  const last = entries[entries.length - 1];
  return {
    id: t._id,
    title: t.title,
    archived: !!t.archived,
    status: currentStatus(t),
    updates: entries.length,
    lastText: last?.text?.slice(0, 140) || null,
    lastAt: last?.createdAt || t.createdAt || null,
  };
}

function leadSummary(l) {
  return {
    id: l._id,
    company: l.company || null,
    first_name: l.first_name || null,
    stage: l.stage || null,
    segment: l.segment || null,
    status: currentStatus(l),
    location: l.location || null,
    sqft: l.sqft || null,
    followup_due: !!l.followup_due,
    days_since_contact: l.days_since_contact ?? null,
    next_due_date: l.next_due_date || null,
    updates: (l.entries || []).length,
  };
}

const LEAD_KINDS = ["note", "email", "call", "text", "met", "inbound"];

// ───────────────────────── tool registry ─────────────────────────
const TOOLS = [
  // ---- TASKS (topics/{id}) ----
  {
    name: "list_tasks",
    description:
      "List task threads (the Tasks tab — topics/{id}, DO/WAIT sticky-note threads). Returns id, title, status, update count, and last update. Use the returned id with get_task / add_task_update / update_task.",
    inputSchema: {
      type: "object",
      properties: {
        include_archived: {
          type: "boolean",
          description: "Include archived task threads. Default false.",
        },
      },
    },
    handler: async (a) => {
      let tasks = await fsList("topics");
      if (!a.include_archived) tasks = tasks.filter((t) => !t.archived);
      tasks.sort(
        (x, y) =>
          Date.parse(y.createdAt || 0) - Date.parse(x.createdAt || 0)
      );
      return tasks.map(taskSummary);
    },
  },
  {
    name: "get_task",
    description: "Get one task thread (topics/{id}) in full, including every entry.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Topic doc id." } },
      required: ["id"],
    },
    handler: async (a) => {
      const t = await fsGet("topics", a.id);
      if (!t) throw new Error(`Task ${a.id} not found`);
      return t;
    },
  },
  {
    name: "create_task",
    description:
      "Create a new task thread (topics/{id}) on the Tasks tab. Optionally seed it with a first update.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Thread title." },
        first_update: {
          type: "string",
          description: "Optional text for an initial entry.",
        },
        type: {
          type: "string",
          enum: ["do", "wait"],
          description:
            "Column for the first update (do = action needed, wait = waiting on someone). Default 'do'.",
        },
      },
      required: ["title"],
    },
    handler: async (a) => {
      const id = genId("t");
      const entries = [];
      if (a.first_update) {
        entries.push({
          id: genId("e"),
          type: a.type === "wait" ? "wait" : "do",
          text: a.first_update,
          done: false,
          notes: [],
          createdAt: nowIso(),
        });
      }
      const topic = {
        id,
        title: a.title,
        archived: false,
        createdAt: nowIso(),
        entries,
      };
      await fsPatch("topics", id, topic);
      return { created: id, topic: taskSummary({ ...topic, _id: id }) };
    },
  },
  {
    name: "add_task_update",
    description:
      "Append an update (entry) to an existing task thread. The newest non-done entry's type drives whether the card sits in the Do or Wait column.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Topic doc id." },
        text: { type: "string", description: "Update text." },
        type: {
          type: "string",
          enum: ["do", "wait"],
          description:
            "do = action needed, wait = waiting on someone else. Default 'do'.",
        },
      },
      required: ["id", "text"],
    },
    handler: async (a) =>
      appendEntry("topics", a.id, {
        id: genId("e"),
        type: a.type === "wait" ? "wait" : "do",
        text: a.text,
        done: false,
        notes: [],
        createdAt: nowIso(),
      }),
  },
  {
    name: "update_task",
    description:
      "Update a task thread's top-level fields — rename (title) and/or archive/unarchive (archived).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Topic doc id." },
        title: { type: "string" },
        archived: { type: "boolean" },
      },
      required: ["id"],
    },
    handler: async (a) => {
      const patch = {};
      if (a.title !== undefined) patch.title = a.title;
      if (a.archived !== undefined) patch.archived = a.archived;
      if (!Object.keys(patch).length)
        throw new Error("Nothing to update (pass title and/or archived).");
      await fsPatch("topics", a.id, patch);
      return { updated: a.id, ...patch };
    },
  },

  // ---- LEADS (leads/{id}) ----
  {
    name: "list_leads",
    description:
      "List sales-pipeline leads (leads/{id}). Optional filters by stage, segment, or follow-up-due. Returns compact summaries; use get_lead for full detail.",
    inputSchema: {
      type: "object",
      properties: {
        stage: { type: "string", description: "Filter by exact stage value." },
        segment: {
          type: "string",
          description: "Filter by segment (e.g. importer, ecommerce, 3pl, tenant).",
        },
        followup_due: {
          type: "boolean",
          description: "If true, only leads currently flagged followup_due.",
        },
        include_archived: { type: "boolean", description: "Default false." },
      },
    },
    handler: async (a) => {
      let leads = await fsList("leads");
      leads = leads.filter((l) => !l._deleted);
      if (!a.include_archived) leads = leads.filter((l) => !l.archived);
      if (a.stage) leads = leads.filter((l) => l.stage === a.stage);
      if (a.segment) leads = leads.filter((l) => l.segment === a.segment);
      if (a.followup_due) leads = leads.filter((l) => l.followup_due);
      return leads.map(leadSummary);
    },
  },
  {
    name: "get_lead",
    description: "Get one lead (leads/{id}) in full, including thread entries.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
    handler: async (a) => {
      const l = await fsGet("leads", a.id);
      if (!l) throw new Error(`Lead ${a.id} not found`);
      return l;
    },
  },
  {
    name: "create_lead",
    description:
      "Create a new lead (leads/{id}). Pass any known fields. A lead with no entries shows in the 'New' column until you add an update. seq_status defaults to 'active'.",
    inputSchema: {
      type: "object",
      properties: {
        company: { type: "string" },
        first_name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        contact: { type: "string" },
        segment: {
          type: "string",
          description: "e.g. importer, ecommerce, 3pl, tenant, lastmile",
        },
        stage: { type: "string", description: "e.g. cold, contacted, toured, proposal" },
        location: { type: "string" },
        sqft: { type: "number" },
        leaseLength: { type: "string" },
        moveIn: { type: "string" },
        rate: { type: "string" },
        fields: {
          type: "object",
          description:
            "Any additional lead fields to set verbatim (merged last). Use for less common fields.",
        },
      },
      required: ["company"],
    },
    handler: async (a) => {
      const id = genId("l");
      const { fields, ...rest } = a;
      const lead = {
        id,
        archived: false,
        createdAt: nowIso(),
        seq_status: "active",
        entries: [],
        ...rest,
        ...(fields || {}),
      };
      await fsPatch("leads", id, lead);
      return { created: id, lead: leadSummary({ ...lead, _id: id }) };
    },
  },
  {
    name: "update_lead",
    description:
      "Update top-level fields on a lead (stage, rate, next_due_date, sqft, etc.). Only the fields you pass are changed; everything else is left intact. Always sets updatedAt.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        fields: {
          type: "object",
          description:
            "Object of lead fields to set, e.g. {\"stage\":\"toured\",\"rate\":\"$0.95\"}.",
        },
      },
      required: ["id", "fields"],
    },
    handler: async (a) => {
      if (!a.fields || !Object.keys(a.fields).length)
        throw new Error("Pass a non-empty `fields` object.");
      const patch = { ...a.fields, updatedAt: nowIso() };
      await fsPatch("leads", a.id, patch);
      return { updated: a.id, fields: patch };
    },
  },
  {
    name: "add_lead_update",
    description:
      "Append a thread update to a lead. You MUST classify it with `kind` — always infer the category from how the user describes it; never default. The category sets direction (in/out) and whether it counts as contact for the 3-day follow-up clock.\n\nClassify by phrasing:\n- 'call' (OUTBOUND, counts) — you called/phoned/dialed/rang/left a voicemail for them, 'spoke with them on the phone', 'gave them a call'.\n- 'text' (OUTBOUND, counts) — you texted/SMS'd/messaged them.\n- 'email' (OUTBOUND, counts) — you emailed/sent/replied/wrote to them, 'sent the proposal/quote/agreement'.\n- 'met' (OUTBOUND, counts) — you met in person, did a tour/site visit, met at an event.\n- 'inbound' (INBOUND, counts, logs to the DO column) — THEY reached out to you: 'they called/emailed/texted me', 'they replied', 'they got back to me', 'heard back from them', 'they reached out'.\n- 'note' (INTERNAL, does NOT count as contact) — no contact with the lead happened: internal thoughts, research, or talking to teammates, e.g. 'talked to Kevin about this', 'looked into locations', 'need to check pricing', 'reminder to…'.\n\nIf direction is genuinely unclear but contact clearly happened, ask the user or pick the closest outbound kind; only use 'note' when no lead contact occurred.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Lead doc id." },
        text: { type: "string", description: "What happened." },
        kind: {
          type: "string",
          enum: LEAD_KINDS,
          description:
            "REQUIRED. one of: call | text | email | met | inbound | note. Pick per the classification guide in the tool description — infer from the user's wording, do not default.",
        },
        type: {
          type: "string",
          enum: ["do", "wait"],
          description:
            "Optional column override. Defaults: inbound -> do (ball's in your court), every other kind -> wait.",
        },
      },
      required: ["id", "text", "kind"],
    },
    handler: async (a) => {
      if (!a.kind) {
        throw new Error(
          "`kind` is required — classify the update as one of: call, text, email, met, inbound, note. " +
            "Outbound (you contacted them): call/text/email/met. Inbound (they contacted you): inbound. " +
            "Internal only (no lead contact): note."
        );
      }
      if (!LEAD_KINDS.includes(a.kind)) {
        throw new Error(
          `Invalid kind '${a.kind}'. Must be one of: ${LEAD_KINDS.join(", ")}.`
        );
      }
      const kind = a.kind;
      const type = a.type || (kind === "inbound" ? "do" : "wait");
      return appendEntry("leads", a.id, {
        id: genId("e"),
        type,
        text: a.text,
        done: false,
        notes: [],
        createdAt: nowIso(),
        kind,
        dir: kind === "inbound" ? "in" : "out",
      });
    },
  },

  // ---- NOTES (notes/{id}) ----
  {
    name: "list_notes",
    description:
      "List ideas/issues notes (the Notes tab — notes/{id}). Each note has `why` and `fix`.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const notes = (await fsList("notes")).filter((n) => !n._deleted);
      notes.sort(
        (x, y) =>
          Date.parse(y.createdAt || 0) - Date.parse(x.createdAt || 0)
      );
      return notes;
    },
  },
  {
    name: "create_note",
    description: "Create a note on the Notes tab. `why` = why it matters, `fix` = the fix.",
    inputSchema: {
      type: "object",
      properties: {
        why: { type: "string" },
        fix: { type: "string" },
      },
    },
    handler: async (a) => {
      const id = genId("note");
      const note = {
        why: a.why || "",
        fix: a.fix || "",
        createdAt: nowIso(),
        updatedAt: nowIso(),
        _deleted: false,
      };
      await fsPatch("notes", id, note);
      return { created: id, note };
    },
  },
  {
    name: "update_note",
    description: "Update a note's `why` and/or `fix`. Sets updatedAt.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        why: { type: "string" },
        fix: { type: "string" },
      },
      required: ["id"],
    },
    handler: async (a) => {
      const patch = { updatedAt: nowIso() };
      if (a.why !== undefined) patch.why = a.why;
      if (a.fix !== undefined) patch.fix = a.fix;
      await fsPatch("notes", a.id, patch);
      return { updated: a.id, ...patch };
    },
  },

  // ---- READ-ONLY CONTEXT ----
  {
    name: "get_availability",
    description:
      "Read warehouse availability (availability/{propId}). With no propId, returns a per-location summary (counts). With propId, returns the full doc including units[].",
    inputSchema: {
      type: "object",
      properties: {
        propId: {
          type: "string",
          description: "A specific location id; omit for all-locations summary.",
        },
      },
    },
    handler: async (a) => {
      if (a.propId) {
        const d = await fsGet("availability", a.propId);
        if (!d) throw new Error(`No availability doc for ${a.propId}`);
        return d;
      }
      const docs = await fsList("availability");
      return docs.map((d) => ({
        propId: d._id,
        property: d.property || null,
        address: d.address || null,
        wh_avail_sf: d.wh?.avail_sf ?? null,
        office_avail_sf: d.office?.avail_sf ?? null,
        units: Array.isArray(d.units) ? d.units.length : null,
        synced_at: d.synced_at || null,
      }));
    },
  },
  {
    name: "get_pricing",
    description: "Read the national rate card (pricing/current).",
    inputSchema: { type: "object", properties: {} },
    handler: async () => (await fsGet("pricing", "current")) || { rows: [] },
  },
  {
    name: "get_renewals",
    description: "Read the lease-renewal tracker (renewals/current).",
    inputSchema: { type: "object", properties: {} },
    handler: async () => (await fsGet("renewals", "current")) || { rows: [] },
  },
  {
    name: "list_locations",
    description: "Read the configured properties (config/properties).",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const d = await fsGet("config", "properties");
      return d?.properties || [];
    },
  },

  // ---- ACTIONS (run the n8n availability sync) ----
  {
    name: "trigger_availability_sync",
    description:
      "Run the n8n availability sync for ONE location — re-reads its SharePoint sheet into Firestore so unit availability is current. By default waits for the fresh data to land, so a follow-up get_availability reflects it. Use before answering occupancy/availability questions when freshness matters.",
    inputSchema: {
      type: "object",
      properties: {
        propId: { type: "string", description: "Location id to sync." },
        wait: {
          type: "boolean",
          description:
            "Wait for the Firestore write-back before returning. Default true.",
        },
        timeout_sec: {
          type: "number",
          description: "Max seconds to wait for the write-back. Default 90.",
        },
      },
      required: ["propId"],
    },
    handler: async (a) =>
      syncLocation(a.propId, {
        wait: a.wait !== false,
        timeoutSec: a.timeout_sec || 90,
      }),
  },
  {
    name: "sync_all_locations",
    description:
      "Run the n8n availability sync for EVERY configured location (from config/properties). Triggers them all; by default returns immediately (fire-and-forget) since a full sync can take minutes. Set wait=true to poll each for fresh data (slower). After a fire-and-forget run, give the syncs a moment, then read with get_availability.",
    inputSchema: {
      type: "object",
      properties: {
        wait: {
          type: "boolean",
          description:
            "Wait for each location's write-back. Default false (just trigger all).",
        },
        timeout_sec: {
          type: "number",
          description: "Per-location wait timeout when wait=true. Default 120.",
        },
      },
    },
    handler: async (a) => {
      const cfg = await fsGet("config", "properties");
      const propIds = (cfg?.properties || []).map((p) => p.id).filter(Boolean);
      if (!propIds.length) return { triggered: 0, note: "No configured locations." };
      const wait = a.wait === true;
      const results = [];
      for (const propId of propIds) {
        try {
          if (wait) {
            results.push(
              await syncLocation(propId, { wait: true, timeoutSec: a.timeout_sec || 120 })
            );
          } else {
            await fetch(SYNC_WEBHOOK, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ propId }),
            });
            results.push({ propId, triggered: true, waited: false });
          }
        } catch (err) {
          results.push({ propId, triggered: false, error: err.message });
        }
      }
      return {
        triggered: results.filter((r) => r.triggered).length,
        total: propIds.length,
        waited: wait,
        results,
      };
    },
  },

  // ---- RAW ESCAPE HATCHES ----
  {
    name: "get_document",
    description:
      "Read any single Firestore document by collection + id. Escape hatch for collections without a dedicated tool.",
    inputSchema: {
      type: "object",
      properties: {
        collection: { type: "string" },
        id: { type: "string" },
      },
      required: ["collection", "id"],
    },
    handler: async (a) => {
      const d = await fsGet(a.collection, a.id);
      if (!d) throw new Error(`${a.collection}/${a.id} not found`);
      return d;
    },
  },
  {
    name: "query_collection",
    description:
      "List documents in any collection (decoded). Optional limit (default 50, max 300). Escape hatch — prefer the dedicated list_* tools.",
    inputSchema: {
      type: "object",
      properties: {
        collection: { type: "string" },
        limit: { type: "number" },
      },
      required: ["collection"],
    },
    handler: async (a) => {
      const docs = await fsList(a.collection);
      const lim = Math.min(Math.max(1, a.limit || 50), 300);
      return docs.slice(0, lim);
    },
  },
];

// ───────────────────────── MCP wiring ─────────────────────────
const TOOL_MAP = Object.fromEntries(TOOLS.map((t) => [t.name, t]));

const server = new Server(
  { name: "do-or-wait-firestore", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const tool = TOOL_MAP[req.params.name];
  if (!tool)
    return {
      isError: true,
      content: [{ type: "text", text: `Unknown tool: ${req.params.name}` }],
    };
  try {
    const result = await tool.handler(req.params.arguments || {});
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    return {
      isError: true,
      content: [{ type: "text", text: `Error in ${tool.name}: ${err.message}` }],
    };
  }
});

// Export internals for the self-test harness (no effect under MCP runtime).
export const __test = {
  encodeValue,
  decodeValue,
  encodeFields,
  decodeFields,
  currentStatus,
  TOOLS,
};

// Only start the stdio server when run directly (not when imported by tests).
// pathToFileURL handles Windows backslash paths correctly.
const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain || process.env.MCP_FORCE_START === "1") {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `do-or-wait Firestore MCP running (project=${PROJECT}, ${TOOLS.length} tools)`
  );
}
