# Firestore security — what's exposed and how to fix it

## The short version
- The `AIzaSy…` value in `index.html` (`firebaseConfig.apiKey`) and `firestore-mcp/server.js` is a **Firebase Web API key**. It is **not a secret** — Firebase ships it in the browser by design. It identifies the project; it does not grant data access.
- The real exposure is that **Firestore runs on open rules** (anyone can read/write) and **the repo is public**, so the project is trivially discoverable. The API key is irrelevant to that — the open rules are the hole.
- This matters more now because we're about to load **real prospect names + emails** (the `outreach` collection) into that open database.

## The fix (two steps, in order)

### Step 1 — give the app a sign-in (required first)
The app currently makes every Firestore call with **no authenticated user**. Tightening the rules without adding auth would lock the live app out. So first add a lightweight **Google sign-in gate** (restricted to `@cubework.com`). This is an `index.html` change — happy to implement it on request. It involves:
- importing `firebase-auth`, showing the (already-styled) `.auth-card` sign-in screen,
- signing in **before** the Firestore listeners attach,
- sending the user's ID token on the two raw REST writes (see flags below).

### Step 2 — deploy the rules
Once sign-in is live, paste `firestore.rules` (the RECOMMENDED block) into **Firebase console → Firestore Database → Rules → Publish**. n8n keeps working throughout — its service account bypasses rules.

If you want a same-day stopgap before the app work is done, deploy the **INTERIM** block (any signed-in user) together with **Anonymous Auth** — weak, but it closes the "no token needed at all" door.

## Places in the app that assume no-auth (must be handled in Step 1)

1. **Listeners start at load with no user** — `index.html` ~line 1224, comment *"FIRESTORE LISTENER (starts immediately, no auth needed)"*, plus every `onSnapshot(collection(db, …))` for `topics`, `leads`, `availability`, `notes`, `pricing`, `renewals`, and the new `outreach`. Under tightened rules these throw `permission-denied` unless a user is signed in first. → Attach listeners only after sign-in.
2. **Raw REST PATCH writes with no token** — `savePA()` (~line 3879) and `saveOwnership()` (~line 3915) call the Firestore REST API directly with no `Authorization` header. These will be denied. → Add `Authorization: Bearer <idToken>` to those fetches, or convert them to SDK `setDoc(..., {merge:true})`.
3. **SDK writes** — `persistItem()` (`setDoc`), `saveTopic`, `deleteDoc`, note/lead saves, and the Claude helper functions (`claudeLogLeadUpdate`, `claudeAddTask`, …) all run as the current user. These work fine once a user is signed in — no code change beyond having auth.

## What does NOT need changing
- **n8n workflows** (availability, pricing, renewals, follow-up scanner, Apollo ingestion, resolve-thread): all use the Google **service account**, which is admin and **ignores security rules**. They keep reading/writing normally.
- The Firebase API key: no need to rotate — it isn't what's exposing data. (You *can* add API-key referrer/app restrictions in Google Cloud console as defense-in-depth, but it's optional.)

## Recommended order of operations
1. (Optional, today) Interim rules + Anonymous Auth as a stopgap.
2. Implement the Google sign-in gate in `index.html` (ask me).
3. Publish the RECOMMENDED rules.
4. Then run the Apollo pull at volume into the now-protected `outreach` collection.
