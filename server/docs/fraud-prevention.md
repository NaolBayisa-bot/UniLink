# UniLink — Fraud & Abuse Prevention Design Notes

> **Purpose:** a living reference for the fraudulent-activity risks we've discussed
> (identity verification, fake photos, bullying/via reveal) and the layered
> solutions we've decided to pursue. Use it to tailor specific solutions as we build.

---

## 1. The core threat model

The primary, concrete abuse path to defend against:

- An attacker signs up with a **fake image** (possibly not even a real human) and a throwaway identity.
- They successfully **match** with a genuine user.
- At match time the app **reveals** the victim's `real_name`, `telegram_username`, and `department` (via `getRevealedProfile`).
- The attacker now has enough identity information to **bully, threaten, or dox the victim** — reached purely through a fabricated profile and a single match.

Secondary threats:
- Mass / sock-puppet account creation by one person (multiple emails or Telegram accounts).
- Impersonation of other users.
- Spam / low-quality engagement.

---

## 2. What verification can and cannot prove

| Claim | Can software prove it? |
|---|---|
| "You control this email / phone" | ✅ Yes (OTP) |
| "You are one person, not many" | ⚠️ Partially (weak; one person can hold many emails/numbers) |
| "You are a real, well-intentioned human" | ❌ Never fully |
| "You are the person in your photo" | Only with **liveness + ID** verification |
| "You won't abuse private data after a match" | ❌ Never provable |

**Key principle:** identity verification happens *around identity*, but the harm happens
*after a match*. Therefore fraud prevention must be built into the **reveal path**,
not just into signup.

---

## 3. Verification tiers (the layered defense)

| Tier | Mechanism | Sufficient for |
|---|---|---|
| 1 | Telegram login **or** Google OAuth identity | Baseline account creation / login |
| 2 | Phone OTP (SMS) — your own provider | Uniqueness floor, throttling, recovery |
| 3 | **Liveness + ID (KYC)** | Proving a real human with a real photo |
| 4 | Reports + blocks + moderation | Intent, recourse, repeat offenders |

**Suggested UniLink policy:**
- **Public discovery:** Tier 1–2 (low friction).
- **Match + private-data reveal:** require **at least Tier 3 (ID/liveness) for BOTH users**,
  plus an account-age / activity floor, before `real_name` / `telegram_username` / `department`
  are revealed.

> **This is the single most important design decision.** It stops the
> fake-photo → match → bully loop by making private data unreachable from a cheap
> throwaway account.

---

## 4. OTP: worth it or not?

- **Email + OTP** proves only "you can read a free throwaway inbox" — the **weakest**
  identity signal, and it does **nothing** against the fake-photo bully. Do **not**
  invest in it for *signup identity*.
- Keep **your own OTP only later**, purely for **email-change confirmation / recovery**.
- **Phone OTP (SMS)** is a meaningful upgrade (it costs money per message), but it still
  only proves control of a number — not humanity or intent.

---

## 5. Google OAuth: free and better as the login baseline

- **Free** (OIDC). The client/server secret costs nothing; you only pay if you later
  add ID/KYC verification products.
- Stronger than email+OTP: the `email` claim in Google's id_token is **Google-verified**
  and tied to a real Google account.
- Reuses our pattern from `jwt-auth.ts` — verify Google's **id_token (RS256)** against
  Google's JWKS, then mint our own JWT for the session.
- **Caveat:** still does **not** require a real face photo → the reveal gate (Tier 3)
  is still required regardless.

**Decision:** use **Google OAuth for sign-in** instead of building email+OTP.

---

## 6. Protect the reveal itself (behavioral + consent design)

Even between verified users, the reveal should be:
- **Staged / progressive** — no automatic info-dump the instant a match happens.
- **Consensual** — require an explicit mutual "share contact" action before
  `telegram_username` is revealed.
- **Revocable / expiring** — do not make private data permanent.
- **Minimal** — prefer a generated handle over raw `real_name` until a higher bar is met;
  avoid bulk-enumerable endpoints (`getRevealedProfile` already forbids `SELECT *`
  and is strictly per-pair).

---

## 7. Accountability & recourse (the safety net)

- **Reports + blocks** (already in our schema) — make reporting low-friction and prominent.
- On report: revoke the abuser's reveals (set `unmatched_at`), set `status='flagged'`,
  notify the victim.
- **Burner-account heuristics:** device / IP fingerprinting, detecting the same Cloudinary
  photo hash across multiple accounts, and an account-age / activity floor before matching.

---

## 8. Concrete codebase impact (proposed, some already landed)

- [ ] **Landed:** `getPublicProfile` / `getRevealedProfile` in `src/db/users.ts` (no `SELECT *`; private data only on match).
- [ ] **Landed:** `updateOwnProfile` strips non-editable fields — `gender` and `telegram_username`.
- [ ] **Pending:** add `verification_level` (`google | phone | id`) to `users`.
- [ ] **Pending:** enforce `>= id` (plus account-age/activity floor) for **both** users inside `getRevealedProfile`.
- [ ] **Pending:** Google OAuth sign-in route + id_token RS256 verification + issue own JWT.
- [ ] **Pending (later):** consensual reveal — a `reveal_consents` table + a
      "match but share-contact-only-on-mutual-consent" flow.

---

## 9. Photo verification (the bait)

### 9.1 Why the photo needs its own treatment
- `users.photo_public_id` is stored on Cloudinary and shown in **discovery** (it is part of
  `getPublicProfile`), so it is the **public "hook"** — and simultaneously the **fraud
  vector**: a stock/non-human image is exactly what attracts victims into a match.
- The photo does **two** jobs: a public hook (must look human) and the attack surface
  (a fake image can impersonate or manipulate). Verification must address both.

### 9.2 What plain upload can and cannot prove
| Question | Answerable without extra services? |
|---|---|
| Is it a valid file type / size / dimensions? | ✅ Cheap (client + server) |
| Is it NSFW / obviously not a clean image? | ⚠️ Cloudinary moderation API (basic only) |
| Is it actually a real, current human? | ❌ Requires **liveness / facial** check |
| Is this the account holder's real face? | ❌ Requires **selfie + ID match** (KYC) |

**Cloudinary is storage + basic moderation — it is NOT a liveness/identity verifier.**

### 9.3 Options, weakest → strongest
| Opt | Mechanism | What it blocks | Cost |
|---|---|---|---|
| A | Trust-but-verify-later (any upload) | Nothing | Free — ❌ insufficient |
| B | **Liveness selfie** at signup | Fake/stock images, batch fake accounts | Paid per check |
| C | Photo **moderation/review queue** | Known junk, obvious abuse | Cheap-ish, human latency |
| D | **Full KYC**: live selfie matched to gov. ID | Fake identity, impersonation | Highest cost/friction |
| E | **Heuristics**: photo-hash dedupe, constraints | Photo farming across accounts, junk | Free/cheap |

### 9.4 Recommended layering for UniLink
```
Public discovery / signup (photo = hook):
  - Client: enforce type / size / dimensions          (free)
  - Server: store on Cloudinary, persist photo_public_id
  - Liveness selfie check (Option B) if budget allows  <- kills fake-photo signups
  - Photo-hash dedupe + constraints (Option E)         <- kills photo farming

Reveal gate (before ANY private data):
  - Require BOTH users at verification_level >= id (Option D)
    so a live selfie alone is NOT enough to see real_name / telegram_username /
    department — a throwaway must also burn a real legal identity.
```
**Sequencing matters:** the *public* photo needs at least **liveness (B)** to stop the
fake-image hook; the *private reveal* needs **ID (D)** to stop extracted-info bullying.
Either alone is incomplete — together they cover both halves of the loop.

### 9.5 Live selfie capture (camera-based) — the free first win
- **What it changes:** the user **captures a live selfie with the device camera**
  (via `getUserMedia()` / `<input type="file" capture="user">` on mobile) instead of
  uploading an image from the file folder / gallery.
- **Why it matters:** it removes the **"pick any file" attack** — a stock or downloaded
  image can no longer be fed in directly. This is the **free** implementation of
  Option B, and it is the single biggest reduction of the fake-photo threat.
- **Honest limits — capture ≠ verified human:** a live selfie forces a *camera capture*,
  but it alone does not prove a real human face matching the account holder.
  Surviving threats:
  - **Photo-of-a-photo / print:** holding another person's image (or printed face) in front of the camera.
  - **Recruited-person selfie:** a real person taking the selfie on the attacker's behalf.
  - **Non-face object:** a live capture of a hand/object could pass a naive check.
  These require **facial liveness detection** (blink / head-turn / AI depth), and — for the
  reveal gate — **ID/selfie match (KYC)**.
- **Stack mapping (client / server):**
  - Client (React/Vite): camera capture via `getUserMedia()` or `capture="user"`; enforce type/size/dimensions.
  - Server (Node/Express): basic validation (MIME, dimensions) → upload to Cloudinary → store
    `photo_public_id` (the existing `users` column).
  - Later: photo-hash dedupe to flag a single image reused across many accounts.
- **Cost:** capture = **free**; liveness = free (on-device ML) to paid; ID match = paid KYC.

### 9.6 Open decisions (need owner input)
- [ ] v1 photo policy: free **heuristics + moderation (C+E)** now, escalate to liveness later?
- [ ] Reveal gate: full **ID (D)** required, or is **verified selfie + phone + age floor** enough for v1?
- [ ] **Live selfie bar:** capture-only (free) vs. capture + liveness vs. capture + liveness + ID?

---

## 10. Concrete codebase impact (proposed, some already landed)

- [ ] **Landed:** `getPublicProfile` / `getRevealedProfile` in `src/db/users.ts` (no `SELECT *`; private data only on match).
- [ ] **Landed:** `updateOwnProfile` strips non-editable fields — `gender` and `telegram_username`.
- [ ] **Pending:** add `verification_level` (`google | phone | id`) to `users`.
- [ ] **Pending:** enforce `>= id` (plus account-age/activity floor) for **both** users inside `getRevealedProfile`.
- [ ] **Pending:** Google OAuth sign-in route + id_token RS256 verification + issue own JWT.
- [ ] **Pending (later):** consensual reveal — a `reveal_consents` table + a
      "match but share-contact-only-on-mutual-consent" flow.
- [ ] **Pending:** photo upload — enforce type/size/dims on client & server; store via Cloudinary.
- [ ] **Pending:** camera-based **live selfie capture** at signup (free; `getUserMedia()` / `capture="user"`).
- [ ] **Pending:** photo-hash dedupe to flag a single image reused across many accounts.
- [ ] **Pending (if budget):** liveness selfie detection at signup (Option B).

---

## 11. Honest bottom line

No software fully verifies a human. The winning policy:

> **Make abuse expensive and reversible.** Force one real, contactable, hard-to-recreate
> identity for every account that can see private data — and never auto-dump private
> information at match time.