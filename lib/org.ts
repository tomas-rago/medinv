import { createAdminClient } from "@/lib/supabase/admin";

type ProvisionOptions = {
  userId: string;
  orgName: string;
  planId: string;
  billingCycle: "monthly" | "annual";
  mpSubscriptionId?: string | null;
  subscriptionStatus?: "active" | "past_due" | "cancelled" | "pending";
};

export async function provisionOrganization({
  userId,
  orgName,
  planId,
  billingCycle,
  mpSubscriptionId = null,
  subscriptionStatus = "active",
}: ProvisionOptions): Promise<string> {
  const adminClient = createAdminClient();

  const { data: org, error: orgError } = await adminClient
    .from("organizations")
    .insert({
      name: orgName,
      plan_id: planId,
      mp_subscription_id: mpSubscriptionId,
      subscription_status: subscriptionStatus,
      billing_cycle: billingCycle,
    })
    .select("id")
    .single();

  if (orgError || !org) {
    throw new Error(orgError?.message ?? "Error al crear la organización");
  }

  const { error: profileError } = await adminClient
    .from("profiles")
    .update({ organization_id: org.id, role: "chief_doctor" })
    .eq("id", userId);

  if (profileError) {
    throw new Error(profileError.message);
  }

  const { error: metaError } = await adminClient.auth.admin.updateUserById(userId, {
    app_metadata: { role: "chief_doctor", organization_id: org.id },
  });

  if (metaError) {
    throw new Error(metaError.message);
  }

  return org.id;
}
