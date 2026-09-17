// Offline self-test: validates the Firestore value codec and tool wiring.
// Does NOT hit the network (Firestore writes are exercised live from your machine).
import assert from "node:assert";
import { __test } from "./server.js";

const {
  encodeValue, decodeValue, encodeFields, decodeFields, currentStatus,
  leadMatches, leadScore, leadSummary, TOOLS,
} = __test;

let pass = 0;
const ok = (name) => {
  pass++;
  console.log(`  ok  ${name}`);
};

// 1. Round-trip a realistic topic (task) document.
const topic = {
  id: "t123",
  title: "Walnut Robotics",
  archived: false,
  createdAt: "2026-06-22T17:00:00.000Z",
  entries: [
    {
      id: "e1",
      type: "wait",
      text: "Waiting on mentor to sign the license agreement",
      done: false,
      notes: [],
      createdAt: "2026-06-22T17:00:00.000Z",
    },
  ],
};
assert.deepStrictEqual(decodeFields(encodeFields(topic)), topic);
ok("topic round-trips through encode/decode");

// 2. Round-trip a lead with mixed number types + nested map.
const lead = {
  id: "l456",
  company: "Veho",
  sqft: 12000, // integer
  rate: 0.95, // double
  followup_due: true,
  pa: { name: "Jane", phone: "555-1212" },
  entries: [
    {
      id: "e2",
      type: "do",
      text: "They emailed asking about Fontana",
      done: false,
      notes: [],
      createdAt: "2026-06-22T18:00:00.000Z",
      kind: "inbound",
      dir: "in",
    },
  ],
};
const leadRT = decodeFields(encodeFields(lead));
assert.deepStrictEqual(leadRT, lead);
assert.strictEqual(Number.isInteger(leadRT.sqft), true);
assert.strictEqual(leadRT.rate, 0.95);
ok("lead round-trips; integer vs double preserved");

// 3. Value-level encodings are the correct Firestore shapes.
assert.deepStrictEqual(encodeValue(5), { integerValue: "5" });
assert.deepStrictEqual(encodeValue(5.5), { doubleValue: 5.5 });
assert.deepStrictEqual(encodeValue(true), { booleanValue: true });
assert.deepStrictEqual(encodeValue(null), { nullValue: null });
assert.deepStrictEqual(encodeValue("hi"), { stringValue: "hi" });
assert.deepStrictEqual(encodeValue([1, "a"]), {
  arrayValue: { values: [{ integerValue: "1" }, { stringValue: "a" }] },
});
ok("scalar/array encodings match Firestore Value spec");

// 4. _id is never written as a field.
assert.ok(!("_id" in encodeFields({ _id: "x", title: "y" })));
ok("_id excluded from encoded fields");

// 5. currentStatus mirrors the app logic.
assert.strictEqual(currentStatus({ entries: [] }), "new");
assert.strictEqual(
  currentStatus({ entries: [{ type: "do", done: true }, { type: "wait", done: false }] }),
  "wait"
);
assert.strictEqual(
  currentStatus({ entries: [{ type: "wait", done: true }] }),
  "wait"
);
ok("currentStatus matches app (new / last-open / last)");

// 6. Tool registry sanity: unique names, every tool has a handler + schema.
const names = TOOLS.map((t) => t.name);
assert.strictEqual(new Set(names).size, names.length, "tool names unique");
for (const t of TOOLS) {
  assert.strictEqual(typeof t.handler, "function", `${t.name} has handler`);
  assert.strictEqual(t.inputSchema?.type, "object", `${t.name} has object schema`);
  assert.ok(t.description?.length > 10, `${t.name} has description`);
}
const expected = [
  "list_tasks", "get_task", "create_task", "add_task_update", "update_task",
  "search_leads", "list_leads", "get_lead", "create_lead", "update_lead", "add_lead_update",
  "list_notes", "create_note", "update_note",
  "get_availability", "get_pricing", "get_renewals", "list_locations",
  "trigger_availability_sync", "sync_all_locations",
  "get_document", "query_collection",
];
for (const n of expected) assert.ok(names.includes(n), `missing tool: ${n}`);
ok(`all ${TOOLS.length} tools registered with valid handlers + schemas`);

// 7. add_lead_update requires a kind and validates it (before any network call).
const addLead = TOOLS.find((t) => t.name === "add_lead_update");
assert.ok(
  addLead.inputSchema.required.includes("kind"),
  "kind is a required param"
);
await assert.rejects(
  () => addLead.handler({ id: "l1", text: "x" }),
  /kind` is required/,
  "missing kind throws"
);
await assert.rejects(
  () => addLead.handler({ id: "l1", text: "x", kind: "phonecall" }),
  /Invalid kind/,
  "invalid kind throws"
);
ok("add_lead_update requires + validates kind (no silent 'note' default)");

// 8. All six categories are offered, and the description teaches classification.
for (const k of ["call", "text", "email", "met", "inbound", "note"]) {
  assert.ok(
    addLead.inputSchema.properties.kind.enum.includes(k),
    `kind enum includes ${k}`
  );
  assert.ok(addLead.description.includes(k), `description mentions ${k}`);
}
ok("all 6 categories exposed and documented for classification");

// 9. Text search matches the fields a human would guess, and only those.
const acme = {
  _id: "l1", company: "Acme Logistics", first_name: "Rosa",
  email: "rosa@acmelog.com", phone: "9095551212",
  location: "3950 Airport Ontario (3950 E Airport Dr)", stage: "lead",
};
assert.ok(leadMatches(acme, "acme"), "matches company");
assert.ok(leadMatches(acme, "ACME"), "case-insensitive");
assert.ok(leadMatches(acme, "rosa"), "matches first_name");
assert.ok(leadMatches(acme, "acmelog.com"), "matches email");
assert.ok(leadMatches(acme, "9095551212"), "matches phone");
assert.ok(leadMatches(acme, "ontario"), "matches location");
assert.ok(leadMatches(acme, "acme ontario"), "all terms must match -> both hit");
assert.ok(!leadMatches(acme, "acme fontana"), "all terms must match -> one misses");
assert.ok(!leadMatches(acme, "zzz"), "no false positive");
assert.ok(leadMatches(acme, ""), "empty query matches (caller decides)");
assert.ok(!leadMatches({ _id: "l2" }, "acme"), "lead with no fields does not match");
ok("leadMatches: substring across the right fields, AND across terms");

// 10. Ranking puts the lead you meant first.
const exact = { company: "Veho" };
const prefix = { company: "Veho Logistics" };
const mid = { company: "Global Veho Partners" };
const inc = { company: "Other", location: "veho building" };
const ranked = [inc, mid, prefix, exact]
  .sort((a, b) => leadScore(a, "veho") - leadScore(b, "veho"))
  .map((l) => l.company);
assert.deepStrictEqual(ranked, ["Veho", "Veho Logistics", "Global Veho Partners", "Other"]);
ok("leadScore ranks exact > prefix > substring > incidental");

// 11. search_leads / list_leads declare the params that keep responses small.
const search = TOOLS.find((t) => t.name === "search_leads");
assert.ok(search, "search_leads registered");
assert.deepStrictEqual(search.inputSchema.required, ["q"], "q is required");
assert.ok(search.inputSchema.properties.limit, "search_leads takes a limit");
const listLeads = TOOLS.find((t) => t.name === "list_leads");
assert.ok(listLeads.inputSchema.properties.limit, "list_leads takes a limit");
assert.ok(listLeads.inputSchema.properties.q, "list_leads takes a q");
const getLead = TOOLS.find((t) => t.name === "get_lead");
assert.ok(getLead.inputSchema.properties.entries_limit, "get_lead takes entries_limit");
const listTasks = TOOLS.find((t) => t.name === "list_tasks");
assert.ok(listTasks.inputSchema.properties.limit, "list_tasks takes a limit");
ok("search/list tools expose q + limit so responses stay bounded");

// 12. leadSummary stays compact — it must not leak the whole entries thread.
const summary = leadSummary({
  _id: "l9", company: "Big", entries: new Array(400).fill({ text: "x".repeat(200) }),
});
assert.strictEqual(summary.updates, 400, "summary reports the count");
assert.ok(!("entries" in summary), "summary never carries entries");
assert.ok(JSON.stringify(summary).length < 400, "summary stays small");
ok("leadSummary reports entry count without carrying the thread");


console.log(`\nAll ${pass} checks passed.`);
