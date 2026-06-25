# Workflow 14 — Apollo Org Discovery (LA Fashion District apparel/textile)

**Status:** importable workflow ready — **`14_apollo_org_discovery.json`** (4 nodes, wired to the real `Apollo_Professional` credential, defaults to a 1-page sanity run, `VERTICAL = "lastmile"`). Reusable logic also kept as paste-ready Code nodes in `apollo_org_discovery.reusable.nodes.js`. **Reads orgs from Apollo; writes nothing on its own** — it outputs a paste-ready company array you review and drop into workflow 12, which does the people-search → reveal → score → draft → Firestore.

**Run it:** import the JSON → open the **Apollo Org Search** node and confirm the `Apollo_Professional` credential is attached (re-pick if blank) → Execute. Check **Filter + score** output for the count, and **Build wf12 input** for the paste-ready array. Bump `pages` in the config node up from 1 once the filter looks right. Flip `VERTICAL` to `"fashion_district"` to run that vertical instead.

## Why this exists
The Korean-owned Fashion District niche can't be sourced the way batches 1–2 were (those came from Christine's Panjiva/S&P importer workbook with TEU). These are ~1,000+ small private jobbers in a 100-block district. So instead of a hand-built company list, we **discover** them: Apollo organization search by LA apparel/textile + small headcount, then **post-filter to the Fashion District ZIPs in code**.

This is the Apollo half of the **hybrid** plan. The other halves: a small hand-verified **seed** (`outreach/ca-korean-fashion-district-batch3.csv`) that guarantees known anchors are included, and Justin's **floor visit**, which is the ground-truth ownership filter.

## Key API facts (verified against Apollo docs, June 2026)
- Endpoint: `POST https://api.apollo.io/api/v1/mixed_companies/search`.
- `organization_locations[]` filters **HQ city/state only — there is NO zip/radius filter param.** So we pass `"Los Angeles, California"` and filter by `postal_code` in the next Code node (the org object returns `street_address`, `postal_code`, `city`, `state`).
- Industry via `q_organization_keyword_tags[]` (free-text, OR'd) — easier than numeric industry tag ids.
- `organization_num_employees_ranges[]` as `"min,max"` strings.
- Org search **consumes credits** and is capped at 100/page, 500 pages. We default to 5 pages (≤500 orgs/run).

## Korean-ownership flag — read this
Most Korean jobbers trade under **English brand names** (Sans Souci, Tasha, Davi & Dani), so a name-only filter would drop the majority. The Code node therefore **keeps every in-district apparel org** and only **flags** likely-Korean ones (`korean_likely` / `korean_signal`) via a romanized-surname list + weak name hints, sorting them first. The flag sharpens once wf12 reveals **contact names** (run the same surname check on the contact's last name in wf12's "Pick best contacts"). True confirmation = the floor visit.

## How to run
1. In n8n: Manual Trigger → **Code "Org-search config"** → **HTTP "Apollo Org Search"** (pick the existing Apollo `X-Api-Key` credential; body `={{ $json.body }}`) → **Code "Filter district + score"**.
2. Either wire the output into workflow 12's **Loop companies** node (live chain), or add the optional **"Build wf12 input"** Code node and paste its array into wf12's `CA core-fit input`.
3. First run: **verify the response shape** — confirm hits arrive under `organizations[]` (vs `accounts[]`) and that `postal_code`/`primary_domain` are populated. If empty, it's a field-path tweak in "Filter district + score."
4. Watch credits: start with `PAGES = 1` to sanity-check the filter, then raise.

## Tuning
- District too narrow/broad? Edit `DISTRICT_ZIPS` (currently 90014/90015/90021/90013/90079/90017).
- More/less keyword coverage: edit `KEYWORD_TAGS`.
- This head is **reusable for any geo/industry batch** — swap `LOCATIONS` + `KEYWORD_TAGS` + the zip set.

## Files
- `14_apollo_org_discovery.nodes.js` — paste-ready Code-node bodies + HTTP node config.
- Seed companion: `../outreach/ca-korean-fashion-district-batch3.csv`.
- Field companion: the Fashion District field plan (in the Sales folder).
