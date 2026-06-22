/**
 * Diagnostic for POST /preapproval 500 with seller test user credentials.
 *
 * Run with:
 *   npx tsx --env-file=.env.local scripts/test-preapproval.ts
 */

const ACCESS_TOKEN = process.env.MP_TEST_ACCESS_TOKEN!;
const PUBLIC_KEY   = process.env.MP_TEST_PUBLIC_KEY!;
const CURRENCY_ID  = process.env.MP_CURRENCY_ID ?? "ARS";
const BACK_URL     = `${process.env.MP_WEBHOOK_URL ?? "https://felix-unsupported-allophonically.ngrok-free.dev"}/dashboard`;

if (!ACCESS_TOKEN || !PUBLIC_KEY) {
  console.error("Missing MP_TEST_ACCESS_TOKEN or MP_TEST_PUBLIC_KEY");
  process.exit(1);
}

const MLA_MASTERCARD = {
  card_number: "5031755734530604",
  expiration_year: "2030",
  expiration_month: "11",
  security_code: "123",
  cardholder: { name: "APRO", identification: { type: "DNI", number: "12345678" } },
};

const authHeader = { "Content-Type": "application/json", Authorization: `Bearer ${ACCESS_TOKEN}` };

// Reuse the plan created in a previous run, or pass one as argv[2]
const PLAN_ID = process.argv[2] ?? "c0788df721354796a1a1d99820c190a8";

// Seller test user email (confirmed via /users/me)
const SELLER_EMAIL = "test_user_5062788173661530761@testuser.com";
// Buyer test user email (inferred from ID 2903097984 / nickname TESTUSER6075230415398772244)
const BUYER_EMAIL  = "test_user_6075230415398772244@testuser.com";

async function createToken(): Promise<string> {
  const res = await fetch(
    `https://api.mercadopago.com/v1/card_tokens?public_key=${PUBLIC_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(MLA_MASTERCARD) }
  );
  const d = await res.json();
  if (!res.ok) throw new Error(`createToken: ${JSON.stringify(d)}`);
  return d.id as string;
}

async function postPreapproval(label: string, body: Record<string, unknown>): Promise<void> {
  console.log(`\n▶ ${label}`);
  const res = await fetch("https://api.mercadopago.com/preapproval", {
    method: "POST",
    headers: authHeader,
    body: JSON.stringify(body),
  });
  const d = await res.json();
  console.log(`  status:   ${res.status}`);
  console.log(`  response: ${JSON.stringify(d).slice(0, 600)}`);
}

async function main() {
  const autoRecurring = {
    frequency: 1, frequency_type: "months", transaction_amount: 100, currency_id: CURRENCY_ID,
  };

  console.log(`Plan ID:      ${PLAN_ID}`);
  console.log(`Seller email: ${SELLER_EMAIL}`);
  console.log(`Buyer email:  ${BUYER_EMAIL}`);

  // A — plan + buyer email (inferred)
  await postPreapproval(`A — plan, payer=${BUYER_EMAIL}`, {
    preapproval_plan_id: PLAN_ID,
    reason: "MedInv diag A",
    payer_email: BUYER_EMAIL,
    card_token_id: await createToken(),
    back_url: BACK_URL,
    status: "authorized",
  });

  // B — plan + seller email (known valid)
  await postPreapproval(`B — plan, payer=${SELLER_EMAIL}`, {
    preapproval_plan_id: PLAN_ID,
    reason: "MedInv diag B",
    payer_email: SELLER_EMAIL,
    card_token_id: await createToken(),
    back_url: BACK_URL,
    status: "authorized",
  });

  // C — no plan + buyer email, status=pending (skip card auth, just register intent)
  await postPreapproval(`C — no plan, payer=${BUYER_EMAIL}, status=pending`, {
    reason: "MedInv diag C",
    payer_email: BUYER_EMAIL,
    card_token_id: await createToken(),
    auto_recurring: autoRecurring,
    back_url: BACK_URL,
    status: "pending",
  });

  // D — plan + buyer email, status=pending
  await postPreapproval(`D — plan, payer=${BUYER_EMAIL}, status=pending`, {
    preapproval_plan_id: PLAN_ID,
    reason: "MedInv diag D",
    payer_email: BUYER_EMAIL,
    card_token_id: await createToken(),
    back_url: BACK_URL,
    status: "pending",
  });

  console.log("\ndone.");
}

main().catch(e => { console.error(e.message); process.exit(1); });
