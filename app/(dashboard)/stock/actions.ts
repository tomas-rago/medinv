"use server";

import { createClient } from "@/lib/supabase/server";
import { StockEntrySchema } from "@/lib/schemas/stock/movement";
import { canWriteInventory } from "@/lib/constants/roles";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export type ProductMatch = {
  id: string;
  name: string;
  ean: string | null;
  category: string | null;
  presentation: string | null;
  unit: string;
};

export async function searchProducts(query: string): Promise<ProductMatch[]> {
  const term = query.trim();
  if (term.length < 2) return [];

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const safe = term.replace(/[,()*]/g, " ").trim();
  if (!safe) return [];

  const { data } = await supabase
    .from("products")
    .select("id, name, ean, category, presentation, unit")
    .eq("active", true)
    .or(`name.ilike.%${safe}%,ean.ilike.%${safe}%,category.ilike.%${safe}%`)
    .order("name")
    .limit(10);

  return data ?? [];
}

export type StockEntryResult = {
  ok: boolean;
  errors: {
    product_id?: string[];
    quantity?: string[];
    expiry_date?: string[];
    notes?: string[];
    _form?: string[];
  };
};

export async function registerStockEntry(
  _prevState: StockEntryResult,
  formData: FormData
): Promise<StockEntryResult> {
  const raw = {
    product_id: formData.get("product_id"),
    quantity: formData.get("quantity"),
    expiry_date: formData.get("expiry_date"),
    notes: formData.get("notes"),
  };

  const result = StockEntrySchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, errors: result.error.flatten().fieldErrors };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, errors: { _form: ["not_authenticated"] } };

  if (!canWriteInventory(user.app_metadata?.role as string)) {
    return { ok: false, errors: { _form: ["no_permission"] } };
  }

  const { error } = await supabase.rpc("register_stock_movement", {
    p_product_id: result.data.product_id,
    p_type: "entry",
    p_quantity: result.data.quantity,
    p_expiry_date: result.data.expiry_date ?? undefined,
    p_notes: result.data.notes ?? undefined,
  });

  if (error) {
    console.error("[registerStockEntry] rpc error:", error.message);
    return { ok: false, errors: { _form: [error.message] } };
  }

  revalidatePath("/stock");
  revalidatePath("/products");
  return { ok: true, errors: {} };
}
