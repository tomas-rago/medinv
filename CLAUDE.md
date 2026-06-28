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

No test runner is configured.

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

## Debugging

### Database

Supabase MCP is configured. When debugging anything DB-related (missing rows, auth issues, RLS, schema questions), use the MCP tools directly instead of asking the user to check manually:

- `mcp__supabase__execute_sql` — run arbitrary SQL to inspect data
- `mcp__supabase__list_tables` — check schema
- `mcp__supabase__get_logs` — check recent DB/auth/edge function logs
- `mcp__supabase__get_advisors` — surface security and performance issues
