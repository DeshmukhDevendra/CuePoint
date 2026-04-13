# CuePoint

Realtime timing and cueing platform for live events, conferences, broadcasts, and productions.

## Stack

- **Frontend:** React 18 + Vite + TypeScript + Tailwind + shadcn/ui
- **Backend:** Node 20 + Express + Socket.IO + Lucia Auth
- **Database:** PostgreSQL 16 + Prisma
- **Cache / PubSub:** Redis
- **Storage:** S3-compatible (MinIO for local dev)
- **Monorepo:** pnpm workspaces + Turborepo

## Prerequisites

- [Node.js 20+](https://nodejs.org/) (use `nvm use` to match `.nvmrc`)
- [pnpm 9+](https://pnpm.io/installation)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Start infra (Postgres, Redis, MinIO)
docker compose up -d

# 3. Copy env files
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp packages/db/.env.example packages/db/.env

# 4. Run DB migrations + seed
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# 5. Start dev servers (API + web in parallel)
pnpm dev
```

Open:
- Web: http://localhost:5173
- API: http://localhost:4000
- MinIO console: http://localhost:9001 (user: `cuepoint`, pass: `cuepoint_dev_secret`)

## Monorepo Layout

```
cuepoint/
├── apps/
│   ├── api/              # Express + Socket.IO server
│   ├── web/              # React frontend
│   ├── desktop/          # Tauri wrapper (Phase 9)
│   └── companion-module/ # Bitfocus Companion module (Phase 6)
├── packages/
│   ├── shared/           # Zod schemas, TS types, utils (shared FE/BE)
│   ├── ui/               # shadcn/ui component library
│   ├── output-elements/  # Timer, Message, ProgressBar components
│   ├── api-client/       # Typed HTTP + Socket.IO client
│   ├── db/               # Prisma schema + migrations + seed
│   └── i18n/             # Translation JSON files
├── tooling/
│   ├── tsconfig/         # Shared TypeScript configs
│   └── eslint-config/    # Shared ESLint configs
└── docker-compose.yml    # Postgres + Redis + MinIO
```

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start all apps in dev mode |
| `pnpm build` | Build all apps and packages |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | Type-check all packages |
| `pnpm test` | Run all tests |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:studio` | Open Prisma Studio |

## Documentation

- `PLAN.md` (at repo parent) — Full implementation plan
- `docs/` — Architecture, API reference, and guides (coming soon)

## License

Proprietary — all rights reserved.
