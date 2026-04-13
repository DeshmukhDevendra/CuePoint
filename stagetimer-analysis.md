# Stagetimer — Complete Application Analysis

## What It Is

Stagetimer is a **cloud-based countdown timer platform** built for live events, conferences, broadcasts, and productions. The core concept: one person controls timers remotely from a laptop/tablet, while presenters see a fullscreen countdown on a separate screen. It works entirely in a browser — no app installs required. All devices stay in sync via WebSocket, using only ~2–3 MB of data for an entire show.

---

## Core Concepts

### 1. Timers

The heart of the platform. Each timer represents one event segment.

**Key properties per timer:**
- Title, speaker name, internal notes, colored labels (e.g. VT, GFX, CAM)
- Duration type: Fixed duration / Until Finish Time / **Time Warp** (display ≠ actual time — useful to speed a presenter up without them knowing)
- Appearance: Countdown / Count-Up / Time of Day / combinations / Hidden
- Trigger: Manual / Linked (auto-starts when previous ends) / Scheduled (server-side, starts even without controller open)
- Start times: Hard (user-set, white) vs. Soft (auto-calculated, gray) — used to show Over/Under time

**Import:** CSV from Google Sheets or Excel — auto-detects columns, supports zero-duration headers/notes

**Wrap-up times:** Green → Yellow → Red progress bar segments; configurable chimes and flashing per threshold

**Breaks & conflicts:** Visual gap/conflict indicators between scheduled timers with a **Resolve** dropdown (extend, shift, shrink)

**Bulk actions:** Select mode with Shift+click, Cmd+A, delete, duplicate, move, link/unlink, fix times

---

### 2. Messages

Real-time text sent from controller to all Viewer screens.

- Appear alongside (and shrink) the timer on Viewer
- One message visible at a time — stays until manually hidden
- Formatting: White / Green / Red color, Bold, Uppercase, Flash, Focus (fullscreen overlay)
- **Placeholders:** Dynamic variables like `$CURRENT_TITLE`, `$NEXT_SPEAKER`, `$CURRENT_DURATION`, `$NEXT_START`, `$CURRENT_LABELS`, etc. — for reusable message templates
- Free plan: 3 messages max; Pro/Premium: unlimited

---

### 3. Output Links

The system for sharing different views of the same room.

**Default outputs:**

| Output | Who It's For | What They Can Do |
|---|---|---|
| **Controller** | Full production staff | View + edit everything — timers, messages |
| **Operator** | Show callers / tech directors | Simplified large-button interface, timer control only |
| **Viewer** | Presenters / confidence monitors | See active timer, messages, progress bar |
| **Agenda** | Staff + audience | View full rundown, highlights active item |
| **Moderator** | Stage managers / Q&A handlers | View timers + full message control, no timer editing |

**Link options:** Password protection, device identifier, mirror (teleprompter), delay, timezone override, hide controls overlay

**Short links:** `stagetimer.io/o/abc123` — easier for QR codes and manual entry; expires after 30 days

**Security:** All links use tamper-proof cryptographic signatures; URL parameters cannot be manually modified

**Live Connections:** Real-time view of all connected devices, grouped by output; can rename, identify (flash screen), force-reload, or disconnect

**Picture-in-Picture:** Any output can be popped into a floating always-on-top window (Chrome/Edge/Firefox 151+)

---

## Interface Breakdown

### Controller

The main production interface. 12 key sections:

1. Room title
2. Output Links button
3. Timer preview (what talent sees)
4. **Transport controls** — play/pause/stop/reset/next/previous, ±1m adjustments, timeline scrubbing, **On Air toggle**
5. Live Connections counter
6. Timer list with drag-and-drop reordering
7. Select mode & bulk actions
8. **Blackout** (hides all viewer outputs) and **Flash** buttons
9. Room Menu (Settings, API, Logs, CSV Import/Export, Shortcuts, Ownership)
10. User Menu
11. Messages panel + Submit Questions link
12. Room Progress bar (total time elapsed / remaining)

### Operator

Tablet-optimized interface. Shows previous/current/next timer cards. Large START/STOP buttons. Numpad for precise time entry in HHMMSS format. Modes: SET TO / JUMP / ADD / SUBTRACT. Includes Blackout and Flash. Designed for show callers who need speed under pressure.

### Viewer

Fullscreen confidence monitor. Shows: active timer, messages, title, speaker, progress bar with wrap-up colors. Works as broadcast overlay in OBS/vMix. Overlay controls (toggleable): sound, mirror, fullscreen. Handles connection drops gracefully — timers keep counting locally.

### Agenda

Dynamic schedule view. Shows all timers with times, durations, titles, speakers. Auto-scrolls to highlight active timer. Useful for lobby displays, staff rundown screens, and audience-facing schedules.

### Moderator

Combines a timer view + full message controls + agenda view. For event moderators managing Q&A or audience interaction without needing timer control. Typical workflow: collect questions via Submit Questions link → screen them → display to presenter.

---

## Customization System

### Custom Outputs (Premium)

Drag-and-drop visual editor for any output except Controller/Operator.

**Output settings:**
- Aspect ratio: 16:9, 21:9, 1:1, portrait/landscape, custom (e.g. 32:9)
- Background: solid color / image / **transparent** (for overlays)
- Blackout appearance: custom color / image / time of day / use background
- Custom fonts (TTF/OTF/WOFF upload)

**Available elements (14 types):**

| Category | Elements |
|---|---|
| Timer & Time | Timer, Time of Day, Timer+Message Combo |
| Messages & Text | Message, Text (with placeholders) |
| Progress | Progress Bar, Progress Ring |
| Status | On Air indicator |
| Interactive | Transport Control, Agenda, Moderator |
| Media | Image, Iframe, QR Code |

**Settings hierarchy:** Room Settings → Link Options → Element Settings (highest priority)

---

## Advanced Features

### Submit Questions

Built-in audience Q&A system. No third-party tools needed.

- Generates a shareable link + QR code for audience
- Questions appear as messages in the controller/moderator queue
- Moderator can review, edit, color-code, show, or delete
- Premium: customize the submission page (logo, title, labels, close submissions with custom message, hide name field)
- QR Code element can be placed directly on output for self-service scanning

### API

RPC-style HTTP GET API (paid plans required).

**Endpoint categories:**
- Playback control: start, stop, reset, next, previous, add/subtract time, jump playhead
- Viewer control: blackout, focus, on-air, flash/stop flash
- Timer CRUD: get all, get one, create, update, delete, select, start/stop specific
- Message CRUD: get all, get one, create, update, delete, show, hide, toggle
- Room info: status, room details, logs, connection test
- Socket.io endpoint for real-time updates

Built-in support for curl; prefills Room ID and API key when accessed via the Room menu.

### Stream Deck & Companion Integration

Requires Pro or Premium plan. Uses Bitfocus Companion (open-source) + Elgato Stream Deck hardware.

**Presets available:**
- Transport: Start/Stop, +5min, +1min, +30s, -5min, -1min, -30s, Previous, Next
- Viewer: Remaining time (full/hours/minutes/seconds), wrap-up indicator, blackout, focus, on-air, flash
- Timer: Reset, start/stop specific timer, create timer
- Message: toggle, show, hide, create

**Variables exposed** (for button labels): `$(stagetimer:timeDisplay)`, `$(stagetimer:currentTimerName)`, `$(stagetimer:nextTimerSpeaker)`, remaining time in ms, labels, start/finish times, etc.

**Feedbacks:** blackout, flashing, on-air, focus, message showing, playback running, wrap-up state

**Multi-room support:** Switch rooms dynamically with team API key, or set up multiple Companion connections

---

## Desktop App

Available for Windows, Mac (Intel + Apple Silicon), Ubuntu/Debian Linux (x64 + arm64).

**Key capabilities:**
- Fully offline — runs a local web server, other devices connect via LAN IP
- **NDI® output:** Sends timer displays as NDI video sources to vMix, OBS (via DistroAV), Resolume, etc. — with alpha channel support for transparent overlays
- NDI source naming: `HOSTNAME (Stagetimer - Room Name - Output Name)`
- JSON export/import for data transfer between web and desktop versions
- License keys transferable between machines (one active at a time)
- MSI installer available for enterprise/fleet deployment (SCCM, Intune, Group Policy)
- Same features as web version; each paid plan includes a desktop license key at no extra cost

---

## Platform Integrations (Guides)

### Display on a Screen

Options ranked by complexity:

1. **HDMI cable** — simplest, zero latency
2. **SDI** — up to 100m+ cable runs, industry-standard for live events
3. **NDI** — over existing network infrastructure, multi-screen
4. **Tablet/Phone** — iPad (Safari only for fullscreen), Android Chrome
5. **Smart TV browser** — Samsung Tizen / LG webOS work best
6. **Apple TV / AirPlay** — treat as extended display from Mac
7. **Chromecast** — cast a Chrome tab (~0.5–1s latency)
8. **Fire TV Stick** — ~$30–60, dedicated portable display via Silk browser
9. **Raspberry Pi** — dedicated display, kiosk mode, works offline with desktop app

### OBS Studio

Add Viewer as a Browser Source (1280×720). Three transparency methods:
- Additive blending mode (free)
- Color Key filter (free)
- Transparent background (Premium)

Isolate individual elements (timer-only, message-only) via Custom Outputs. NDI input via DistroAV plugin. Audio chimes: enable "Control audio via OBS."

### vMix

Add as Web Browser input (1920×1080). Route to external outputs for confidence monitors. Built-in NDI support — no plugins needed. API control from vMix scripting. Transparent overlays via NDI with Premium.

### ATEM Switchers

Three keying methods:
1. **Chroma key** (purple/green/blue background) — works on all ATEM models
2. **Luma key** — uses brightness, but struggles with colored elements
3. **Transparent background** (Premium) — cleanest, no keying needed

Mask/crop controls on upstream key for timer-only overlays. Downstream Key as alternative to upstream.

### Zoom

Two methods:
1. **Screen share** — simplest, but uses your share slot
2. **Virtual camera via OBS** — timer persists when others share screens, appears as a participant

Alternatives to OBS: ManyCam ($29+/yr, Windows & Mac), eCamm Live ($20/mo, Mac only).

### Amazon Fire TV Stick

Open Silk browser → navigate to short link → enable fullscreen. Fullscreen mode prevents screensaver. Optional: Disable screensaver in Settings for extra safety. Use wall outlet power (not TV USB).

### Raspberry Pi

Two modes: browser (web version) or desktop app (offline server). Kiosk mode via Chromium `--kiosk` flag + autostart scripts. Supports Pi 2 Model B+ and newer. Hide cursor with `unclutter`.

### Embed on Website

Use `<iframe src="VIEWER_URL">`. Short links (30-day expiry) or full signed links (permanent). HTML dashboard examples: 4-timer grid layout, timer + agenda + YouTube livestream. Also: **Dashmaster 2k** (no-code dashboard tool with native Stagetimer module). Reverse: embed external websites *inside* Stagetimer outputs via the Iframe element.

---

## System Requirements

**Web:** Chrome 101+, Firefox 100+, Safari 15.5+, Edge 101+
**Desktop App:** Windows 10+, macOS 11 Big Sur+, Ubuntu/Debian (.deb, x64/arm64)
**Bandwidth:** ~2–3 MB per show (event-based sync, not continuous streaming)
**Latency:** <150ms on typical connections
**Offline resilience:** Timers continue counting locally if connection drops; auto-reconnects

---

## Pricing Tiers

| Feature | Free | Pro | Premium |
|---|---|---|---|
| Timers/messages | 3 max | Unlimited | Unlimited |
| Audience questions | Limited | Unlimited | Unlimited |
| API access | ✗ | ✓ | ✓ |
| Custom logo | ✗ | Hide/custom | Full control |
| Custom outputs | ✗ (view only) | View only | Full editor |
| Transparent backgrounds | ✗ | ✗ | ✓ |
| Wrap-up sounds/flash | ✗ | ✓ | ✓ |
| Password protection | ✗ | ✓ | ✓ |
| Submit Questions branding | ✗ | ✗ | ✓ |
| Desktop app | Basic (free) | License included | License included |
| Custom fonts | ✗ | ✗ | ✓ |

---

## Architecture & Design Philosophy

- **Browser-first, no installs required** — works on any device
- **Role-based outputs** — each link gives only what that role needs to see
- **Offline-capable** — desktop app for restricted/no-internet venues
- **NDI-native** — desktop app integrates directly into professional broadcast pipelines
- **API-first extensibility** — everything controllable via HTTP GET; works with Companion, vMix scripting, Zapier, custom scripts
- **Settings hierarchy** — Room → Link Options → Element (highest), allowing global defaults with per-output and per-element overrides
- **Low-bandwidth design** — syncs timestamps and events, not continuous data streams

---

## Summary

Stagetimer is a well-architected, production-focused timing platform. Its strength is the layered system of role-specific outputs (Controller/Operator/Viewer/Agenda/Moderator), combined with a powerful customization engine (Custom Outputs), deep integrations (OBS, vMix, ATEM, Stream Deck, Zoom), an HTTP API for automation, and an offline desktop app with NDI output. It scales from a simple single-timer setup to complex multi-stage live productions with full broadcast integration.
