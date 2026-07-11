import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getProductDetail } from "@/lib/predictive/detail";
import { ProductDetailPage } from "@/components/predictive/ProductDetailPage";

export default async function ProductDetailServerPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const detail = await getProductDetail(supabase, productId);
  if (!detail) notFound();

  return <ProductDetailPage detail={detail} />;
}
