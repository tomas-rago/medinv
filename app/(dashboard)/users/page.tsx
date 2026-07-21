import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { UsersPage } from "@/components/users/UsersPage";
import { resolvePage, resolvePageSize } from "@/lib/pagination";

export default async function UsersServerPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; size?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const isAdmin = user.app_metadata?.role === "chief_doctor";

  const page = resolvePage(sp.page);
  const pageSize = resolvePageSize(sp.size);
  const q = (sp.q ?? "").trim();
  // Strip PostgREST filter metacharacters from free text before interpolating.
  const safeQ = q.replace(/[,()*]/g, " ").trim();

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("profiles")
    .select("id, full_name, role, active, created_at", { count: "exact" })
    .order("created_at")
    .range(from, to);

  if (safeQ) query = query.ilike("full_name", `%${safeQ}%`);

  const { data: profiles, count } = await query;

  return (
    <UsersPage
      profiles={profiles ?? []}
      count={count ?? 0}
      page={page}
      pageSize={pageSize}
      q={q}
      isAdmin={isAdmin}
    />
  );
}
