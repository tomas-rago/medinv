import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { canWriteInventory } from "@/lib/constants/roles";
import { ProductsPage } from "@/components/products/ProductsPage";
import { resolvePage, resolvePageSize } from "@/lib/pagination";

export default async function ProductsServerPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; size?: string; q?: string; category?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const canWrite = canWriteInventory(user.app_metadata?.role as string);

  const page = resolvePage(sp.page);
  const pageSize = resolvePageSize(sp.size);
  const q = (sp.q ?? "").trim();
  const category = (sp.category ?? "").trim();
  const status = (sp.status ?? "").trim(); // "" (all) | "active" | "inactive"
  // Strip PostgREST filter metacharacters from free text before interpolating.
  const safeQ = q.replace(/[,()*]/g, " ").trim();

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("products")
    .select("id, name, ean, presentation, category, criticality, unit, description, active, created_at", { count: "exact" })
    .order("name")
    .range(from, to);

  if (safeQ) query = query.or(`name.ilike.%${safeQ}%,ean.ilike.%${safeQ}%`);
  if (category) query = query.eq("category", category);
  if (status === "active") query = query.eq("active", true);
  else if (status === "inactive") query = query.eq("active", false);

  const { data: products, count } = await query;

  return (
    <ProductsPage
      products={products ?? []}
      count={count ?? 0}
      page={page}
      pageSize={pageSize}
      q={q}
      category={category}
      status={status}
      canWrite={canWrite}
    />
  );
}
