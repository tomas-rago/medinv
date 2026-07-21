"use server";

import { createClient } from "@/lib/supabase/server";
import { ReceptorSchema, UpdateReceptorSchema } from "@/lib/schemas/receptors/receptor";
import { canCreateReceptors, canManageReceptors } from "@/lib/constants/roles";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export type ReceptorRow = {
  id: string;
  name: string;
  external_id: string | null;
  patient_type: string | null;
};

type ReceptorFieldErrors = {
  name?: string[];
  external_id?: string[];
  patient_type?: string[];
  phone?: string[];
  email?: string[];
  notes?: string[];
  _form?: string[];
};

export type CreateReceptorResult = {
  ok: boolean;
  errors: ReceptorFieldErrors;
  receptor?: ReceptorRow;
};

export async function createReceptor(
  _prevState: CreateReceptorResult,
  formData: FormData
): Promise<CreateReceptorResult> {
  const raw = {
    name: formData.get("name"),
    external_id: formData.get("external_id"),
    patient_type: formData.get("patient_type"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    notes: formData.get("notes"),
  };

  const result = ReceptorSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, errors: result.error.flatten().fieldErrors };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, errors: { _form: ["not_authenticated"] } };

  if (!canCreateReceptors(user.app_metadata?.role as string)) {
    return { ok: false, errors: { _form: ["no_permission"] } };
  }

  const organizationId = user.app_metadata?.organization_id as string;
  if (!organizationId) {
    return { ok: false, errors: { _form: ["org_not_found"] } };
  }

  const { data, error } = await supabase
    .from("receptors")
    .insert({
      organization_id: organizationId,
      name: result.data.name,
      external_id: result.data.external_id ?? null,
      patient_type: result.data.patient_type ?? null,
      phone: result.data.phone ?? null,
      email: result.data.email ?? null,
      notes: result.data.notes ?? null,
    })
    .select("id, name, external_id, patient_type")
    .single();

  if (error) {
    // Partial unique indexes: (org, external_id) and (org, lower(name)) when
    // external_id is null — surface the violation on the offending field.
    if (error.code === "23505") {
      if (error.message.includes("receptors_org_external_id_key")) {
        return { ok: false, errors: { external_id: ["receptor_external_id_duplicate"] } };
      }
      return { ok: false, errors: { name: ["receptor_duplicate"] } };
    }
    console.error("[createReceptor] insert error:", error.message);
    return { ok: false, errors: { _form: [error.message] } };
  }

  revalidatePath("/receptors");
  return { ok: true, errors: {}, receptor: data };
}

export type UpdateReceptorResult = {
  ok: boolean;
  errors: ReceptorFieldErrors;
};

export async function updateReceptor(
  _prevState: UpdateReceptorResult,
  formData: FormData
): Promise<UpdateReceptorResult> {
  const raw = {
    id: formData.get("id"),
    name: formData.get("name"),
    external_id: formData.get("external_id"),
    patient_type: formData.get("patient_type"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    notes: formData.get("notes"),
  };

  const result = UpdateReceptorSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, errors: result.error.flatten().fieldErrors };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, errors: { _form: ["not_authenticated"] } };

  if (!canManageReceptors(user.app_metadata?.role as string)) {
    return { ok: false, errors: { _form: ["no_permission"] } };
  }

  const organizationId = user.app_metadata?.organization_id as string;
  if (!organizationId) {
    return { ok: false, errors: { _form: ["org_not_found"] } };
  }

  const { error } = await supabase
    .from("receptors")
    .update({
      name: result.data.name,
      external_id: result.data.external_id ?? null,
      patient_type: result.data.patient_type ?? null,
      phone: result.data.phone ?? null,
      email: result.data.email ?? null,
      notes: result.data.notes ?? null,
    })
    .eq("id", result.data.id)
    .eq("organization_id", organizationId);

  if (error) {
    if (error.code === "23505") {
      if (error.message.includes("receptors_org_external_id_key")) {
        return { ok: false, errors: { external_id: ["receptor_external_id_duplicate"] } };
      }
      return { ok: false, errors: { name: ["receptor_duplicate"] } };
    }
    console.error("[updateReceptor] update error:", error.message);
    return { ok: false, errors: { _form: [error.message] } };
  }

  revalidatePath("/receptors");
  return { ok: true, errors: {} };
}

export type ToggleReceptorActiveResult = {
  ok: boolean;
  error?: string;
};

export async function toggleReceptorActive(
  receptorId: string,
  active: boolean
): Promise<ToggleReceptorActiveResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  if (!canManageReceptors(user.app_metadata?.role as string)) {
    return { ok: false, error: "no_permission" };
  }

  const organizationId = user.app_metadata?.organization_id as string;
  if (!organizationId) {
    return { ok: false, error: "org_not_found" };
  }

  const { error } = await supabase
    .from("receptors")
    .update({ active })
    .eq("id", receptorId)
    .eq("organization_id", organizationId);

  if (error) {
    console.error("[toggleReceptorActive] update error:", error.message);
    return { ok: false, error: error.message };
  }

  revalidatePath("/receptors");
  return { ok: true };
}

// Active receptors matching a free-text term, for the egress combobox and the
// movements report filter.
export async function searchReceptors(query: string): Promise<ReceptorRow[]> {
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
    .from("receptors")
    .select("id, name, external_id, patient_type")
    .eq("active", true)
    .or(`name.ilike.%${safe}%,external_id.ilike.%${safe}%`)
    .order("name")
    .limit(10);

  return data ?? [];
}
