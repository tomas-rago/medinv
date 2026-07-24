import { logAuthLinkFallback, type AuthLinkType } from "../lib/auth/email-mode";

const TYPES: AuthLinkType[] = ["invite", "recovery", "signup"];

function usage(): never {
  console.error(
    [
      "Usage: npm run auth:link -- <invite|recovery|signup> <email> [password]",
      "",
      "  password is required for `signup` only.",
    ].join("\n")
  );
  process.exit(1);
}

async function main() {
  const [type, email, password] = process.argv.slice(2);

  if (!type || !email || !TYPES.includes(type as AuthLinkType)) usage();
  if (type === "signup" && !password) usage();

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment"
    );
  }

  console.warn(
    `\n⚠️  This invalidates any ${type} link already emailed to ${email}.\n` +
      `   auth.one_time_tokens is unique on (user_id, token_type) — only the link\n` +
      `   below will work from now on.\n`
  );

  const url = await logAuthLinkFallback({
    type: type as AuthLinkType,
    email,
    password,
  });

  if (!url) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
