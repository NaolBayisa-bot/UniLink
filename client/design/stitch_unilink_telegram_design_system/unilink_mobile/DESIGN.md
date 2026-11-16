---
name: Unilink Mobile
colors:
  surface: '#fdf7ff'
  surface-dim: '#dfd5f9'
  surface-bright: '#fdf7ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f8f1ff'
  surface-container: '#f2ebff'
  surface-container-high: '#ede4ff'
  surface-container-highest: '#e7deff'
  on-surface: '#1d1732'
  on-surface-variant: '#474553'
  inverse-surface: '#332c48'
  inverse-on-surface: '#f5eeff'
  outline: '#787584'
  outline-variant: '#c9c4d5'
  surface-tint: '#5c4bc3'
  primary: '#5949c0'
  on-primary: '#ffffff'
  primary-container: '#7263db'
  on-primary-container: '#fffbff'
  inverse-primary: '#c7bfff'
  secondary: '#8a486f'
  on-secondary: '#ffffff'
  secondary-container: '#ffaeda'
  on-secondary-container: '#7c3d63'
  tertiary: '#00694d'
  on-tertiary: '#ffffff'
  tertiary-container: '#298365'
  on-tertiary-container: '#f5fff8'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e5deff'
  primary-fixed-dim: '#c7bfff'
  on-primary-fixed: '#180065'
  on-primary-fixed-variant: '#4330aa'
  secondary-fixed: '#ffd8ea'
  secondary-fixed-dim: '#ffaeda'
  on-secondary-fixed: '#3a0329'
  on-secondary-fixed-variant: '#6f3157'
  tertiary-fixed: '#9df4cf'
  tertiary-fixed-dim: '#81d7b4'
  on-tertiary-fixed: '#002116'
  on-tertiary-fixed-variant: '#00513b'
  background: '#fdf7ff'
  on-background: '#1d1732'
  surface-variant: '#e7deff'
typography:
  display:
    fontFamily: Nunito Sans
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 38px
  headline-lg:
    fontFamily: Nunito Sans
    fontSize: 26px
    fontWeight: '800'
    lineHeight: 32px
  headline-md:
    fontFamily: Nunito Sans
    fontSize: 22px
    fontWeight: '800'
    lineHeight: 28px
  headline-sm:
    fontFamily: Nunito Sans
    fontSize: 18px
    fontWeight: '800'
    lineHeight: 24px
  subhead-lg:
    fontFamily: Nunito Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
  subhead-sm:
    fontFamily: Nunito Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  body-lg:
    fontFamily: Nunito Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Nunito Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 21px
  label-md:
    fontFamily: Nunito Sans
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
  label-sm:
    fontFamily: Nunito Sans
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.25rem
  space-xl: 1.5rem
---

## Brand & Style
The design system establishes a playful, youthful, and softly romantic digital environment tailored specifically for university campus communities. Designed natively for a Telegram Mini App viewport (target 390 × 844 pt), the visual narrative balances organic warmth, gentle approachability, and structured campus utility.

Drawing from contemporary soft-pop minimalism with tactile, rounded geometry, the aesthetic evokes emotional comfort, lightweight romance, and trust. Visual clutter is stripped away in favor of generous breathing room, pillow-soft pastel fills, and warm lavender undertones that make digital social discovery feel relaxed, discreet, and inherently delightful.

## Colors
The palette is centered around soothing lavenders paired with expressive pastel companions:

- **Primary Lavender (`#8B7CF6`):** The core brand color, used for primary actions, active highlights, key iconography, and anchor links.
- **Secondary Blush Pink (`#F9A8D4`):** Romantic accent reserved for hearts, likes, crush markers, match notifications, and playful celebratory cues.
- **Tertiary Mint (`#7DD3B0`):** Used for positive reinforcement, online status indicators, campus verification badges, and unlocked states.
- **Neutral Dark (`#2B2540`):** High-contrast deep plum-charcoal ensuring pristine legibility for primary headlines and body copy.
- **Muted Text (`#6F6A85`):** Mid-tone purple-slate for secondary copy, metadata, timestamps, and input placeholders.
- **Surface & Backgrounds:**
  - Page Canvas: `#F7F3FF` (warm tinted lavender haze).
  - Surface Card: `#FFFFFF` (pure white for cards and floating sheets).
  - Tint Fill: `#E9E3FF` (soft lavender wash for pill indicators, secondary buttons, and subtle badges).
- **Destructive Danger (`#F87171`):** High-clarity red restricted strictly to irreversible or destructive actions.

## Typography
Type hierarchy is built entirely with `Nunito Sans`, delivering organic curves and friendly, open letterforms that sustain the soft visual language.

- **Headings (Extra-Bold 800):** Display expressive personality with snug leading to anchor modal headers, screen titles, and profile names.
- **Labels & Subheads (Semi-Bold 600 / Bold 700):** Used for navigation tabs, action buttons, form labels, and badge counts.
- **Body (Regular 400):** Tuned to 16px with a generous 1.5 line-height (`24px`) for effortless scannability on compact mobile screens.
- **Letter Spacing:** Neutral for body text; tracking is tightened (`-0.02em`) on headers `headline-lg` and above to keep titles punchy and cohesive.

## Layout & Spacing
Built for a strict mobile vertical orientation with an optimized 390 pt canvas width.

- **Telegram Header Reservation:** The topmost `56px` vertical band is reserved strictly for native Telegram Mini App controls (Close, Options menu). No application branding or interactive elements may enter this band. App content begins immediately below this offset.
- **Page Canvas Margins:** Global horizontal screen padding is fixed at `16px` (`margin`), maximizing card scanning area without crowding screen boundaries.
- **Vertical Flow:** Standard stacked layout leveraging consistent card gaps of `16px` (`space-md`). Section transitions utilize `20px` to `24px` (`space-lg` to `space-xl`) to establish distinct grouping without requiring horizontal divider lines.
- **Bottom Navigation Offset:** Viewport views must include an `88px` bottom padding buffer to ensure scrolled content remains unblocked by the persistent bottom tab bar.

## Elevation & Depth
Depth is created through chromatic, tinted diffusion rather than neutral shadows, preserving the light and joyful character of the interface.

- **Card Elevation:** Pure `#FFFFFF` surfaces sit above the `#F7F3FF` canvas with a soft lavender-tinted drop shadow:
  `box-shadow: 0 8px 24px rgba(139, 124, 246, 0.12);`
- **Floating Modals & Action Bars:** Elevated navigation and sheets employ an intensified dual-blur shadow:
  `box-shadow: 0 -4px 16px rgba(139, 124, 246, 0.08), 0 12px 32px rgba(139, 124, 246, 0.16);`
- **Tonal Layers:** Secondary groupings inside cards do not use nested shadows. Instead, flat `#E9E3FF` or `#F7F3FF` containers are inset into white cards to preserve a clean hierarchy.

## Shapes
Geometry is distinctly curved, organic, and bouncy, eschewing sharp corners across all interactive components:

- **Card Shells:** Unified `24px` corner radii with generous `16px` to `20px` internal padding.
- **Buttons, Badges, Chips & Avatars:** Fully rounded pill silhouette (`border-radius: 9999px`).
- **Form Controls & Inputs:** `16px` border radii with `1.5px` soft structural borders.
- **Avatars:** Strictly circular (`rounded-full`) displaying pastel gradient fields (Lavender `#8B7CF6` to Blush `#F9A8D4`, or Mint `#7DD3B0` to Lavender `#8B7CF6`) with a centered bold emoji or text initial. Real photographic avatars are strictly excluded to safeguard privacy and sustain illustrative playfulness.

## Components

### Buttons
All buttons share a strict `52px` vertical height and `rounded-full` pill structure with `subhead-lg` typography.
- **Primary Action:** Solid Lavender (`#8B7CF6`), pure white text, subtle shadow `0 4px 14px rgba(139, 124, 246, 0.35)`. Pressed state scales subtly to `0.98`.
- **Secondary Action:** Tinted Lavender fill (`#E9E3FF`), text colored `#8B7CF6`, zero border, flat elevation.
- **Destructive Action:** Pure white background, `1.5px` border in Danger Red (`#F87171`), text colored `#F87171`.
- **Romantic Accent Action:** Solid Blush Pink (`#F9A8D4`) pill for direct liking and match triggers, with white icon and text.

### Chips & Status Badges
- **Tag Chips:** Fully pill-shaped, `32px` height, `#E9E3FF` background, `#2B2540` label typography, `12px` horizontal padding.
- **Live / Online Badge:** Fully pill-shaped, `#7DD3B0` background with a solid `6px` white dot and white `11px` bold text (`label-sm`).
- **Interest Badges:** White card surface, `1px` border in `#E9E3FF`, prefixed with a distinct emoji (e.g., "☕ Coffee Walks", "📚 Study Buddies").

### Input Fields
- **Container:** `52px` height, `16px` border radius, pure `#FFFFFF` background, `1.5px` solid outline in `#E9E3FF`.
- **Typography:** `body-lg` text (`#2B2540`) with muted placeholder (`#6F6A85`).
- **Active State:** Outline transitions to `#8B7CF6` with a soft outer glow (`box-shadow: 0 0 0 3px rgba(139, 124, 246, 0.15)`).

### Cards & Profile Previewers
- **Canvas Card:** `#FFFFFF` background, `24px` radius, `0 8px 24px rgba(139, 124, 246, 0.12)` shadow, `16px` padding.
- **Card Hierarchy:** Header with an illustrative circular avatar (`64px` or `80px`), accompanied by a display name in `headline-md`, study major pill, and an icebreaker prompt framed inside an `#E9E3FF` micro-container.

### Checkboxes & Toggle Controls
- **Toggle Switch:** Pill track in `#E9E3FF` (active: `#8B7CF6`), sliding thumb in pure white with soft drop shadow.
- **Checkboxes:** `22px` rounded square (`6px` corner radius) in `#E9E3FF` border; filled with `#8B7CF6` and a white check icon when checked.

### Bottom Navigation Bar
- Fixed bottom container spanning full viewport width (`390px`), `64px` height plus device safe area.
- Pure `#FFFFFF` background with top boundary shadow (`0 -4px 16px rgba(139, 124, 246, 0.08)`).
- Contains exactly three items: **Discover**, **Matches**, and **Profile**.
- **Active Tab State:** Soft Lavender (`#E9E3FF`) pill container enclosing both the rounded line icon and label, rendered in `#8B7CF6`. Inactive tabs render in `#6F6A85` without a container.

### Empty States & Visual Feedback
- **Illustrations:** Friendly, flat graphical compositions leveraging the palette triad (Lavender, Blush Pink, Mint). Realized with soft tinted shapes and playful emoji accents (such as ✨, 💌, 🌿).
- **Copy Tone:** Warm, conversational, encouraging, and concise (e.g., *"No sparks yet? Let's refresh your campus radius!"*).