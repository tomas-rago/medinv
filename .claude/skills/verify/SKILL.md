---
name: verify
description: Drive the running Med+Inv app end-to-end against the live Supabase project — mint real session cookies, fetch SSR HTML, assert rendered DOM. Use when verifying dashboard/auth UI changes at runtime.
---

# Verifying Med+Inv at runtime

The app is a Next.js 16 dashboard behind Supabase cookie auth. No Playwright
is installed; the working handle is **SSR HTML over HTTP with a real session
cookie**, using ephemeral orgs/users on the live project (same pattern as
`tests/rls/`).

## Recipe

1. Start the dev server: `npm run dev` (port 3000). If a stale
   `.next/dev/types/routes.d.ts` breaks `npm run build`, delete `.next/` first.
2. Run the driver: `npx tsx --env-file=.env.local .claude/skills/verify/verify-home.mts`
   (needs `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`; set `VERIFY_OUT` to
   choose where fetched HTML lands). It:
   - creates an ephemeral org (AI-enabled plan if available), product, and
     users per role via `admin.auth.admin.createUser` with
     `app_metadata: { role, organization_id }`, **plus a `profiles` upsert**
     (the dashboard layout reads `profiles`, not just the JWT);
   - seeds consumption the way `tests/rls/predictive.test.ts` does: entry 100,
     3×30 exits backdated via admin `created_at` updates → dailyDemand 10,
     daysUntilReorder 0, suggestedQuantity 290;
   - builds the `@supabase/ssr` cookie: `sb-<ref>-auth-token` =
     `base64-` + base64url(JSON session), chunked at 3180 chars;
   - fetches pages with `redirect: "manual"` and asserts on the HTML;
   - always cleans up (children first: alerts → purchases → stock → products
     → users → profiles → org).

## Gotchas

- **The RSC flight payload embeds the entire `messages/es.json` bundle in
  every page's HTML.** A bare `html.includes("some UI string")` matches even
  when the string is never rendered. Anchor assertions to rendered DOM with a
  leading `>` (e.g. `h.includes(">Pedir ahora")`) — negative assertions are
  wrong without this.
- Active-nav state is SSR'd (`usePathname` renders server-side), so
  `class="mi-nav-item is-active"` is assertable in fetched HTML.
- Media-query behavior (drawer open/close, breakpoints) is not observable
  over HTTP — verify the markup (`mi-topbar`, `mi-drawer`) and grep the
  served `/_next/static/chunks/*.css` for the rules; pixel checks need a
  human or a browser tool.
- Anonymous requests to dashboard routes 307 → `/login`; assert with
  `redirect: "manual"`.
