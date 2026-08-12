import { officialProducts } from "@/data/official-products";
import { reviewEvidenceForProduct } from "@/server/review-evidence";

export async function GET(request: Request) {
  const productId = new URL(request.url).searchParams.get("productId") ?? "";
  const product = officialProducts.find((item) => item.id === productId);
  if (!product) return Response.json({ error: "商品が見つかりません。" }, { status: 404 });

  const evidence = await reviewEvidenceForProduct(product);
  return Response.json(
    { review: evidence.review, links: evidence.links },
    { headers: { "Cache-Control": evidence.review.status === "available" ? "public, s-maxage=21600, stale-while-revalidate=86400" : "public, max-age=900" } },
  );
}
