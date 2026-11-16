# Unilink Frontend Brief

## Product
Unilink is a Telegram Mini App for university students to discover and match with other students on the same campus, with a safety-first profile flow and private contact sharing after a mutual match.

## Core user journey
- Launch or sign in with Telegram.
- Complete a lightweight profile setup: nickname, gender, campus-safe profile details.
- Browse nearby students and like or pass on profiles.
- Match with someone and view the match detail screen.
- Share a contact or keep the conversation within Telegram depending on the state.
- Manage profile, safety actions, and match list from a mobile tab layout.

## Design constraints
- Mobile-first; designed for a Telegram in-app browser at roughly 390x844.
- Light and dark surfaces follow Telegram's theme, but the brand palette remains soft lavender, blush, and mint.
- Do not invent screens or features beyond what is visible in the design exports.
- Use only the repo-local design system and API contract as the source of truth.

## Stack
- React 18
- Vite
- Tailwind CSS 3.4
- React Router 6
- TanStack Query 5
- react-hook-form + zod
- lucide-react
- @fontsource/nunito
- clsx

## App behavior requirements
- All API calls live under `src/api` and must not be made directly from components.
- Token storage must remain in memory only; no localStorage, sessionStorage, cookies, or URL tokens.
- Never log tokens, Telegram initData, emails, or usernames.
- Use gray silhouette placeholders instead of photos of real people.
- Match all states: loading, empty, error, and success.
- Mock mode must work without a backend.

## Design source
The design assets live under:
- `client/design/stitch_unilink_telegram_design_system/`

The available exports include the app screens and HTML prototypes that define the actual UI decisions for the build.
