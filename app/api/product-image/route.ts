import { officialProducts } from "@/data/official-products";

const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
  "X-Content-Type-Options": "nosniff",
};

function ogImageFromHtml(html: string, pageUrl: string) {
  const tag = html.match(/<meta\\b[^>]*(?:property|name)=["']og:image(?::secure_url)?["'][^>]*>/i)?.[0];
  const content = tag?.match(/\\bcontent=["']([^"']+)["']/i)?.[1];
  if (!content) return null;

  try {
    const image = new URL(content, pageUrl);
    return image.protocol === "https:" ? image.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Returns only a manufacturer-provided Open Graph image for a catalog product.
 * The client supplies an ID, never an arbitrary URL, which prevents this route
 * from acting as an open proxy or SSRF primitive.
 */
export async function GET(request: Request) {
  const productId = new URL(request.url).searchParams.get("productId") ?? "";
  const product = officialProducts.find((item) => item.id === productId);
  if (!product) return new Response(null, { status: 404, headers: CACHE_HEADERS });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(product.officialUrl, {
      headers: { Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: controller.signal,
    });
    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (!response.ok || (contentLength && contentLength > 500_000)) {
      return new Response(null, { status: 404, headers: CACHE_HEADERS });
    }

    const imageUrl = ogImageFromHtml(await response.text(), product.officialUrl);
    if (!imageUrl) return new Response(null, { status: 404, headers: CACHE_HEADERS });

    const redirect = Response.redirect(imageUrl, 302);
    for (const [key, value] of Object.entries(CACHE_HEADERS)) redirect.headers.set(key, value);
    return redirect;
  } catch {
    return new Response(null, { status: 404, headers: CACHE_HEADERS });
  } finally {
    clearTimeout(timer);
  }
}
