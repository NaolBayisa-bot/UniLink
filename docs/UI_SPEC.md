# Unilink UI Specification

This document is derived from the design exports under `client/design/stitch_unilink_telegram_design_system/`, especially the HTML prototype files and the summarized design tokens in `client/design/stitch_unilink_telegram_design_system/unilink_mobile/DESIGN.md`.

The design exports are the source of truth. Where visual detail could not be confirmed from the exported HTML, it is marked as `UNVERIFIED` rather than guessed.

## 1. Design tokens

### 1.1 Core palette
These values are the exact brand colors used by the design system and repeated throughout the prototype HTML.

- Page background: `#F7F3FF`
- Page background (warm): `#FDF7FF`
- Card / surface low: `#FFFFFF`
- Primary lavender: `#5949C0`
- Soft fill / lavender tint: `#E9E3FF`
- Blush pink: `#F9A8D4`
- Soft blush fill: `#FCE7F3`
- Blush text / warm accent: `#8A486F`
- Mint: `#7DD3B0`
- Soft mint fill: `#9DF4CF`
- Danger: `#F87171`
- Text: `#2B2540` / `#1D1732`
- Muted text: `#6F6A85` / `#474553`
- Borders / outlines: `#E7DEFF`, `#C9C4D5`, `#787584`

### 1.2 Type scale
These typography values come directly from the design HTML tokens and the DESIGN.md summary.

- Display: `32px`, weight `800`, line-height `38px`
- Headline large: `26px`, weight `800`, line-height `32px`
- Headline medium: `22px`, weight `800`, line-height `28px`
- Headline small: `18px`, weight `800`, line-height `24px`
- Subhead large: `16px`, weight `600`, line-height `22px`
- Subhead small: `14px`, weight `600`, line-height `20px`
- Body large: `16px`, weight `400`, line-height `24px`
- Body medium: `14px`, weight `400`, line-height `21px`
- Label medium: `13px`, weight `600`, line-height `18px`
- Label small: `11px`, weight `700`, line-height `14px`
- Caption/metadata: same as label small where used in chips and micro-copy

### 1.3 Spacing scale
- `space-xs`: `4px`
- `space-sm`: `8px`
- `space-md`: `16px`
- `space-lg`: `20px`
- `space-xl`: `24px`
- Screen gutter / page margin: `16px`
- Section spacing: `20px` to `24px`
- Compact stack gap: `12px`
- Card vertical height: `72px` on browse list, `80px` on matches list

### 1.4 Radius
- Default card radius: `16px`
- Large card radius: `22px` to `24px`
- Full pill radius: `9999px`
- Input radius: `16px`
- Small chip radius: `9999px`

### 1.5 Shadows
- Card shadow: `0 8px 24px rgba(139, 124, 246, 0.10)`
- Elevated button shadow: `0 4px 14px rgba(139, 124, 246, 0.35)`
- Floating modal / sheet shadow: `0 12px 32px rgba(139, 124, 246, 0.16)`
- Soft ambient glow: `0 8px 24px rgba(139,124,246,0.08)`

### 1.6 Gradients
- Lavender-to-blush gradient: `linear-gradient(to right, #E5DEFF, #FFD8EA)`
- Primary action gradient: lavender to deeper lavender, used for hero / identity cues
- Mint accent wash: `#9DF4CF` to `#7DD3B0`
- Background gradient: from `#E9E3FF` to `#FCE7F3`

## 2. Layout rules
- Viewport: `390x844` mobile portrait
- Telegram top safe area reserved: `56px`
- Bottom tab bar / system safe area: `88px` from the bottom
- Screen margins: `16px` horizontal
- Content starts below the Telegram safe area; no app UI is placed in the reserved 56px stripe
- Safe-area padding: use `env(safe-area-inset-top/bottom)` as shown in HTML exports
- Scroll behavior: `overflow-y: auto`, no visible scrollbars
- Sticky bottom CTA: anchored to the bottom of the viewport, above the tab bar or bottom sheet area, not under it
- Mobile-first touch targets: min `44px` with common button heights around `52px`

## 3. Component inventory

### 3.1 Button
- Height: `52px`
- Radius: full pill
- Typography: `subhead-lg` or `label-md`
- Variants:
  - Primary: solid lavender, white text
  - Secondary: soft lavender fill, primary text
  - Destructive: white background with red border and red text
  - Ghost: transparent or low-contrast text button
- States:
  - Default: filled lavender or soft fill
  - Pressed: `active:scale-[0.99]`, slightly darker or more saturated
  - Disabled: opacity reduced, no hover/press effect
  - Loading: spinner or pulsing dots

### 3.2 Input
- Height: `56px` inside form rows
- Background: white or surface-low
- Radius: `16px` to `24px`
- Border: subtle tonal fill, no harsh border
- Label row appears above input
- Helper copy underneath when relevant
- Validation state: change background tint or text color to muted red on invalid state

### 3.3 Selectable card
- Used for gender selection and profile choices
- Card size: approximate `150x120` in a 2-column grid
- Radius: `24px`
- Default: white or surface-low with shadow
- Selected: lavender border or filled tint and higher contrast text
- Pressed: slight scale-to-0.98

### 3.4 Chip / pill
- Radius: `9999px`
- Default background: `#E9E3FF` or `#FCE7F3`
- Primary text: `#5949C0`
- Used for “New”, “Campus Active”, “Recent”, and interest/badge labels

### 3.5 Avatar
- Circular, `48px` to `52px`
- Gradient backgrounds using primary/lavender + blush or mint
- Small green online dot present in some cards
- Real photos are not used in the design; emoji or abstract avatar artwork is used instead

### 3.6 Status chip
- Small dot or capsule indicating match state, online status, or validation
- Example: green online dot, “New” chip, “Campus Active” pill

### 3.7 Card
- White surfaces with rounded corners and soft lavender shadow
- `h-[72px]` or `80px` match list rows
- `p-4` internal padding
- Sometimes has a left accent bar to signal unread state

### 3.8 List row
- Horizontal row with avatar + content + optional right-side pill or icon
- Used in discover and matches screens
- Typical layout: avatar, text block, action button or chevron

### 3.9 Progress steps
- Three-step progress bar, each segment a `6px` rounded bar
- Active segment: lavender; inactive: pale tint
- Shows “Step 1 of 3”, “Step 2 of 3”, etc.

### 3.10 Reveal ladder / reveal states
- Used on match detail and contact reveal interactions
- “You both like” / “Share contact” / “No public username” state hierarchy
- Different states correspond to three visual states in the design exports for the same match detail screen

### 3.11 Tab bar
- Fixed bottom tab bar with 4 items: Discover, Matches, Profile, maybe admin if enabled
- Each item uses an icon, label, and selected state in lavender
- Heavily padded for safe area and bottom behavioral spacing

### 3.12 Bottom sheet / modal sheet
- Floating action sheet anchored to bottom with soft shadow
- Used for safety actions like report, block, and unmatch confirmation
- Contains a title, options, and destructive CTA

### 3.13 Toast / banner
- Soft message cards or sliding banners used for status feedback
- “Session expired”, “No connection”, “Account unavailable” system states are handled as full-screen states, not inline toast banners

### 3.14 Empty state
- Centered illustration or icon with headline and short body copy
- Example: no more profiles, no matches yet

### 3.15 Skeleton / loading state
- Animated dots or pulse placeholders used during loading and sign-in flows

## 4. Screen inventory

### 4.1 `unilink_launch_loading_screen`
- Purpose: welcome + sign-in loading screen
- Text: “Unilink”, “Meet people from your campus”, “Signing you in with Telegram...”
- Components: launch logo, ambient gradient, animated three-dot loader
- States: loading only
- Interaction: transitions to sign-in or app shell after Telegram auth resolves
- API fields: `token`, `user.nickname`, `user.gender`, `user.profile_complete`

### 4.2 `profile_setup_step_1_of_3`
- Purpose: nickname and gender setup
- Top text: “Step 1 of 3”, “Let’s set you up”, “Pick a nickname. It’s the only thing people see before you match.”
- Field text: “Nickname”, “I am”, helper labels and selected gender card states
- Components: progress bar, input field, gender option cards, next CTA
- Interaction: enter nickname, select gender, continue to step 2
- API fields: `nickname`, `gender`, `profile_complete`

### 4.3 `profile_setup_step_2_of_3`
- Purpose: profile details + department or personal details
- Text present in HTML includes “Add your department” and “Tell us a little more” patterns, with campus-safe item selection
- Components: input, options grid, pill selections, action buttons
- Interaction: continue to next step, back navigation
- API fields: `real_name`, `department`, `keyword_ids`, `profile_complete`

### 4.4 `profile_setup_step_3_of_3`
- Purpose: final profile confirmation / upload step
- Text includes onboarding completion cues and final CTA language
- Components: photo upload surface, review card, progress bar, continue/finalize button
- Interaction: finish profile setup and route to discover
- API fields: `photo_set`, `keyword_ids`, `profile_complete`

### 4.5 `discover`
- Purpose: main browse list of candidate students
- Header: “Discover”, campus live pill
- Subheading: “People who might be your type”
- Rows: candidate cards with avatar, name, new status, and heart button
- Interaction: tap a candidate row to open detail, tap heart to like
- API fields: `/browse` items (`id`, `nickname`, `created_at`), `/like` with `to_user_id`

### 4.6 `discover_empty_state`
- Purpose: no more profiles available state
- Text: empty state messaging around “No more students” / “There’s no one new right now” depending on export treatment
- Components: illustration, CTA, maybe refresh button
- Interaction: return to profile or refresh list
- API fields: `/browse` empty array

### 4.7 `matches`
- Purpose: list of active matches and status
- Header: “Matches 💜”, with “North Quad” capsule and count label
- Rows contain match names, “New” badges, and chevron to open detail
- Interaction: open match detail or filter list
- API fields: `/matches` array (`match_id`, `matched_at`, `other_user`) and `/match/{match_id}/profile`

### 4.8 `matches_empty_state`
- Purpose: no matches yet state
- Components: illustration, message, “Go discover” or similar CTA
- Interaction: route to discover
- API fields: `/matches` returns empty list

### 4.9 `match_detail_luna_state_a`
- Purpose: match detail with contact available or pending share state
- Header shows user name and match metadata
- Components: avatar, shared contact / username / buttons, safety actions
- Interaction: share contact, report, unmatch, block
- API fields: `/match/{match_id}/profile`, `/match/{match_id}/share-contact`, `/block`, `/report`

### 4.10 `match_detail_luna_state_b`
- Purpose: match detail when contact is not available or no username is visible
- Components: expanded card with reveal/CTA, safety actions
- Interaction: reveal state, share contact, close / back
- API fields: `telegram_username`, `has_shared_contact`, `contact_unavailable`

### 4.11 `match_detail_luna_state_c`
- Purpose: reveal ladder or complete “you both like” / contact revealed state
- Components: contact card, buttons, verification chips
- Interaction: open Telegram, copy username, report, block
- API fields: `telegram_username`, `i_shared_contact`, `they_shared_contact`

### 4.12 `match_detail_luna_no_username`
- Purpose: no public username state
- Components: no-username illustration, CTA to share contact or continue
- Interaction: share contact or leave to Telegram safe state
- API fields: `has_shared_contact:false`, `contact_unavailable:true`

### 4.13 `it_s_a_match_celebration`
- Purpose: success overlay after a like creates a match
- Text: “It’s a match!” or equivalent celebratory wording
- Components: confetti, multi-color hearts, CTA button
- Interaction: tap continue to view match detail or back to discover
- API fields: `/like` response with `matched: true`, `match_id`

### 4.14 `profile`
- Purpose: current user profile screen
- Components: avatar, profile name, stats, list of keywords, settings or edit button
- Interaction: edit details, open profile setup again, view verification state
- API fields: `/me`, `has_photo`, `keyword_ids`, `profile_complete`

### 4.15 `edit_details`
- Purpose: editing profile details and photo controls
- Components: input fields, save CTA, maybe keyword chips
- Interaction: save profile changes
- API fields: `/profile`, `/profile/keywords`, `/photo/upload-signature`

### 4.16 Safety sheets
- `safety_sheet_menu_13a`: main action sheet with report/unmatch/block options
- `safety_sheet_unmatch_confirm_13b`: confirm unmatch action
- `safety_sheet_block_confirm_13c`: confirm block action
- `safety_sheet_report_13d`: report form or reason sheet
- Interaction: destructive actions confirm and return to match detail
- API fields: `/unmatch`, `/block`, `/report`

### 4.17 System states
- `system_state_offline_16a`: offline / no connection
- `system_state_session_expired_16b`: session expired
- `system_state_account_unavailable_16c`: account disabled
- `system_state_open_in_telegram_16d`: open app in Telegram wrapper or outside shell
- Components: hero illustration, message, single CTA
- Interaction: retry sign-in or reopen app
- API fields: error states derived from HTTP statuses and network failure handling

## 5. Navigation map
- Launch / splash: app startup or Telegram auth flow
- Public flow: launch -> login -> onboarding -> discover
- Sessioned flow: discover tab, matches tab, profile tab
- Detail screens: pushed from matching or matches list
- Safety actions: bottom sheets over the current screen
- Telegram back button: shown only for pushed/stacked screens; hidden on tab screens

## 6. Copy deck
- “Unilink”
- “Meet people from your campus”
- “Signing you in with Telegram...”
- “Discover”
- “People who might be your type”
- “Campus Active”
- “Pull to refresh”
- “Luna” / “Pixel” / other candidate names from the mocks
- “New”
- “Matches 💜”
- “Recent”
- “Step 1 of 3”
- “Let’s set you up”
- “Pick a nickname. It’s the only thing people see before you match.”
- “Nickname”
- “I am”
- “Campus Safe”
- “Keep it cute & friendly”
- “No connection”
- “Session expired”
- “Account unavailable”
- “Open in Telegram”
- “It’s a match!”

## 7. Motion
- Loading dots: subtle bounce animation with 1.4s ease-in-out cycle
- Floating icon: slow up/down hover using `floatSlow` style
- Subtle scale on press: `active:scale-[0.99]`
- Status pulse: green dot pulse for online / campus active
- Transition defaults: `transition-all duration-200` on cards and buttons
- Confetti: used for match celebration screen; design uses pastel confetti dots and a short celebration state
- Proposed defaults: use short, subtle transitions; no heavy animations; keep all motion under ~300ms

## 8. Ambiguities
1. The exact final set of copy strings on some empty-state and profile screens is not fully visible in the HTML exports; proposed default: use short, cheerful, campus-safe phrases consistent with the rest of the design.
2. The final value of some bottom sheet button labels and row actions is partially inferred from the flow; proposed default: use “Report”, “Block”, and “Unmatch” as the canonical labels seen in the screens.
3. The specific API/feature mapping for admin-only screens is not represented in the visible design exports; proposed default: treat admin-only flows as hidden unless the user is flagged as admin.
4. The exact dark theme palette was not fully rendered in the exported HTML; proposed default: keep the same lavender, blush, and mint palette, but darken the page background and boost contrast while preserving the light brand shapes.
5. Exact red/green semantics for validation state and online badges were not reproduced in every single screen; proposed default: use the mint online badge and danger red for destructive actions only.

## 9. Version map
This repo does not contain a formal manifest file named `design/MANIFEST.md`; the design folder is structured as screen groups and HTML exports instead. The current screen family can be grouped as follows:

| Screen group | Core purpose | Design status |
| --- | --- | --- |
| Launch / onboarding | sign-in, onboarding setup | v1 |
| Discover | browse / likes | v1 |
| Matches | match list | v1 |
| Match detail | reveal + contact sharing | v1 |
| Profile / edit | user profile management | v1 |
| Safety sheet | block/report/unmatch flows | v1 |
| System state | offline/session/account states | v1 |
| Match celebration | mutual match success | v1 |

## Design file references reviewed
- `client/design/stitch_unilink_telegram_design_system/unilink_mobile/DESIGN.md`
- `client/design/stitch_unilink_telegram_design_system/unilink_launch_loading_screen/code.html`
- `client/design/stitch_unilink_telegram_design_system/profile_setup_step_1_of_3/code.html`
- `client/design/stitch_unilink_telegram_design_system/discover/code.html`
- `client/design/stitch_unilink_telegram_design_system/matches/code.html`
- `client/design/stitch_unilink_telegram_design_system/match_detail_luna_state_a/code.html`
- `client/design/stitch_unilink_telegram_design_system/match_detail_luna_state_b/code.html`
- `client/design/stitch_unilink_telegram_design_system/match_detail_luna_state_c/code.html`
- `client/design/stitch_unilink_telegram_design_system/it_s_a_match_celebration/code.html`
- `client/design/stitch_unilink_telegram_design_system/safety_sheet_menu_13a/code.html`
- `client/design/stitch_unilink_telegram_design_system/system_state_offline_16a/code.html`
