# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start both frontend (Vite) and backend (Express) concurrently
npm run dev

# Start only frontend
npm run dev:web

# Start only backend (with hot reload via --watch)
npm run dev:api

# Build frontend for production
npm run build

# Lint
npm run lint

# Start PostgreSQL via Docker
docker compose up -d
```

## Environment Setup

Copy `.env.example` to `.env` and fill in values:
- `DATABASE_URL` — PostgreSQL connection string (default DB: `hello_world`, user: `hello`, password: `hello` via docker-compose)
- `PORT` — Express API port (default: `5174`)
- `VITE_API_BASE_URL` — Frontend base URL for API calls (default: `http://localhost:5174`)

Initialize the database before first use — run the baseline, then any migrations in order:

```bash
psql -d <db> -f server/schema.sql               # consolidated baseline (up to 2026-06-12)
# then each server/migrations/*.sql in numeric order, if any exist
```

`server/schema.sql` is the **consolidated baseline** — the full schema (all tables,
indexes, constraints) as of 2026-06-12, generated via `pg_dump --schema-only`. The
original 41 incremental migrations were folded into it and removed.

**Schema changes from now on** go back to incremental files: add a new numbered file
`server/migrations/NNN_short_name.sql` (continue numbering from `041`) containing the
ALTER/CREATE, and apply it by hand via `psql` to both the local DB and the running VPS
DB. Do NOT re-run the full `schema.sql` against a live DB — it has plain `CREATE TABLE`
and will fail on existing tables. When migration files pile up, re-consolidate: re-dump
`schema.sql` from an up-to-date DB and delete the migration files.

## Architecture

This is a full-stack app with a React/Vite frontend and an Express/Node.js backend sharing a single `package.json`. The frontend is served by Vite dev server; the backend is a separate Express process.

**Frontend (`src/`)** — single-page app with no router library. Navigation is managed by `currentPage` and `activeMenu` state in `App.jsx`, which acts as the root controller for all page rendering. Pages: Home, Contracts (list + detail), Admin (users, customers, departments, positions). Auth state (logged-in user) is persisted via `localStorage` (userId only; user data is re-fetched on load).

**Backend (`server/`)** — Express 5 REST API:
- `server/index.js` — entry point; mounts `/api` routes, serves `/uploads` for file attachments
- `server/routes/index.js` — aggregates all sub-routers (auth, customers, contracts, documents)
- `server/db.js` — single shared `pg.Pool` instance using `DATABASE_URL`
- `server/controllers/` — business logic per domain (auth, customer, contract, document)
- Uploaded files are stored at `server/uploads/` and served statically

**Database** — PostgreSQL. Key tables: `app_user`, `customer`, `contract_out`, `contract_out_member`, `document_folder`, `document_file`. Earlier a trigger on `contract_out` (`trg_create_default_folders`) auto-created a default folder tree on insert; it was **removed** — new contracts now start with an empty folder tree and users create folders manually.

**Auth** — email+password login using `bcryptjs`. On login the server issues an **HMAC-signed session token** (`server/auth/token.js`, no external JWT lib) stored in an **httpOnly cookie** (`tecapro_auth`). Every API request is gated server-side by `requireAuth` (`server/middleware/auth.js`), which verifies the cookie and sets `req.user = { id, role }`. **Authorization must always derive identity from `req.user`, never from client-supplied `userId`/query params.** Public routes are only `/api/auth/login`, `/api/auth/logout`, `/api/health`; everything else (mounted after `router.use(requireAuth)` in `server/routes/index.js`) requires a valid session. Admin-only ops use `requireAdmin`; self-or-admin uses `requireSelfOrAdmin`. Role is an integer (`role == 1` = admin). Frontend restores the session via `/api/auth/me` (no id sent); a global `fetch` wrapper (`src/config/fetchSetup.js`) adds `credentials: 'include'` to every request. Requires env `AUTH_SECRET`; set `NODE_ENV=production` on the VPS to enable Secure cookies. The `/uploads` static mount is also behind `requireAuth` (contract documents are served via `/api/files/:id/view`; `/uploads` mainly serves task attachments, linked relatively so the session cookie rides along same-origin in production).

**Styling** — Tailwind CSS + custom CSS (`App.css`, `src/index.css`). No component library.

## Currency / Value Convention

BOQ amounts (`contract_out_boq.unit_price`, `amount_before_vat`, `amount_after_vat`) and the synced contract total (`contract_out.amount_after_vat`) are stored in the **contract's own currency** (nguyên tệ, e.g. USD) — **not** VND. The contract's `currency_code` + `exchange_rate` describe how to convert that native value to VND for display only.

Consequently, the Receivable tab (`ContractReceivableTab`, `ReceivableScheduleSection`, `LinkedPaymentsRow`) must do **all** calculations on the native `amount` values — totals, "% theo HĐ" (`amount / refTotal × 100`), tỷ lệ thu, and the Phải thu/Đã thu/Còn thiếu comparison. The "Quy đổi VNĐ" column (`amount_vnd = amount × exchange_rate`) is a display-only derived value; never drive aggregations or ratios off it.

## User Guide Sync Rule

The app has an in-app user guide (❓ icon in the Header → `HelpPanel`), with content in
`src/components/help/topics/*` aggregated by `src/components/help/helpTopics.js`
(`HELP_GROUPS`: group = module area → page = one screen/tab → sections). Groups/pages
carry `perm` (layer-A permission) so users only see guides for modules they can access.

**Whenever a change touches the UI or a user-facing flow** (new page/tab/button, renamed
labels, changed steps, changed permissions, removed features), update the matching guide
content in the same task — grep the old label under `src/components/help/` to find stale
text. New module → new group in `HELP_GROUPS`. Writing style: step-by-step for complete
beginners, in Vietnamese; for read-only pages explain what each column/number means.

The ❓ button is context-aware: `src/components/help/helpContext.js` maps the current
route/tab (URL path + `?tab=`/`?inTab=`, home-dashboard key, `accounting_tab` in
localStorage) to a guide page id, so the panel opens scrolled to the current screen's
guide. When adding a page/tab or changing a route, update that map too.

## File Size Rule

**Any file that exceeds 500 lines must be split.** When writing or editing code causes a file to cross this threshold, proactively break it up before finishing the task. Splitting strategies:
- React components: extract sub-components, custom hooks (`useXxx`), or utility functions to separate files
- Backend controllers: extract helper functions or sub-controllers by concern
- Shared utilities: move formatting/calculation functions to a `utils.js` or `constants.js` sibling file
