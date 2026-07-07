"use server";

import { createClient } from "@/lib/supabase/server";
import { ProviderSchema, UpdateProviderSchema } from "@/lib/schemas/providers/provider";
import { canManageProviders } from "@/lib/constants/roles";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export type ProviderRow = {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
};

type ProviderFieldErrors = {
  name?: string[];
  contact_name?: string[];
  email?: string[];
  phone?: string[];
  address?: string[];
  notes?: string[];
  _form?: string[];
};

export type CreateProviderResult = {
  ok: boolean;
  errors: ProviderFieldErrors;
  provider?: ProviderRow;
};

export async function createProvider(
  _prevState: CreateProviderResult,
  formData: FormData
): Promise<CreateProviderResult> {
  const raw = {
    name: formData.get("name"),
    contact_name: formData.get("contact_name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    address: formData.get("address"),
    notes: formData.get("notes"),
  };

  const result = ProviderSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, errors: result.error.flatten().fieldErrors };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, errors: { _form: ["not_authenticated"] } };

  if (!canManageProviders(user.app_metadata?.role as string)) {
    return { ok: false, errors: { _form: ["no_permission"] } };
  }

  const organizationId = user.app_metadata?.organization_id as string;
  if (!organizationId) {
    return { ok: false, errors: { _form: ["org_not_found"] } };
  }

  const { data, error } = await supabase
    .from("providers")
    .insert({
      organization_id: organizationId,
      name: result.data.name,
      contact_name: result.data.contact_name ?? null,
      email: result.data.email ?? null,
      phone: result.data.phone ?? null,
      address: result.data.address ?? null,
      notes: result.data.notes ?? null,
    })
    .select("id, name, contact_name, email, phone")
    .single();

  if (error) {
    // Unique violation on (organization_id, lower(name)) → friendly message.
    if (error.code === "23505") {
      return { ok: false, errors: { name: ["provider_duplicate"] } };
    }
    console.error("[createProvider] insert error:", error.message);
    return { ok: false, errors: { _form: [error.message] } };
  }

  revalidatePath("/providers");
  return { ok: true, errors: {}, provider: data };
}

export type UpdateProviderResult = {
  ok: boolean;
  errors: ProviderFieldErrors;
};

export async function updateProvider(
  _prevState: UpdateProviderResult,
  formData: FormData
): Promise<UpdateProviderResult> {
  const raw = {
    id: formData.get("id"),
    name: formData.get("name"),
    contact_name: formData.get("contact_name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    address: formData.get("address"),
    notes: formData.get("notes"),
  };

  const result = UpdateProviderSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, errors: result.error.flatten().fieldErrors };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, errors: { _form: ["not_authenticated"] } };

  if (!canManageProviders(user.app_metadata?.role as string)) {
    return { ok: false, errors: { _form: ["no_permission"] } };
  }

  const organizationId = user.app_metadata?.organization_id as string;
  if (!organizationId) {
    return { ok: false, errors: { _form: ["org_not_found"] } };
  }

  const { error } = await supabase
    .from("providers")
    .update({
      name: result.data.name,
      contact_name: result.data.contact_name ?? null,
      email: result.data.email ?? null,
      phone: result.data.phone ?? null,
      address: result.data.address ?? null,
      notes: result.data.notes ?? null,
    })
    .eq("id", result.data.id)
    .eq("organization_id", organizationId);

  if (error) {
    if (error.code === "23505") {
      return { ok: false, errors: { name: ["provider_duplicate"] } };
    }
    console.error("[updateProvider] update error:", error.message);
    return { ok: false, errors: { _form: [error.message] } };
  }

  revalidatePath("/providers");
  return { ok: true, errors: {} };
}

export type ToggleProviderActiveResult = {
  ok: boolean;
  error?: string;
};

export async function toggleProviderActive(
  providerId: string,
  active: boolean
): Promise<ToggleProviderActiveResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  if (!canManageProviders(user.app_metadata?.role as string)) {
    return { ok: false, error: "no_permission" };
  }

  const organizationId = user.app_metadata?.organization_id as string;
  if (!organizationId) {
    return { ok: false, error: "org_not_found" };
  }

  const { error } = await supabase
    .from("providers")
    .update({ active })
    .eq("id", providerId)
    .eq("organization_id", organizationId);

  if (error) {
    console.error("[toggleProviderActive] update error:", error.message);
    return { ok: false, error: error.message };
  }

  revalidatePath("/providers");
  return { ok: true };
}

export type ProviderProduct = {
  id: string;
  name: string;
};

// Replace the set of products a provider supplies with the given list.
export type SetProviderProductsResult = {
  ok: boolean;
  error?: string;
};

export async function setProviderProducts(
  providerId: string,
  productIds: string[]
): Promise<SetProviderProductsResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  if (!canManageProviders(user.app_metadata?.role as string)) {
    return { ok: false, error: "no_permission" };
  }

  const organizationId = user.app_metadata?.organization_id as string;
  if (!organizationId) {
    return { ok: false, error: "org_not_found" };
  }

  const { data: current, error: readError } = await supabase
    .from("provider_products")
    .select("id, product_id")
    .eq("provider_id", providerId)
    .eq("organization_id", organizationId);

  if (readError) {
    console.error("[setProviderProducts] read error:", readError.message);
    return { ok: false, error: readError.message };
  }

  const wanted = new Set(productIds);
  const existing = new Set((current ?? []).map((r) => r.product_id));

  const toRemove = (current ?? []).filter((r) => !wanted.has(r.product_id)).map((r) => r.id);
  const toAdd = productIds
    .filter((pid) => !existing.has(pid))
    .map((pid) => ({
      organization_id: organizationId,
      provider_id: providerId,
      product_id: pid,
    }));

  if (toRemove.length > 0) {
    const { error } = await supabase.from("provider_products").delete().in("id", toRemove);
    if (error) {
      console.error("[setProviderProducts] delete error:", error.message);
      return { ok: false, error: error.message };
    }
  }

  if (toAdd.length > 0) {
    const { error } = await supabase.from("provider_products").insert(toAdd);
    if (error) {
      console.error("[setProviderProducts] insert error:", error.message);
      return { ok: false, error: error.message };
    }
  }

  revalidatePath("/providers");
  return { ok: true };
}

// Products currently associated to a provider (for the association modal).
export async function getProviderProducts(providerId: string): Promise<ProviderProduct[]> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("provider_products")
    .select("product_id, products(id, name)")
    .eq("provider_id", providerId);

  return (data ?? [])
    .map((r) => r.products)
    .filter((p): p is { id: string; name: string } => p !== null)
    .map((p) => ({ id: p.id, name: p.name }));
}
