import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getPendingCheckoutCookie } from "@/lib/mp/cookie";
import { CheckoutBrick } from "@/components/checkout/CheckoutBrick";
import { Logo } from "@/components/ui/Logo";
import { Stepper } from "@/components/ui/Stepper";
import { IconSprite } from "@/components/ui/Icons";

export default async function CheckoutPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const pending = await getPendingCheckoutCookie(cookieStore);
  if (!pending) redirect("/onboarding");

  // For initial signups, if org already exists the payment was already completed
  if (pending.type !== "upgrade") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();
    if (profile?.organization_id) redirect("/dashboard");
  }

  // Fetch canonical plan data — never trust cookie amounts
  const { data: plan } = await supabase
    .from("plans")
    .select("id, name, monthly_price")
    .eq("id", pending.planId)
    .single();

  if (!plan) redirect("/onboarding");

  const price =
    pending.billingCycle === "annual"
      ? Math.round(plan.monthly_price * 0.8)
      : plan.monthly_price;

  const publicKey = process.env.MP_TEST_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_MP_PUBLIC_KEY ?? "";

  return (
    <>
      <IconSprite />
      <div className="min-h-screen flex flex-col" style={{ background: "var(--c-page)" }}>
        <header
          className="flex items-center justify-between px-7 border-b"
          style={{ height: 68, background: "var(--c-surface)", borderColor: "var(--c-line)" }}
        >
          <Logo size="sm" />
          <Stepper step={2} />
          <span style={{ width: 80 }} />
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-12">
          <div className="max-w-lg mx-auto">
            <div className="text-center mb-8">
              <h1 className="font-display text-ink leading-tight" style={{ fontSize: 28 }}>
                Completá el pago
              </h1>
              <p className="text-ink2 mt-2" style={{ fontSize: 15 }}>
                Plan <strong className="text-ink">{plan.name}</strong> ·{" "}
                ${price}/mes{" "}
                {pending.billingCycle === "annual" && (
                  <span className="text-ink3">(facturado anualmente)</span>
                )}
              </p>
            </div>

            <CheckoutBrick
              publicKey={publicKey}
              amount={price}
              planName={plan.name}
              billingCycle={pending.billingCycle}
              checkoutType={pending.type ?? "initial"}
            />
          </div>
        </div>
      </div>
    </>
  );
}
