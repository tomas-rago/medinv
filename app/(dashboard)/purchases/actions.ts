"use server";

import { createClient } from "@/lib/supabase/server";
import { CreatePurchaseSchema, ReceivePurchaseSchema } from "@/lib/schemas/purchases/purchase";
import { canManagePurchases } from "@/lib/constants/roles";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export type CreatePurchaseResult = {
  ok: boolean;
  errors: {
    provider_id?: string[];
    notes?: string[];
    items?: string[];
    _form?: string[];
  };
};

export async function createPurchase(
  _prevState: CreatePurchaseResult,
  formData: FormData
): Promise<CreatePurchaseResult> {
  const raw = {
    provider_id: formData.get("provider_id"),
    notes: formData.get("notes"),
    items: formData.get("items"),
  };

  const result = CreatePurchaseSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, errors: result.error.flatten().fieldErrors };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, errors: { _form: ["not_authenticated"] } };

  if (!canManagePurchases(user.app_metadata?.role as string)) {
    return { ok: false, errors: { _form: ["no_permission"] } };
  }

  const { error } = await supabase.rpc("create_purchase", {
    p_provider_id: result.data.provider_id ?? null,
    p_notes: result.data.notes ?? null,
    p_items: result.data.items.map((i) => ({
      product_id: i.product_id,
      quantity: i.quantity,
      unit_price: i.unit_price ?? null,
    })),
  });

  if (error) {
    console.error("[createPurchase] rpc error:", error.message);
    return { ok: false, errors: { _form: [error.message] } };
  }

  revalidatePath("/purchases");
  return { ok: true, errors: {} };
}

export type PurchaseStatusResult = {
  ok: boolean;
  error?: string;
};

// draft → confirmed (order marked as sent to the provider).
export async function confirmPurchase(purchaseId: string): Promise<PurchaseStatusResult> {
  return updateStatus(purchaseId, ["draft"], "confirmed");
}

// draft/confirmed → cancelled (declined; no stock impact, lines kept for audit).
export async function cancelPurchase(purchaseId: string): Promise<PurchaseStatusResult> {
  return updateStatus(purchaseId, ["draft", "confirmed"], "cancelled");
}

async function updateStatus(
  purchaseId: string,
  fromStatuses: ("draft" | "confirmed")[],
  toStatus: "confirmed" | "cancelled"
): Promise<PurchaseStatusResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  if (!canManagePurchases(user.app_metadata?.role as string)) {
    return { ok: false, error: "no_permission" };
  }

  const { data, error } = await supabase
    .from("purchases")
    .update({ status: toStatus })
    .eq("id", purchaseId)
    .in("status", fromStatuses)
    .select("id");

  if (error) {
    console.error("[updateStatus] update error:", error.message);
    return { ok: false, error: error.message };
  }
  if (!data || data.length === 0) {
    return { ok: false, error: "purchase_not_found" };
  }

  revalidatePath("/purchases");
  return { ok: true };
}

export type ReceivePurchaseResult = {
  ok: boolean;
  errors: {
    items?: string[];
    _form?: string[];
  };
};

export async function receivePurchase(
  _prevState: ReceivePurchaseResult,
  formData: FormData
): Promise<ReceivePurchaseResult> {
  const raw = {
    purchase_id: formData.get("purchase_id"),
    items: formData.get("items"),
  };

  const result = ReceivePurchaseSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, errors: result.error.flatten().fieldErrors };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, errors: { _form: ["not_authenticated"] } };

  if (!canManagePurchases(user.app_metadata?.role as string)) {
    return { ok: false, errors: { _form: ["no_permission"] } };
  }

  const { error } = await supabase.rpc("receive_purchase", {
    p_purchase_id: result.data.purchase_id,
    p_items: result.data.items,
  });

  if (error) {
    console.error("[receivePurchase] rpc error:", error.message);
    return { ok: false, errors: { _form: [error.message] } };
  }

  revalidatePath("/purchases");
  revalidatePath("/stock");
  revalidatePath("/products");
  return { ok: true, errors: {} };
}

export type PurchaseItemRow = {
  id: string;
  product_id: string;
  product_name: string;
  unit: string;
  quantity: number;
  unit_price: number | null;
  accepted_quantity: number | null;
  expiry_date: string | null;
};

// Line items with product info, for the detail and receive modals.
export async function getPurchaseItems(purchaseId: string): Promise<PurchaseItemRow[]> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("purchase_items")
    .select("id, product_id, quantity, unit_price, accepted_quantity, expiry_date, products(name, unit)")
    .eq("purchase_id", purchaseId)
    .order("id");

  return (data ?? []).map((r) => ({
    id: r.id,
    product_id: r.product_id,
    product_name: r.products?.name ?? "—",
    unit: r.products?.unit ?? "unit",
    quantity: r.quantity,
    unit_price: r.unit_price,
    accepted_quantity: r.accepted_quantity,
    expiry_date: r.expiry_date,
  }));
}

export type ProviderOption = {
  id: string;
  name: string;
};

// Active providers for the order-creation select.
export async function getActiveProviders(): Promise<ProviderOption[]> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("providers")
    .select("id, name")
    .eq("active", true)
    .order("name");

  return data ?? [];
}
