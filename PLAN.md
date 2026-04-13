# Stagetimer Clone — Implementation Plan

**Project:** Solo build, full feature parity with Stagetimer + 6 enhancements
**Stack:** React + TypeScript + Node/Express + PostgreSQL + Socket.IO
**Deployment:** Self-hosted SaaS + Tauri desktop app

---

## 1. Tech Stack (Final Decisions)

### Frontend
| Layer | Choice | Why |
|---|---|---|
| Framework | **React 18 + Vite + TypeScript** | Fast HMR |
| Routing | **TanStack Router** | Type-safe |
| State | **Zustand** (client) + **TanStack Query** (server) | Simple, minimal boilerplate |
| Styling | **Tailwind CSS + shadcn/ui** | Dark mode built-in |
| Drag-drop | **dnd-kit** + **react-rnd** | Custom Outputs editor + timer reordering |
| Forms | **React Hook Form + Zod** | Type-safe validation shared with backend |
| i18n | **i18next + react-i18next** | Standard, lazy-load bundles |
| Realtime | **socket.io-client** | Matches backend |
| Charts | **Recharts** | Analytics dashboard |

### Backend
| Layer | Choice | Why |
|---|---|---|
| Runtime | **Node.js 20 + TypeScript** | |
| Framework | **Express** | As requested |
| Realtime | **Socket.IO** | Open-source, mature, rooms built-in |
| ORM | **Prisma** | Type generation, migrations |
| DB | **PostgreSQL 16** | As requested |
| Cache/PubSub | **Redis** | Socket.IO adapter, rate limiting |
| Auth | **Lucia Auth** + **Argon2** | Modern, session-based |
| Validation | **Zod** | Shared with frontend |
| Queue | **BullMQ** | Scheduled timers, webhooks |
| File storage | **S3-compatible** (MinIO local, R2 prod) | Logos, fonts, images |

### Desktop
| Layer | Choice | Why |
|---|---|---|
| Shell | **Tauri 2.0** | ~10× smaller than Electron |
| NDI | **Grandiose** (Node) → Rust later | Start simple |

### Infra / DevOps
- **Monorepo:** pnpm workspaces + Turborepo
- **Hosting:** Railway or Fly.io + Cloudflare Pages + Cloudflare R2
- **CI/CD:** GitHub Actions
- **Error tracking:** Sentry
- **Logs:** Pino + Better Stack

---

## 2. Monorepo Structure

```
stagetimer-clone/
├── apps/
│   ├── web/              # React app (Controller, Viewer, all outputs)
│   ├── api/              # Express + Socket.IO server
│   ├── desktop/          # Tauri wrapper
│   └── companion-module/ # Bitfocus Companion module
├── packages/
│   ├── shared/           # Zod schemas, TS types, time utils
│   ├── ui/               # shadcn/ui components
│   ├── output-elements/  # Timer, Message, ProgressBar, etc.
│   ├── api-client/       # Typed HTTP + Socket.IO client
│   ├── db/               # Prisma schema + migrations + seed
│   └── i18n/             # Translation JSON files
├── tooling/
│   ├── eslint-config/
│   └── tsconfig/
└── docker-compose.yml    # Postgres + Redis + MinIO
```

**Key insight:** The `output-elements` package is the cornerstone. Every element is a React component that takes a `config` prop. The Viewer renders them from layout JSON. The Custom Outputs editor renders the *same components* inside a draggable grid.

---

## 3. Data Model (Prisma Schema Sketch)

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String
  name          String?
  locale        String   @default("en")
  theme         String   @default("system")
  createdAt     DateTime @default(now())
  teams         TeamMember[]
  ownedRooms    Room[]
  sessions      Session[]
}

model Team {
  id          String   @id @default(cuid())
  name        String
  plan        Plan     @default(FREE)
  apiKey      String   @unique
  members     TeamMember[]
  rooms       Room[]
}

enum Plan { FREE PRO PREMIUM }

model TeamMember {
  id      String   @id @default(cuid())
  userId  String
  teamId  String
  role    String
  user    User     @relation(fields: [userId], references: [id])
  team    Team     @relation(fields: [teamId], references: [id])
  @@unique([userId, teamId])
}

model Room {
  id            String   @id @default(cuid())
  title         String
  timezone      String   @default("UTC")
  ownerId       String?
  teamId        String?
  settings      Json
  apiKey        String   @unique
  onAir         Boolean  @default(false)
  blackout      Boolean  @default(false)
  createdAt     DateTime @default(now())
  deletedAt     DateTime?
  timers        Timer[]
  messages      Message[]
  labels        Label[]
  outputs       Output[]
  logs          Log[]
  submitConfig  SubmitQuestionConfig?
  analytics     AnalyticsEvent[]
}

model Timer {
  id            String   @id @default(cuid())
  roomId        String
  order         Int
  title         String?
  speaker       String?
  notes         String?
  durationMs    Int
  displayMs     Int?
  startTime     DateTime?
  triggerType   String   // manual | linked | scheduled
  appearance    String   // countdown | count_up | tod | cd_tod | cu_tod | hidden
  wrapupYellowMs Int?
  wrapupRedMs   Int?
  wrapupFlash   Boolean  @default(false)
  wrapupChime   String?
  labelIds      String[]
  isRunning     Boolean  @default(false)
  startedAt     DateTime?
  pausedAt      DateTime?
  elapsedMs     Int      @default(0)
  room          Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
  @@index([roomId, order])
}

model Message {
  id        String   @id @default(cuid())
  roomId    String
  text      String
  color     String   @default("white")
  bold      Boolean  @default(false)
  uppercase Boolean  @default(false)
  flash     Boolean  @default(false)
  focus     Boolean  @default(false)
  visible   Boolean  @default(false)
  order     Int
  source    String   @default("manual")
  authorName String?
  room      Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
}

model Label {
  id      String @id @default(cuid())
  roomId  String
  name    String
  color   String
  room    Room   @relation(fields: [roomId], references: [id], onDelete: Cascade)
}

model Output {
  id           String  @id @default(cuid())
  roomId       String
  name         String
  type         String
  layout       Json
  passwordHash String?
  logoMode     String  @default("default")
  logoUrl      String?
  room         Room    @relation(fields: [roomId], references: [id], onDelete: Cascade)
  links        OutputLink[]
}

model OutputLink {
  id         String  @id @default(cuid())
  outputId   String
  signature  String  @unique
  options    Json
  shortCode  String? @unique
  expiresAt  DateTime?
  output     Output  @relation(fields: [outputId], references: [id], onDelete: Cascade)
}

model Log {
  id        String   @id @default(cuid())
  roomId    String
  actorId   String?
  action    String
  metadata  Json?
  createdAt DateTime @default(now())
  room      Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
  @@index([roomId, createdAt])
}

model AnalyticsEvent {
  id        String   @id @default(cuid())
  roomId    String
  eventType String
  timerId   String?
  durationMs Int?
  overUnderMs Int?
  createdAt DateTime @default(now())
  room      Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
  @@index([roomId, createdAt])
}

model SubmitQuestionConfig {
  roomId        String  @id
  enabled       Boolean @default(true)
  closedMessage String?
  logoUrl       String?
  title         String?
  subtitle      String?
  questionLabel String?
  nameLabel     String?
  hideName      Boolean @default(false)
  room          Room    @relation(fields: [roomId], references: [id], onDelete: Cascade)
}

model Session {
  id        String   @id
  userId    String
  expiresAt DateTime
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

---

## 4. Realtime Architecture

**Principle:** Never broadcast clock ticks. Broadcast *events* (start, stop, adjust), clients compute `remaining = (startedAt + duration) - now()` locally. This is how Stagetimer achieves 2–3 MB per show.

**Socket.IO rooms:**
- `room:{roomId}` — all connected clients
- `room:{roomId}:controller` — only controller-level clients
- `room:{roomId}:viewer` — viewer outputs

**Events:**
```
// Server → Client
room:state              // full snapshot on connect/reconnect
timer:updated
timer:started           // { timerId, startedAt, durationMs }
timer:stopped
timer:reset
timer:adjusted          // { timerId, deltaMs }
message:created/updated/deleted/shown/hidden
output:updated
room:blackout
room:flash
room:on_air
connection:joined
connection:left
cursor:moved            // collaborative cursors

// Client → Server
timer:start
timer:stop
timer:adjust
...
```

**Cuepoint v1 note:** Message-level show/hide/flash exists on messages. A dedicated **room-level** `room:flash` pulse (event + controller control + viewer-wide behavior) is **not implemented** and is **explicitly out of scope for v1**; keep as backlog if parity is needed later.

**Clock sync:** Client measures offset between `Date.now()` and server timestamp on ping, applies correction locally.

**Scheduled timers:** BullMQ delayed jobs. On execution, emit `timer:started` via Socket.IO Redis adapter.

---

## 5. Security Model

- **Output link signatures:** HMAC-SHA256 of `(outputId + options)` with per-room secret
- **Short links:** Random 7-char code, 30-day TTL via cron
- **Passwords:** Argon2, rate-limited per IP
- **API keys:** Per-room + per-team, stored hashed
- **Anonymous rooms:** Allowed, claimable on signup
- **CORS + CSP:** Strict; Viewer allowed in iframes

---

## 6. Custom Outputs Editor

1. **Grid system:** CSS grid + absolute-positioned elements. `dnd-kit` for drag-reorder, `react-rnd` for resize
2. **Element schema:**
   ```ts
   {
     id: 'el_abc',
     type: 'timer' | 'message' | 'progress_bar' | ...,
     x, y, w, h,
     settings: { /* per-type */ },
     zIndex
   }
   ```
3. **Renderer:** Single `<OutputRenderer layout={layout} />` used by Viewer, editor preview, and public link
4. **Editor state:** Zustand with undo/redo history
5. **Aspect ratio lock:** CSS `aspect-ratio` with letterboxing fallback
6. **Fonts:** Upload to S3, inject `@font-face` at runtime
7. **Backgrounds:** Color/image/transparent

---

## 7. NDI Output (Desktop App)

**Start:** Tauri + Node sidecar + Puppeteer + Grandiose.
**Later:** Rust sidecar with `ndi` crate + Rust headless browser.

**Flow:**
1. Tauri launches embedded Node server
2. Per open controller, spawn headless Chromium rendering each Viewer output
3. Capture frames at 30fps
4. Feed to NDI sender with `HOSTNAME (Stagetimer - Room - Output)` naming
5. mDNS auto-advertise via NDI SDK

---

## 8. Implementation Phases

### Phase 0 — Foundation (2 weeks)
- Monorepo + Turborepo + pnpm
- Prisma schema + migrations + seed
- Docker Compose (Postgres, Redis, MinIO)
- Auth: signup, login, sessions (Lucia)
- Express API skeleton + Socket.IO
- Vite React app with Tailwind, shadcn/ui, dark mode
- **Enhancement #1: Dark/light theme switcher**
- GitHub Actions CI
- Deploy staging

### Phase 1 — Core MVP Loop (3 weeks)
- Room CRUD (anonymous + authenticated)
- Timer CRUD + drag-reorder
- Transport controls
- Realtime sync (Socket.IO, clock offset calc)
- Viewer output (fullscreen countdown)
- Controller page
- **Demo:** two browsers controlling/viewing same room

### Phase 2 — Messages + 5 Role Outputs (2 weeks)
- Message CRUD + show/hide/flash/focus
- Placeholders
- Submit Questions public form
- Agenda output
- Moderator output
- Operator output (numpad, large buttons)

### Phase 3 — Output Links System (1.5 weeks)
- Output Links popup
- HMAC signatures, password protection
- Short links + QR codes
- Link options (mirror, delay, timezone, hide controls, identifier)
- Live Connections tracking
- Blackout + Flash + On Air

### Phase 4 — Custom Outputs Editor (4 weeks)
- `output-elements` package with **14 element types** *(Cuepoint: timer, message_strip, label, progress_bar, wall_clock, room_title, timer_title_only, timer_digits_only, divider, image, messages_ticker, agenda, lower_third, qrcode)*
- Drag-drop/resize editor, undo/redo
- Per-element settings panels
- Aspect ratios; **CSS background** + **background image** + **layout blackout mode** (fullscreen / dim / none on CUSTOM link)
- **Custom fonts:** `fontFamily` + optional **`fontCssUrl`** (hosted stylesheet with `@font-face`; no first-party S3 upload pipeline)
- Logo management (`logoUrl` / `logoMode`)
- **Import layout:** same-room (controller) + **cross-room** for **signed-in owner** of both rooms (`POST .../import-layout-remote`)

### Phase 5 — Timer Advanced Features (1.5 weeks)
- Wrap-up times + chimes + flashing
- Time Warp
- Until Finish Time
- Linked timers
- Scheduled timers (BullMQ)
- Breaks & overlap resolver
- Labels
- CSV import/export
- Room Settings
- Logs viewer

### Phase 6 — API + Companion Module (2 weeks)
- HTTP API matching Stagetimer's shape
- Socket.IO external endpoint
- Rate limiting
- API playground
- Companion module
- **Enhancement #3: Slack/Discord webhooks**

### Phase 7 — Teams + Collaboration (2 weeks)
- Teams, roles, invitations
- Team dashboard, room transfer
- Team-level API keys
- **Enhancement #6: Collaborative cursors**
- Presence indicators

### Phase 8 — Enhancements Push (2 weeks)
- **Enhancement #2: AI-generated rundowns** (Claude API with structured output)
- **Enhancement #4: i18n** (English + Spanish + German + French + Portuguese)
- **Enhancement #5: Analytics dashboard per event**

### Phase 9 — Desktop App (3 weeks)
- Tauri 2.0 shell
- Node.js sidecar with stripped Express server
- Local SQLite via Prisma
- License key system
- LAN IP detection
- JSON export/import
- Win/Mac/Linux installers + auto-update

### Phase 10 — NDI Output (2 weeks)
- Grandiose + Puppeteer frame capture
- Per-output NDI source
- Alpha channel passthrough
- Live Connection counting

### Phase 11 — Polish + Launch (2 weeks)
- Billing (Stripe) + plan enforcement
- Landing page, docs site
- E2E tests (Playwright)
- A11y pass
- Performance profiling
- Public beta

**Total:** ~27 weeks (~6 months) solo full-time.

---

## 9. Risk Register

| Risk | Mitigation |
|---|---|
| Custom Outputs editor creep | Timebox 4 weeks; ship v1 with fewer settings |
| NDI complexity | Grandiose first, Rust later |
| Realtime sync bugs | Strict event sourcing; full snapshot on reconnect; integration tests |
| Desktop licensing | Web-only first, desktop Phase 9 |
| Scope explosion | Cut NDI, Companion, teams, cursors first |

---

## 10. Cut List (if time-constrained)

Cut in this order:
1. NDI output
2. Desktop app
3. Companion module
4. Teams
5. Custom Outputs editor (ship with 5 fixed layouts)
6. Collaborative cursors
7. Analytics dashboard

**Keep no matter what:** Timers, Messages, Viewer, Controller, Agenda, Moderator, Operator, Output Links, Realtime sync, Auth, Dark mode, i18n, AI rundown generator.
