import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/supabase/database.types";
import { createPreapprovalPlan } from "../lib/mp/preapproval-plan";

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment"
    );
  }

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey);

  const { data: plans, error } = await supabase
    .from("plans")
    .select("id, name, monthly_price, mp_plan_id")
    .eq("active", true)
    .gt("monthly_price", 0);

  if (error) throw error;
  if (!plans?.length) {
    console.log("No active plans found.");
    return;
  }

  const force = process.argv.includes("--force");

  for (const plan of plans) {
    if (plan.mp_plan_id && !force) {
      console.log(`skip  "${plan.name}" — mp_plan_id already set: ${plan.mp_plan_id}`);
      continue;
    }
    if (plan.mp_plan_id && force) {
      console.log(`force "${plan.name}" — overwriting ${plan.mp_plan_id}`);
    }

    console.log(`\ncreating MP plan for "${plan.name}" (${plan.monthly_price}/month)...`);

    const { id, status } = await createPreapprovalPlan({
      reason: `Med+Inv — ${plan.name}`,
      billingCycle: "monthly",
      transactionAmount: plan.monthly_price,
    });

    const { error: updateError } = await supabase
      .from("plans")
      .update({ mp_plan_id: id })
      .eq("id", plan.id);

    if (updateError) throw updateError;

    console.log(`ok    mp_plan_id=${id}  status=${status}`);
  }

  console.log("\ndone.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
