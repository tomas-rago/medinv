import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";

const ALLOWED_TYPES: EmailOtpType[] = ["invite", "recovery", "signup", "email"];

/**
 * Consumes a one-time token server-side and establishes the session.
 *
 * Used by the console links from `logAuthLinkFallback`. Unlike `/auth/callback`
 * (which needs a PKCE `?code=` and its matching verifier cookie), this works with
 * a bare `token_hash`, so a link pasted into any browser still signs the user in.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const rawNext = searchParams.get("next");

  // Relative paths only — never let the query string redirect off-site
  const next = rawNext?.startsWith("/") ? rawNext : "/dashboard";

  if (!tokenHash || !type || !ALLOWED_TYPES.includes(type)) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  if (error) {
    console.error("[auth/verify] verifyOtp error:", error.message);
    redirect("/login");
  }

  redirect(next);
}
