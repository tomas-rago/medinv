"use server";

import { createClient } from "@/lib/supabase/server";
import { ProductSchema } from "@/lib/schemas/products/product";
import { UpdateProductSchema } from "@/lib/schemas/products/product-update";
import { canWriteInventory } from "@/lib/constants/roles";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export type ProductRow = {
  id: string;
  name: string;
  ean: string | null;
  category: string | null;
  criticality: string | null;
  presentation: string | null;
  unit: string;
};

export type CreateProductResult = {
  ok: boolean;
  errors: {
    name?: string[];
    ean?: string[];
    category?: string[];
    criticality?: string[];
    presentation?: string[];
    unit?: string[];
    description?: string[];
    _form?: string[];
  };
  product?: ProductRow;
};

export async function createProduct(
  _prevState: CreateProductResult,
  formData: FormData
): Promise<CreateProductResult> {
  const raw = {
    name: formData.get("name"),
    ean: formData.get("ean"),
    category: formData.get("category"),
    criticality: formData.get("criticality"),
    presentation: formData.get("presentation"),
    unit: formData.get("unit"),
    description: formData.get("description"),
  };

  const result = ProductSchema.safeParse(raw);
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

  const organizationId = user.app_metadata?.organization_id as string;
  if (!organizationId) {
    return { ok: false, errors: { _form: ["org_not_found"] } };
  }

  const { data, error } = await supabase
    .from("products")
    .insert({
      organization_id: organizationId,
      name: result.data.name,
      ean: result.data.ean ?? null,
      category: result.data.category ?? null,
      criticality: result.data.criticality ?? null,
      presentation: result.data.presentation ?? null,
      unit: result.data.unit,
      description: result.data.description ?? null,
    })
    .select("id, name, ean, category, criticality, presentation, unit")
    .single();

  if (error) {
    // Unique violation on (organization_id, ean) → friendly per-field message.
    if (error.code === "23505" && error.message.includes("ean")) {
      return { ok: false, errors: { ean: ["ean_duplicate"] } };
    }
    console.error("[createProduct] insert error:", error.message);
    return { ok: false, errors: { _form: [error.message] } };
  }

  revalidatePath("/products");
  revalidatePath("/stock");
  revalidatePath("/predictive");
  return { ok: true, errors: {}, product: data };
}

export type UpdateProductResult = {
  ok: boolean;
  errors: {
    ean?: string[];
    category?: string[];
    criticality?: string[];
    presentation?: string[];
    unit?: string[];
    description?: string[];
    _form?: string[];
  };
};

export async function updateProduct(
  _prevState: UpdateProductResult,
  formData: FormData
): Promise<UpdateProductResult> {
  const raw = {
    id: formData.get("id"),
    ean: formData.get("ean"),
    category: formData.get("category"),
    criticality: formData.get("criticality"),
    presentation: formData.get("presentation"),
    unit: formData.get("unit"),
    description: formData.get("description"),
  };

  const result = UpdateProductSchema.safeParse(raw);
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

  const organizationId = user.app_metadata?.organization_id as string;
  if (!organizationId) {
    return { ok: false, errors: { _form: ["org_not_found"] } };
  }

  // Name is intentionally not updated — it is locked for historical accuracy.
  const { error } = await supabase
    .from("products")
    .update({
      ean: result.data.ean ?? null,
      category: result.data.category ?? null,
      criticality: result.data.criticality ?? null,
      presentation: result.data.presentation ?? null,
      unit: result.data.unit,
      description: result.data.description ?? null,
    })
    .eq("id", result.data.id)
    .eq("organization_id", organizationId);

  if (error) {
    if (error.code === "23505" && error.message.includes("ean")) {
      return { ok: false, errors: { ean: ["ean_duplicate"] } };
    }
    console.error("[updateProduct] update error:", error.message);
    return { ok: false, errors: { _form: [error.message] } };
  }

  revalidatePath("/products");
  revalidatePath("/stock");
  revalidatePath("/predictive");
  return { ok: true, errors: {} };
}

export type ToggleProductActiveResult = {
  ok: boolean;
  error?: string;
};

export async function toggleProductActive(
  productId: string,
  active: boolean
): Promise<ToggleProductActiveResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  if (!canWriteInventory(user.app_metadata?.role as string)) {
    return { ok: false, error: "no_permission" };
  }

  const organizationId = user.app_metadata?.organization_id as string;
  if (!organizationId) {
    return { ok: false, error: "org_not_found" };
  }

  const { error } = await supabase
    .from("products")
    .update({ active })
    .eq("id", productId)
    .eq("organization_id", organizationId);

  if (error) {
    console.error("[toggleProductActive] update error:", error.message);
    return { ok: false, error: error.message };
  }

  revalidatePath("/products");
  revalidatePath("/stock");
  return { ok: true };
}
