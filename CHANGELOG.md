# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).  
Versioning aims to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html) once public releases are tagged.

## [Unreleased]

### Added

- **CI (`/.github/workflows/ci.yml`)** — GitHub Actions workflow on `push` / `pull_request` to `main` and `master`: Postgres 16 service, `pnpm install --frozen-lockfile`, Prisma `generate` + `migrate:deploy`, `pnpm typecheck`, `pnpm test`, Playwright Chromium (`--with-deps`), and `pnpm test:e2e`, with `DATABASE_URL`, `AUTH_SECRET`, and CORS env for the Playwright stack.
- **Custom output layout — 14 element types** (`@cuepoint/shared`, `@cuepoint/output-elements`): `timer`, `message_strip`, `label`, `progress_bar`, `wall_clock`, `room_title`, `timer_title_only`, `timer_digits_only`, `divider`, `image`, `messages_ticker`, `agenda`, `lower_third`, `qrcode` (QR via `qrcode` package).
- **Layout-level options**: longer CSS `background`, optional `backgroundImageUrl` + `backgroundImageFit`, optional `fontCssUrl` (remote stylesheet for `@font-face`), optional `blackoutStyle` (`fullscreen` | `dim` | `none`) for how room blackout appears on CUSTOM output links.
- **`CUSTOM_OUTPUT_ELEMENT_TYPES`**, **`createDefaultLayoutElement()`**, and **`OutputBlackoutStyle`** exports in `@cuepoint/shared`.
- **API — output layout import**: `POST /api/rooms/:roomId/outputs/:outputId/import-layout` (same room, controller), and `POST .../import-layout-remote` (signed-in user must own both source and target rooms).
- **Schemas**: `ImportOutputLayoutRemoteBodySchema`; `UpdateOutputBody` extended with `logoUrl` / `logoMode`; output link create body already supported options — now covered by an integration test.
- **Web — output link options**: collapsible “next new link” options on the controller (`identifier`, `mirror`, `delaySec`, `timezone`, `hideControls`); summary line on existing links; `POST` sends only allowed keys.
- **Web — custom output editor**: add/remove elements by type, shared **`OutputEditorElementInspector`**, layout fields (CSS background, background image, font CSS URL, blackout mode), same-room import dropdown, remote import (owned rooms, session cookie), undo/redo and keyboard shortcuts (existing), drag/resize overlays (existing).
- **Web — CUSTOM viewer**: `ViewerShell` **`blackoutMode`**; `CustomOutputViewer` passes **`layout.blackoutStyle`** so blackout can be full “Stand by”, dim overlay, or disabled for that layout.
- **Public resolve / wires**: output metadata includes `logoUrl` / `logoMode` where applicable for links.
- **`CHANGELOG.md`** (this file).

### Changed

- **`CustomOutputStage`**: refactored to layered backgrounds, optional font stylesheet injection, and delegation to **`CustomOutputElements`**; embedded vs fullscreen behavior preserved.
- **Timer element rendering**: wrap-up phase colors and wrap-up flash behavior aligned with prior fullscreen timer behavior.
- **`OutputEditorPage`**: `import-layout` flow no longer performs a no-op `PATCH` before `POST`; broader layout editing surface as above.
- **`defaultCustomOutputLayout()`**: includes default `blackoutStyle`; default template content remains backward compatible for existing rooms.
- **`../PLAN.md`** (product plan next to the `cuepoint` folder, when present): Phase 4 bullets updated to match shipped behavior; room-level `room:flash` marked **out of scope for v1**; realtime section note for `room:flash` backlog.
- **`packages/shared`**: `background` field max length increased for CSS gradients / rgba strings.

### Removed

- **`docs/POST_TESTS_ROADMAP.md`** — roadmap items folded into shipped work, tests, CI, and this changelog; no remaining references required.

### Fixed

- (None separately tracked — regressions addressed during the above work via `pnpm typecheck`, `pnpm test`, and `pnpm test:e2e`.)

---

### Upgrade / ops notes

- Run **`pnpm db:generate`** and **`pnpm --filter @cuepoint/db migrate:deploy`** in any environment that applies migrations before relying on new API routes.
- **Cross-room layout import** requires a **logged-in** user who **owns** both rooms; guest controller tokens are not sufficient for `import-layout-remote`.
- **Custom fonts**: host a CSS file (e.g. on your CDN) with `@font-face` rules and set **`layout.fontCssUrl`**; there is no first-party font file upload in this release.
