import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { canManageProviders } from "@/lib/constants/roles";
import { ProvidersPage } from "@/components/providers/ProvidersPage";
import { resolvePage, resolvePageSize } from "@/lib/pagination";

export default async function ProvidersServerPage({
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

  const canManage = canManageProviders(user.app_metadata?.role as string);
  if (!canManage) redirect("/products");

  const page = resolvePage(sp.page);
  const pageSize = resolvePageSize(sp.size);
  const q = (sp.q ?? "").trim();
  const status = (sp.status ?? "").trim(); // "" (all) | "active" | "inactive"
  // Strip PostgREST filter metacharacters from free text before interpolating.
  const safeQ = q.replace(/[,()*]/g, " ").trim();

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("providers")
    .select(
      "id, name, contact_name, email, phone, address, notes, active, created_at, provider_products(count)",
      { count: "exact" }
    )
    .order("name")
    .range(from, to);

  if (safeQ) query = query.or(`name.ilike.%${safeQ}%,contact_name.ilike.%${safeQ}%,email.ilike.%${safeQ}%`);
  if (status === "active") query = query.eq("active", true);
  else if (status === "inactive") query = query.eq("active", false);

  const { data, count } = await query;

  const providers = (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    contact_name: p.contact_name,
    email: p.email,
    phone: p.phone,
    address: p.address,
    notes: p.notes,
    active: p.active,
    created_at: p.created_at,
    product_count: p.provider_products[0]?.count ?? 0,
  }));

  return (
    <ProvidersPage
      providers={providers}
      count={count ?? 0}
      page={page}
      pageSize={pageSize}
      q={q}
      status={status}
      canManage={canManage}
    />
  );
}
