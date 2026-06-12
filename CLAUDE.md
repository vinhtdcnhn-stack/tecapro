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

Run the SQL files to initialize the database schema before first use:
1. `server/schema.sql` — core tables (app_user, customer, contract_out, contract_out_member)
2. `server/migrations/001_document_management.sql` — document_folder and document_file tables + triggers
3. `server/migrations/002_add_is_deleted_to_document_file.sql`
4. `server/migrations/003_add_is_deleted_to_document_folder.sql`

## Architecture

This is a full-stack app with a React/Vite frontend and an Express/Node.js backend sharing a single `package.json`. The frontend is served by Vite dev server; the backend is a separate Express process.

**Frontend (`src/`)** — single-page app with no router library. Navigation is managed by `currentPage` and `activeMenu` state in `App.jsx`, which acts as the root controller for all page rendering. Pages: Home, Contracts (list + detail), Admin (users, customers, departments, positions). Auth state (logged-in user) is persisted via `localStorage` (userId only; user data is re-fetched on load).

**Backend (`server/`)** — Express 5 REST API:
- `server/index.js` — entry point; mounts `/api` routes, serves `/uploads` for file attachments
- `server/routes/index.js` — aggregates all sub-routers (auth, customers, contracts, documents)
- `server/db.js` — single shared `pg.Pool` instance using `DATABASE_URL`
- `server/controllers/` — business logic per domain (auth, customer, contract, document)
- Uploaded files are stored at `server/uploads/` and served statically

**Database** — PostgreSQL. Key tables: `app_user`, `customer`, `contract_out`, `contract_out_member`, `document_folder`, `document_file`. Originally a trigger on `contract_out` (`trg_create_default_folders`) auto-created a default folder tree on insert, but this was **disabled** in migration `034_drop_default_folders_trigger.sql` — new contracts now start with an empty folder tree and users create folders manually. The `create_default_contract_folders()` / `trigger_create_default_folders()` functions are kept so the trigger can be re-enabled if needed.

**Auth** — email+password login using `bcryptjs`. On login the server issues an **HMAC-signed session token** (`server/auth/token.js`, no external JWT lib) stored in an **httpOnly cookie** (`tecapro_auth`). Every API request is gated server-side by `requireAuth` (`server/middleware/auth.js`), which verifies the cookie and sets `req.user = { id, role }`. **Authorization must always derive identity from `req.user`, never from client-supplied `userId`/query params.** Public routes are only `/api/auth/login`, `/api/auth/logout`, `/api/health`; everything else (mounted after `router.use(requireAuth)` in `server/routes/index.js`) requires a valid session. Admin-only ops use `requireAdmin`; self-or-admin uses `requireSelfOrAdmin`. Role is an integer (`role == 1` = admin). Frontend restores the session via `/api/auth/me` (no id sent); a global `fetch` wrapper (`src/config/fetchSetup.js`) adds `credentials: 'include'` to every request. Requires env `AUTH_SECRET`; set `NODE_ENV=production` on the VPS to enable Secure cookies. The `/uploads` static mount is also behind `requireAuth` (contract documents are served via `/api/files/:id/view`; `/uploads` mainly serves task attachments, linked relatively so the session cookie rides along same-origin in production).

**Styling** — Tailwind CSS + custom CSS (`App.css`, `src/index.css`). No component library.

## Currency / Value Convention

BOQ amounts (`contract_out_boq.unit_price`, `amount_before_vat`, `amount_after_vat`) and the synced contract total (`contract_out.amount_after_vat`) are stored in the **contract's own currency** (nguyên tệ, e.g. USD) — **not** VND. The contract's `currency_code` + `exchange_rate` describe how to convert that native value to VND for display only.

Consequently, the Receivable tab (`ContractReceivableTab`, `ReceivableScheduleSection`, `LinkedPaymentsRow`) must do **all** calculations on the native `amount` values — totals, "% theo HĐ" (`amount / refTotal × 100`), tỷ lệ thu, and the Phải thu/Đã thu/Còn thiếu comparison. The "Quy đổi VNĐ" column (`amount_vnd = amount × exchange_rate`) is a display-only derived value; never drive aggregations or ratios off it.

## File Size Rule

**Any file that exceeds 500 lines must be split.** When writing or editing code causes a file to cross this threshold, proactively break it up before finishing the task. Splitting strategies:
- React components: extract sub-components, custom hooks (`useXxx`), or utility functions to separate files
- Backend controllers: extract helper functions or sub-controllers by concern
- Shared utilities: move formatting/calculation functions to a `utils.js` or `constants.js` sibling file
