import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { canCreateReceptors, canManageReceptors } from "@/lib/constants/roles";
import { ReceptorsPage } from "@/components/receptors/ReceptorsPage";
import { resolvePage, resolvePageSize } from "@/lib/pagination";

export default async function ReceptorsServerPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; size?: string; q?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const role = user.app_metadata?.role as string;
  const canCreate = canCreateReceptors(role);
  const canManage = canManageReceptors(role);

  const page = resolvePage(sp.page);
  const pageSize = resolvePageSize(sp.size);
  const q = (sp.q ?? "").trim();
  const status = (sp.status ?? "").trim(); // "" (all) | "active" | "inactive"
  // Strip PostgREST filter metacharacters from free text before interpolating.
  const safeQ = q.replace(/[,()*]/g, " ").trim();

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("receptors")
    .select(
      "id, name, external_id, patient_type, phone, email, notes, active, created_at",
      { count: "exact" }
    )
    .order("name")
    .range(from, to);

  if (safeQ) query = query.or(`name.ilike.%${safeQ}%,external_id.ilike.%${safeQ}%,email.ilike.%${safeQ}%`);
  if (status === "active") query = query.eq("active", true);
  else if (status === "inactive") query = query.eq("active", false);

  const { data, count } = await query;

  return (
    <ReceptorsPage
      receptors={data ?? []}
      count={count ?? 0}
      page={page}
      pageSize={pageSize}
      q={q}
      status={status}
      canCreate={canCreate}
      canManage={canManage}
    />
  );
}
