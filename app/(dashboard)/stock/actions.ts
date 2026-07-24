"use server";

import { createClient } from "@/lib/supabase/server";
import {
  StockEntrySchema,
  StockExitSchema,
  RectifySchema,
} from "@/lib/schemas/stock/movement";
import { MovementFiltersSchema } from "@/lib/schemas/stock/filters";
import { buildMovementsQuery, type MovementQueryRow } from "./query";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { EXPORT_MAX_ROWS } from "@/lib/export/movements-types";
import type { MovementExportRow, MovementsExportResult } from "@/lib/export/movements-types";
import { canWriteInventory, canViewReports } from "@/lib/constants/roles";
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

// Current on-hand quantity for a product (aggregate `stock`), for the egress hint.
export async function getProductStock(productId: string): Promise<number> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data } = await supabase
    .from("stock")
    .select("quantity")
    .eq("product_id", productId)
    .maybeSingle();

  return data?.quantity ?? 0;
}

export type StockExitResult = {
  ok: boolean;
  errors: {
    product_id?: string[];
    quantity?: string[];
    receptor_id?: string[];
    notes?: string[];
    _form?: string[];
  };
};

export async function registerStockExit(
  _prevState: StockExitResult,
  formData: FormData
): Promise<StockExitResult> {
  const raw = {
    product_id: formData.get("product_id"),
    quantity: formData.get("quantity"),
    receptor_id: formData.get("receptor_id"),
    notes: formData.get("notes"),
  };

  const result = StockExitSchema.safeParse(raw);
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

  const { error } = await supabase.rpc("register_stock_exit", {
    p_product_id: result.data.product_id,
    p_quantity: result.data.quantity,
    p_notes: result.data.notes ?? undefined,
    p_receptor_id: result.data.receptor_id ?? undefined,
  });

  if (error) {
    console.error("[registerStockExit] rpc error:", error.message);
    // Surface the insufficient-stock guard on the quantity field.
    if (error.message.includes("insufficient_stock")) {
      return { ok: false, errors: { quantity: ["insufficient_stock"] } };
    }
    if (error.message.includes("receptor_not_found")) {
      return { ok: false, errors: { _form: ["receptor_not_found"] } };
    }
    return { ok: false, errors: { _form: [error.message] } };
  }

  revalidatePath("/stock");
  revalidatePath("/products");
  return { ok: true, errors: {} };
}

// All rows matching the current report filters (not just the visible page),
// for the CSV/Excel/PDF exporters. Capped at EXPORT_MAX_ROWS.
export async function fetchMovementsForExport(
  rawFilters: unknown
): Promise<MovementsExportResult> {
  // Server actions are public endpoints — never trust the client's shape.
  const parsed = MovementFiltersSchema.safeParse(rawFilters);
  if (!parsed.success) {
    return { ok: false, error: "invalid_filters" };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };
  if (!canViewReports(user.app_metadata?.role as string)) {
    return { ok: false, error: "not_authorized" };
  }

  // PostgREST caps a response at 1000 rows, so .limit(EXPORT_MAX_ROWS) used to
  // yield at most 1000 while `truncated` compared the total against 5000 — an
  // export could silently drop rows and still claim to be complete. Page it.
  const { count, error } = await buildMovementsQuery(supabase, parsed.data).range(0, 0);
  if (error) {
    console.error("[fetchMovementsForExport] count error:", error.message);
    return { ok: false, error: "export_failed" };
  }

  const movements = await fetchAllRows<MovementQueryRow>(
    (from, to) => buildMovementsQuery(supabase, parsed.data).range(from, to),
    EXPORT_MAX_ROWS
  );

  // user_id references auth.users (no PostgREST relationship to profiles) —
  // resolve names with a separate lookup, same as the /stock page.
  const userIds = [...new Set(movements.map((m) => m.user_id))];
  let names: Record<string, string> = {};
  if (userIds.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds);
    names = Object.fromEntries((profs ?? []).map((p) => [p.id, p.full_name ?? "—"]));
  }

  const one = <T,>(value: T | T[] | null): T | null =>
    Array.isArray(value) ? value[0] ?? null : value;

  const rows: MovementExportRow[] = movements.map((m) => {
    const product = one(m.products as { name: string; category: string | null; criticality: string | null } | null);
    const receptor = one(m.receptors as { name: string } | null);
    const purchase = one(m.purchases as { providers: { name: string } | { name: string }[] | null } | null);
    const provider = purchase ? one(purchase.providers) : null;
    return {
      created_at: m.created_at,
      product_name: product?.name ?? "—",
      category: product?.category ?? null,
      criticality: product?.criticality ?? null,
      type: m.type,
      quantity: m.quantity,
      expiry_date: m.expiry_date,
      user_name: names[m.user_id] ?? "—",
      provider_name: provider?.name ?? null,
      receptor_name: receptor?.name ?? null,
      notes: m.notes,
    };
  });

  // Truthful now: what the export actually holds vs. what matched the filters.
  return { ok: true, rows, truncated: (count ?? 0) > rows.length };
}

export type RectifyResult = {
  ok: boolean;
  errors: {
    quantity?: string[];
    expiry_date?: string[];
    reason?: string[];
    _form?: string[];
  };
};

export async function rectifyStockMovement(
  _prevState: RectifyResult,
  formData: FormData
): Promise<RectifyResult> {
  // Disabled inputs (when "nullify" is checked) are omitted from FormData, so
  // get() returns null — normalize to undefined so the optional fields validate.
  const raw = {
    movement_id: formData.get("movement_id"),
    nullify: formData.get("nullify") === "on" || formData.get("nullify") === "true",
    quantity: formData.get("quantity") ?? undefined,
    expiry_date: formData.get("expiry_date") ?? undefined,
    reason: formData.get("reason") ?? undefined,
  };

  const result = RectifySchema.safeParse(raw);
  if (!result.success) {
    const fe = result.error.flatten().fieldErrors;
    return { ok: false, errors: { quantity: fe.quantity, expiry_date: fe.expiry_date, reason: fe.reason, _form: fe.movement_id } };
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

  // Nullify => target quantity 0. Otherwise use the corrected quantity.
  const newQuantity = result.data.nullify ? 0 : result.data.quantity ?? 0;

  const { error } = await supabase.rpc("rectify_stock_movement", {
    p_movement_id: result.data.movement_id,
    p_new_quantity: newQuantity,
    p_new_expiry_date: result.data.nullify ? undefined : result.data.expiry_date ?? undefined,
    p_reason: result.data.reason ?? undefined,
  });

  if (error) {
    console.error("[rectifyStockMovement] rpc error:", error.message);
    for (const key of ["already_rectified", "insufficient_stock", "no_change", "not_rectifiable", "movement_not_found"]) {
      if (error.message.includes(key)) {
        return { ok: false, errors: { _form: [key] } };
      }
    }
    return { ok: false, errors: { _form: [error.message] } };
  }

  revalidatePath("/stock");
  revalidatePath("/products");
  return { ok: true, errors: {} };
}
