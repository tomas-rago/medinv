import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";

export type PendingCheckout = {
  orgName: string;
  planId: string;
  billingCycle: "monthly" | "annual";
  type?: "initial" | "upgrade";
};

const COOKIE_NAME = "mp_pending_checkout";
const COOKIE_TTL = 1800; // 30 minutes

function getSecret(): string {
  const s = process.env.MP_COOKIE_SECRET;
  if (!s) throw new Error("MP_COOKIE_SECRET is not set");
  return s;
}

async function hmacHex(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Buffer.from(sig).toString("hex");
}

async function verify(data: string, expected: string): Promise<boolean> {
  const actual = await hmacHex(data);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) {
    diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export async function setPendingCheckoutCookie(
  cookieStore: ReadonlyRequestCookies,
  payload: PendingCheckout
): Promise<void> {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = await hmacHex(encoded);
  cookieStore.set(COOKIE_NAME, `${encoded}.${sig}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_TTL,
    path: "/",
  });
}

export async function getPendingCheckoutCookie(
  cookieStore: ReadonlyRequestCookies
): Promise<PendingCheckout | null> {
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const dotIdx = raw.lastIndexOf(".");
  if (dotIdx === -1) return null;
  const encoded = raw.slice(0, dotIdx);
  const sig = raw.slice(dotIdx + 1);
  if (!(await verify(encoded, sig))) return null;
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString()) as PendingCheckout;
  } catch {
    return null;
  }
}

export async function deletePendingCheckoutCookie(
  cookieStore: ReadonlyRequestCookies
): Promise<void> {
  cookieStore.delete(COOKIE_NAME);
}
