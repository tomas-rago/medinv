import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Whether auth flows ask Supabase to actually send the email, or just generate a
 * link and print it to the server console.
 *
 * `AUTH_EMAIL_MODE=real`     — always send (use this when demoing locally)
 * `AUTH_EMAIL_MODE=dev-link` — never send, print links instead
 * unset                      — send everywhere except `next dev`
 */
export function sendsRealAuthEmails(): boolean {
  const mode = process.env.AUTH_EMAIL_MODE;
  if (mode === "real") return true;
  if (mode === "dev-link") return false;
  return process.env.NODE_ENV !== "development";
}

export type AuthLinkType = "invite" | "recovery" | "signup";

const DEFAULT_NEXT: Record<AuthLinkType, string> = {
  invite: "/auth/complete-profile",
  recovery: "/auth/reset-password",
  signup: "/auth/callback",
};

type FallbackArgs = {
  type: AuthLinkType;
  email: string;
  /** Required by Supabase for `signup` links. */
  password?: string;
  /** `user_metadata` for the created user — `signup` only. */
  data?: Record<string, unknown>;
  /** Where `/auth/verify` sends the user once the token is consumed. */
  next?: string;
};

/**
 * Mints a one-time auth link and logs it to the server console.
 *
 * Only ever call this when the real email did NOT go out. `auth.one_time_tokens`
 * is unique on (user_id, token_type), so generating a link REPLACES any token
 * already emailed to that user — the two links can never both be valid.
 *
 * The URL points at `/auth/verify`, not at `properties.action_link`: the latter
 * is an implicit-flow link whose `#access_token` fragment never reaches the
 * server, so it can't establish a session on the Server Components that need one.
 *
 * Returns the URL, or null if the link couldn't be generated.
 */
export async function logAuthLinkFallback({
  type,
  email,
  password,
  data: userMetadata,
  next,
}: FallbackArgs): Promise<string | null> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const adminClient = createAdminClient();

  // No `redirectTo` — we build our own URL from the token hash and ignore
  // `properties.action_link` entirely.
  const { data, error } = await adminClient.auth.admin.generateLink(
    type === "signup"
      ? { type, email, password: password ?? "", options: { data: userMetadata } }
      : { type, email }
  );

  if (error) {
    console.error(`[auth-link] generateLink(${type}) failed:`, error.message);
    return null;
  }

  const tokenHash = data?.properties?.hashed_token;
  if (!tokenHash) {
    console.error(`[auth-link] generateLink(${type}) returned no hashed_token`);
    return null;
  }

  const params = new URLSearchParams({
    token_hash: tokenHash,
    type,
    next: next ?? DEFAULT_NEXT[type],
  });
  const url = `${siteUrl}/auth/verify?${params}`;

  console.log(`\n🔗 ${type} link for ${email}:\n${url}\n`);
  return url;
}
