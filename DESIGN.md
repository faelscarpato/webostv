---
name: Cinematic Lumina 10-Foot UI
colors:
  surface: '#0f131e'
  surface-dim: '#0f131e'
  surface-bright: '#353945'
  surface-container-lowest: '#0a0e19'
  surface-container-low: '#171b26'
  surface-container: '#1b1f2b'
  surface-container-high: '#262a35'
  surface-container-highest: '#313441'
  on-surface: '#dfe2f2'
  on-surface-variant: '#bbc9cf'
  inverse-surface: '#dfe2f2'
  inverse-on-surface: '#2c303c'
  outline: '#859399'
  outline-variant: '#3c494e'
  surface-tint: '#47d6ff'
  primary: '#a5e7ff'
  on-primary: '#003543'
  primary-container: '#00d2ff'
  on-primary-container: '#00566a'
  inverse-primary: '#00677f'
  secondary: '#ffb2bd'
  on-secondary: '#670024'
  secondary-container: '#e1005a'
  on-secondary-container: '#fff6f6'
  tertiary: '#00fd9f'
  on-tertiary: '#003920'
  tertiary-container: '#00dd8b'
  on-tertiary-container: '#005b36'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#b6ebff'
  primary-fixed-dim: '#47d6ff'
  on-primary-fixed: '#001f28'
  on-primary-fixed-variant: '#004e60'
  secondary-fixed: '#ffd9dd'
  secondary-fixed-dim: '#ffb2bd'
  on-secondary-fixed: '#400014'
  on-secondary-fixed-variant: '#900037'
  tertiary-fixed: '#54ffaa'
  tertiary-fixed-dim: '#00e38e'
  on-tertiary-fixed: '#002110'
  on-tertiary-fixed-variant: '#005230'
  background: '#0f131e'
  on-background: '#dfe2f2'
  surface-variant: '#313441'
typography:
  headline-xl:
    fontFamily: Sora
    fontSize: 56px
    fontWeight: '700'
    lineHeight: 68px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Sora
    fontSize: 40px
    fontWeight: '600'
    lineHeight: 50px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Sora
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: 0em
  headline-sm:
    fontFamily: Sora
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: 0em
  body-xl:
    fontFamily: Outfit
    fontSize: 24px
    fontWeight: '400'
    lineHeight: 34px
    letterSpacing: 0em
  body-lg:
    fontFamily: Outfit
    fontSize: 20px
    fontWeight: '400'
    lineHeight: 28px
    letterSpacing: 0em
  body-md:
    fontFamily: Outfit
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 26px
    letterSpacing: 0em
  label-lg:
    fontFamily: Outfit
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
    letterSpacing: 0.04em
  label-tech:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.06em
  label-shortcut:
    fontFamily: Sora
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 18px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  margin: 3.5rem
  space-xs: 0.5rem
  space-sm: 0.75rem
  space-md: 1.25rem
  space-lg: 2rem
  space-xl: 3rem
---

## Brand & Style

The design system powers an ultra-responsive, premium IPTV streaming interface specifically architected for large-format displays viewed from a typical 3-meter living room distance (the 10-foot experience). The interface balances theater-grade immersion with instant legibility. The aesthetic unites deep OLED blacks with cinematic glass layers and electric, neon-charged accents reminiscent of next-generation optical audio and video gear.

Key emotional pillars:
- **Immersive Spectacle:** Backgrounds recede completely into deep display panel blacks, allowing stream content and program art to command total visual focus.
- **Effortless Precision:** Crystal-clear spatial directional states guarantee zero spatial disorientation whether driven by a precision D-pad hardware cross or a floating LG Magic Remote pointer.
- **Broadcast Sophistication:** Technical data (codecs, resolutions, bitrates, audio profiles) is presented with the clarity of a pro-grade broadcast control room, streamlined for entertainment consumers.

## Colors

The palette leverages true pitch black for high-efficiency OLED pixel shutoff, layered with slate-glass backing surfaces and hyper-saturated phosphor tones.

- **Canvas & True Black:** `#06070a` serves as the canvas ground and deep backdrop, with `#0a0b10` providing root structural containment.
- **Surfaces & Cards:** `#131722` at varying opacities (`rgba(19, 23, 34, 0.75)` for frosted glass backdrops; `#1a2030` for elevated floating cards).
- **Primary Electric Cyan (`#00d2ff`):** The primary focus driver. Used for active selection rings, active progress bars, playback scrubs, and direct input interaction.
- **Secondary Neon Coral/Magenta (`#ff2a6d`):** Used for live broadcasts, recording markers, favorite toggles, and high-priority alerts.
- **Tertiary Phosphor Mint (`#05ffa1`):** Indicates stable high-bandwidth streams, completed buffers, and positive diagnostic telemetry.
- **Remote Shortcut Color Keys:**
  - Red Key: `#ff3b30`
  - Green Key: `#34c759`
  - Yellow Key: `#ffcc00`
  - Blue Key: `#007aff`
- **Text & Contrast:** Primary text is `#ffffff` (100% luminance). Secondary metadata is set to `rgba(255, 255, 255, 0.65)`. Inactive icons and structural dividers use `rgba(255, 255, 255, 0.16)`.

## Typography

The type scale is calibrated strictly for high visual acuity at a 10-foot distance on 4K (3840×2160) and FHD (1920×1080) outputs. 

- **Display & Headings (Sora):** A clean geometric sans with wide proportions, open counters, and high distinction between glyphs. It cuts through glass layers and dark gradients without edge degradation.
- **Body & Metadata (Outfit):** Provides effortless readability for synopsis texts, channel names, and program descriptions at rapid scan rates.
- **Telemetry & Stream Metadata (JetBrains Mono):** Monospaced technical indicators ensure frame rates, bitrates, audio stream specs, and buffer numbers don't jitter horizontally as dynamic stream telemetry fluctuates.
- No dynamic text should drop below 14px (FHD equivalent) to remain compliant with 3-meter distance legibility guidelines.

## Layout & Spacing

The layout is built on a fixed 16:9 canvas using an overscan-safe grid designed specifically for TV displays.

- **Title & Action Safe Zones:** Canvas outer margin is pinned to `3.5rem` (56px in standard UHD viewport space), ensuring all interactive widgets, channel columns, and overlay HUD elements stay safely inside the 95% action-safe screen boundary.
- **Focus Grid:** The standard horizontal carousel layout utilizes a `1.5rem` gutter between media cards, ensuring that neighboring elements do not visually collide when a focused card scales up to 108%–112%.
- **Overscan Adaptation:** For older panels or projection systems with edge-clip behaviors, the margin expands to `4.5rem`. Fixed viewport scaling handles FHD (`1920x1080`) to 4K (`3840x2160`) resolution maps without responsive layout destruction.

## Elevation & Depth

Visual hierarchy on a 10-foot TV canvas relies on luminance contrast, physical scale transforms, and light-emitting halos rather than traditional downward drop shadows.

- **Ground (Z0):** Direct full-screen video stream decoding layer or `#06070a` deep space backdrop.
- **Surface Level (Z1):** Transparent frosted slate cards with `background: rgba(19, 23, 34, 0.72)`, backed by `backdrop-filter: blur(24px)` and framed with `1px solid rgba(255, 255, 255, 0.08)`.
- **Overlay HUD / Rails (Z2):** Translucent command docks, EPG timelines, and player controllers with `background: rgba(10, 11, 16, 0.88)` and `backdrop-filter: blur(40px)`.
- **Focus Elevation (Z3):** When navigated via D-pad or pointer, the focused node scales up to `scale(1.08)`. It triggers a vibrant outer projection ring: `0 0 0 3px #00d2ff, 0 8px 32px rgba(0, 210, 255, 0.45)`.
- **Pointer Hover (Magic Remote):** Subtle targeted glow before selection confirmation: `box-shadow: 0 0 16px rgba(0, 210, 255, 0.25)`.

## Shapes

A balanced geometry provides a sleek architectural feel without becoming bulbous or hyper-casual.

- **Standard Elements:** Media thumbnails, channel icons, and setting containers use a base corner radius of `0.5rem` (8px).
- **HUD Shells & Overlays:** The master player controls, volume indicators, and EPG modal sheets use `1rem` (16px) for smooth containment.
- **Micro Badges & Chips:** Technical codec tags, remote color indicators, and category tabs use an internal radius of `0.25rem` to maintain dense, crisp bounds.

## Components

### 1. Focus Ring & D-Pad Target State
Every interactive element must support three clear states: Unfocused, Focused (D-pad lock), and Hover (Magic Remote pointer hover).
- **Unfocused:** Subtle border `1px solid rgba(255, 255, 255, 0.1)`.
- **Hover:** Translucent outline `1px solid rgba(0, 210, 255, 0.5)`.
- **Focused:** Scale transform `scale(1.08)` on cards (or `scale(1.04)` on wide channel strips), high-contrast active ring `3px solid #00d2ff`, and an ambient radial glow `0 0 30px rgba(0, 210, 255, 0.5)`.

### 2. Media Cards & Posters
- **Dimensions:** Standard 16:9 landscape cards (`320px x 180px`) and 2:3 vertical posters (`200px x 300px`).
- **Surface:** Image container with a dark vertical gradient overlay from `rgba(0, 0, 0, 0)` to `rgba(10, 11, 16, 0.95)` at the bottom third.
- **Focused Card Header:** On focus, cards un-hide extended title metadata, streaming resolution tags, and current program progress.

### 3. Metadata Badges
- **Style:** Compact pill-box tags built with `label-tech` typography.
- **Appearance:** `background: rgba(255, 255, 255, 0.12)`, `border: 1px solid rgba(255, 255, 255, 0.2)`, `color: #ffffff`.
- **Variants:**
  - `4K UHD` / `HDR10` / `DOLBY VISION`: Neutral glass badge.
  - `LIVE`: Background `#ff2a6d` with white text and a pulsing live indicator dot.
  - `HLS` / `60 FPS` / `5.1`: JetBrains Mono tag with `letter-spacing: 0.06em`.

### 4. TV Player Overlay HUD
- **Bottom Control Dock:** Frosted glass slab (`rgba(10, 11, 16, 0.88)` with `backdrop-filter: blur(32px)`). Spans horizontally across the safe area.
- **Scrubber Bar:** Track height 6px (unfocused), expands to 12px when selected. Unplayed buffer track in `rgba(255, 255, 255, 0.2)`, loaded network buffer in `rgba(0, 210, 255, 0.35)`, and active playhead in `#00d2ff` with a glowing indicator.
- **Quick Action Buttons:** Large circle icon actions (minimum touch/focus footprint of `56px x 56px`) with centered iconography.

### 5. EPG (Electronic Program Guide) Channel Strip
- **Row Architecture:** Vertical list of channels on the left column (fixed width `260px`), with horizontally scrolling time-block slots on the right.
- **Time Slots:** Dynamic width proportional to program duration (30 min = `200px`).
- **Current Program Highlighting:** Active playing time slot features a left-side `#ff2a6d` or `#00d2ff` accent line with live elapsed time fill.

### 6. Buffer & Bitrate Telemetry Monitor
- **Placement:** Top-right or bottom-left corner of the stream diagnostics panel.
- **Visuals:** JetBrains Mono typography, mini sparkline stream graph (render height `24px`), colored status pills:
  - Green (`#05ffa1`) for healthy buffer (>15s, 0 frame drops).
  - Amber (`#ffcc00`) for buffer fluctuations (<5s).
  - Red (`#ff3b30`) for underflow/stalling.

### 7. TV Remote Shortcut Key Legend
- **Placement:** Docked horizontally at the screen bottom margin.
- **Format:** Circular color dot (`14px x 14px`) paired with a concise action label in `label-shortcut`:
  - `[Red]` Filter / Categories
  - `[Green]` Audio Track / Subtitles
  - `[Yellow]` Favorite Channel
  - `[Blue]` Quick Stream Diagnostics