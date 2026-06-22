"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { setPendingCheckoutCookie } from "@/lib/mp/cookie";

export async function initiateUpgrade(planId: string, billingCycle: "monthly" | "annual") {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();

  // orgName is required by the cookie schema — reuse org name from DB
  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", profile?.organization_id ?? "")
    .single();

  await setPendingCheckoutCookie(cookieStore, {
    orgName: org?.name ?? "",
    planId,
    billingCycle,
    type: "upgrade",
  });

  redirect("/checkout");
}
