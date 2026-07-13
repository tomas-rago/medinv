# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # start dev server at localhost:3000
npm run build    # production build
npm run lint     # ESLint
npm start        # serve production build
```

```bash
npx vitest run tests/rls   # RLS/flow integration tests (live project; self-skip without SUPABASE_SERVICE_ROLE_KEY in .env.local)
```

## Stack

- **Next.js 16.2.7** (App Router) — has breaking changes vs. earlier versions; see AGENTS.md
- **React 19.2.4**
- **Supabase** (`@supabase/ssr`) for auth
- **Tailwind CSS v4** (PostCSS plugin, not the v3 CLI)
- **TypeScript**

## Architecture

### Next.js 16 breaking changes relevant to this project

`middleware.ts` is **deprecated**. The equivalent is `proxy.ts` at the project root, exporting a named function `proxy` (not `middleware`, not a default export). The `config.matcher` export works the same way.

```ts
// proxy.ts
export async function proxy(request: NextRequest) { … }
export const config = { matcher: […] }
```

### Supabase auth — three client contexts

| File | Used in |
|------|---------|
| `lib/supabase/client.ts` | Client Components (`createBrowserClient`) |
| `lib/supabase/server.ts` | Server Components & Route Handlers — requires `await cookies()` passed in |
| `lib/supabase/middleware.ts` | `proxy.ts` only — exports `updateSession` which calls `getUser()` to refresh tokens |

`updateSession` in `lib/supabase/middleware.ts` **must** call `supabase.auth.getUser()` — this is what triggers the token refresh and writes updated cookies to the response. Removing it breaks session continuity.

### Environment variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Note: the key env var is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, not `NEXT_PUBLIC_SUPABASE_ANON_KEY` (which older Supabase guides use).

### Client Components

Any component using React hooks (`useState`, `useEffect`, etc.) or browser APIs must have `"use client"` as its **first line**. Components in `components/` are client components by convention in this project.

## Conventions

- **Roles**: `chief_doctor` / `doctor` / `nurse` / `administrative` (JWT `app_metadata` is the source of truth). Permission helpers live in `lib/constants/roles.ts` and must stay in sync with the RLS policies they mirror.
- **Module layout**: each dashboard module is `app/(dashboard)/<module>/{page.tsx,actions.ts}` (Server Actions + `useActionState`) plus `components/<module>/`. Zod schemas in `lib/schemas/<module>/`; validation/error message *keys* (snake_case) resolve via the `Validation`/`Errors` namespaces in `messages/es.json`.
- **Atomic DB writes** go through `security invoker` RPCs (RLS still applies); `raise exception 'snake_case_key'` messages double as i18n error keys. Stock ingress must go through `register_stock_movement` (keeps `stock`, `stock_batches`, `stock_movements` consistent) — never write those tables directly.
- **Migrations**: applied to the live project via `mcp__supabase__apply_migration` AND checked into `supabase/migrations/` as a matching file. Update `lib/supabase/database.types.ts` by hand-merging — the raw generator drops the hand-tightened literal union types.
- **AI plan gating**: `hasAiAccess()` in `lib/ai/access.ts` (`plans.token_limit_per_month > 0`). All LLM features sit behind it.

## Current feature work

`docs/feature-spec-alerts-orders-predictive.md` is the active spec (alerts, orders, providers, predictive, LLM chatbot/explain, home/UI). Providers and Orders are built; accepted decisions and progress live in the auto-memory index.

## Debugging

### Database

Supabase MCP is configured. When debugging anything DB-related (missing rows, auth issues, RLS, schema questions), use the MCP tools directly instead of asking the user to check manually:

- `mcp__supabase__execute_sql` — run arbitrary SQL to inspect data
- `mcp__supabase__list_tables` — check schema
- `mcp__supabase__get_logs` — check recent DB/auth/edge function logs
- `mcp__supabase__get_advisors` — surface security and performance issues
