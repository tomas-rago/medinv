import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchPreapproval, fetchAuthorizedPayment } from "@/lib/mp/preapproval";

// Verify Mercado Pago webhook signature (x-signature header)
// Format: "ts=<timestamp>,v1=<HMAC-SHA256>"
async function verifySignature(req: NextRequest): Promise<boolean> {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return false;

  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");
  if (!xSignature) return false;

  const parts = Object.fromEntries(
    xSignature.split(",").map((p) => p.split("=") as [string, string])
  );
  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) return false;

  // MP manifest: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
  const url = new URL(req.url);
  const dataId = url.searchParams.get("data.id") ?? "";
  const manifest = `id:${dataId};request-id:${xRequestId ?? ""};ts:${ts};`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  const computed = Buffer.from(sig).toString("hex");

  if (computed.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ v1.charCodeAt(i);
  }
  return diff === 0;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  const valid = await verifySignature(req);
  if (!valid) {
    console.warn("[mp/webhook] invalid signature");
    // Return 200 to prevent MP from retrying — signature failures are usually misconfigured secrets
    return Response.json({ ok: false }, { status: 200 });
  }

  let payload: { type?: string; data?: { id?: string } };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({}, { status: 200 });
  }

  const preapprovalId = payload.data?.id;
  if (!preapprovalId) return Response.json({}, { status: 200 });

  const adminClient = createAdminClient();

  if (payload.type === "subscription_preapproval") {
    try {
      const { status, next_payment_date } = await fetchPreapproval(preapprovalId);

      const subscriptionStatus =
        status === "authorized" ? "active"
        : status === "paused" ? "past_due"
        : status === "cancelled" ? "cancelled"
        : "pending";

      const { error } = await adminClient
        .from("organizations")
        .update({
          subscription_status: subscriptionStatus,
          ...(next_payment_date ? { current_period_end: next_payment_date } : {}),
        })
        .eq("mp_subscription_id", preapprovalId);

      if (error) {
        console.error("[mp/webhook] db update error:", error.message);
      }
    } catch (err) {
      console.error("[mp/webhook] preapproval error:", err instanceof Error ? err.message : err);
    }
  } else if (payload.type === "subscription_authorized_payment") {
    try {
      const { paymentStatus, preapprovalId: parentId, nextPaymentDate } = await fetchAuthorizedPayment(preapprovalId);

      if (paymentStatus === "rejected" && parentId) {
        const { error } = await adminClient
          .from("organizations")
          .update({ subscription_status: "past_due" })
          .eq("mp_subscription_id", parentId);

        if (error) {
          console.error("[mp/webhook] past_due update error:", error.message);
        }
      } else if (paymentStatus === "approved" && parentId && nextPaymentDate) {
        const { error } = await adminClient
          .from("organizations")
          .update({ current_period_end: nextPaymentDate })
          .eq("mp_subscription_id", parentId);

        if (error) {
          console.error("[mp/webhook] period_end update error:", error.message);
        }
      }
    } catch (err) {
      console.error("[mp/webhook] authorized_payment error:", err instanceof Error ? err.message : err);
    }
  }

  // Always return 200 so MP does not retry
  return Response.json({}, { status: 200 });
}
