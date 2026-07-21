# Firestore security — current state (updated 2026-07-21; superseded the original 2026-06 proposal below)

## Status: DONE, locked down since 2026-06-24
This file originally proposed a fix for open Firestore rules + no app auth. That fix has been implemented (differently in one respect — see below) and has been live for almost a month. The sections under "Historical: original proposal" are kept for context only; do not treat them as a to-do list.

## What's actually in place today
- **Firestore rules are locked** (`firestore.rules`, published in Firebase console 2026-06-24): read/write only for a signed-in user whose email is on the `ALLOWED_EMAILS` allowlist (`isAllowed()`), plus a narrower `isAnyAllowed()` read-only carve-out for `availability`, `config/properties`, `renewals/current`, and `roster/current` so the Avail-only restricted role (Lucy, added 2026-07-07) can read those without full access. Everything else falls under the catch-all `match /{document=**}` block, `isAllowed()`-only.
- **App auth is email/password, not Google.** The original proposal below called for a Google sign-in gate; that was tried and reversed because the OAuth redirect between github.io and firebaseapp.com breaks on mobile (storage partitioning). The shipped fix is Firebase **email/password** sign-in restricted to `ALLOWED_EMAILS` — see `CLAUDE.md`'s "App auth — email/password gate" section (2026-06-24) for the full story.
- **Listeners are deferred until auth, not attached at load.** `liveSnapshot()` wraps every `onSnapshot` call and queues it; `startLiveData()` flushes the queue on first valid sign-in — so nothing hits Firestore before a user is authenticated (which would 403 under the locked rules).
- **Raw REST writes carry the ID token.** `savePA()`/`saveOwnership()` (and the newer Future Plan / Ownership REST PATCH calls) send `Authorization: Bearer <idToken>` via an `authToken()` helper.
- **n8n workflows are unaffected** — they authenticate with a Google service-account credential (`Firebase_SDK_do_or_wait`, datastore scope), which is admin and bypasses security rules entirely. This required updating any n8n Firestore HTTP node that had previously called the REST API unauthenticated (`authentication: none`) to use the service-account credential instead — done as part of the 2026-06-24 lockdown.
- **The Firebase Web API key** (`AIzaSy…` in `index.html`/`firestore-mcp/server.js`) is not a secret and was never the real exposure — it identifies the project, it doesn't grant data access. No rotation needed.

## If this ever needs revisiting
- Adding a new top-level Firestore collection: check whether it should fall under the full-access catch-all (most collections do) or needs its own `isAnyAllowed()`-read carve-out (only needed if Lucy's Avail-only role should be able to see it — see `roster/current` for the precedent).
- Adding a new restricted role (beyond Lucy): follow the `AVAIL_ONLY_EMAILS`/`isAvailOnly()` pattern documented in `CLAUDE.md`'s 2026-07-07 (cont.) session — it requires changes in both `index.html` (UI gating) and `firestore.rules` (real enforcement); a UI-only restriction is cosmetic and doesn't actually stop a signed-in user from hitting Firestore directly.

---

## Historical: original proposal (2026-06, before the 2026-06-24 lockdown — kept for context, no longer actionable)

At the time this was written, Firestore ran on fully open rules (anyone could read/write) with no app-side auth at all, and the plan below was to add a Google sign-in gate + publish locked rules before loading real prospect PII (the `outreach` collection) into the database. The Google sign-in part of the plan was superseded by email/password (see above); the rules-locking part shipped as originally proposed.

- The real exposure was that Firestore ran on open rules and the repo is public, making the project trivially discoverable — the API key was never the issue.
- The recommended order of operations was: (1) optional interim rules + Anonymous Auth stopgap, (2) implement a sign-in gate, (3) publish locked rules, (4) then run prospect data imports at volume.
- Places in the app that assumed no-auth and needed handling: listeners starting at load with no user, raw REST PATCH writes with no token (`savePA`/`saveOwnership`), and SDK writes via `persistItem()`/`setDoc` (which "just work" once a user is signed in). All three were addressed as described in the "What's actually in place today" section above.
