"use server";

import { createClient } from "@/lib/supabase/server";
import { ProductSchema } from "@/lib/schemas/products/product";
import { canWriteInventory } from "@/lib/constants/roles";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export type ProductRow = {
  id: string;
  name: string;
  ean: string | null;
  category: string | null;
  presentation: string | null;
  unit: string;
};

export type CreateProductResult = {
  ok: boolean;
  errors: {
    name?: string[];
    ean?: string[];
    category?: string[];
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
      presentation: result.data.presentation ?? null,
      unit: result.data.unit,
      description: result.data.description ?? null,
    })
    .select("id, name, ean, category, presentation, unit")
    .single();

  if (error) {
    console.error("[createProduct] insert error:", error.message);
    return { ok: false, errors: { _form: [error.message] } };
  }

  revalidatePath("/products");
  revalidatePath("/stock");
  return { ok: true, errors: {}, product: data };
}
