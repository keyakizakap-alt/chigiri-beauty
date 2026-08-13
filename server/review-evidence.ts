import type { VerifiedProduct } from "../data/official-products";

export type ReviewSnapshot = {
  status: "available" | "links_only" | "unavailable";
  source: "楽天市場";
  average: number | null;
  count: number | null;
  reviewUrl: string;
  itemUrl: string;
  checkedAt: string;
};

export type ProductReviewEvidence = {
  productId: string;
  review: ReviewSnapshot;
  links: ReviewLinks;
};

export type ReviewLinks = {
  rakuten: string;
  cosme: string;
  lips: string;
  qoo10: string;
  amazon: string;
};

export function publicReviewLinks(product: VerifiedProduct) {
  const keyword = encodeURIComponent(`${product.brand} ${product.name}`);
  return {
    rakuten: `https://search.rakuten.co.jp/search/mall/${keyword}/`,
    cosme: `https://www.cosme.net/search/?fw=${keyword}`,
    lips: `https://lipscosme.com/search?text=${keyword}`,
    qoo10: `https://www.qoo10.jp/s/${keyword}?keyword=${keyword}`,
    amazon: `https://www.amazon.co.jp/s?k=${keyword}`,
  };
}

function findFirstObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstObject(item);
      if (found && ("itemName" in found || "reviewAverage" in found)) return found;
    }
    return null;
  }
  const record = value as Record<string, unknown>;
  if ("itemName" in record || "reviewAverage" in record) return record;
  for (const child of Object.values(record)) {
    const found = findFirstObject(child);
    if (found) return found;
  }
  return null;
}

function normalizedProductName(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("ja-JP").replace(/[^\p{L}\p{N}]/gu, "");
}

function safeRakutenUrl(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  try {
    const url = new URL(value);
    const allowedHost = url.hostname === "rakuten.co.jp"
      || url.hostname.endsWith(".rakuten.co.jp")
      || url.hostname === "rakuten.com"
      || url.hostname.endsWith(".rakuten.com");
    return url.protocol === "https:" && allowedHost ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

export async function reviewEvidenceForProduct(product: VerifiedProduct): Promise<ProductReviewEvidence> {
  const links = publicReviewLinks(product);
  const checkedAt = new Date().toISOString();
  const applicationId = process.env.RAKUTEN_APPLICATION_ID;
  const accessKey = process.env.RAKUTEN_ACCESS_KEY;
  if (!applicationId || !accessKey) {
    return {
      productId: product.id,
      review: { status: "links_only", source: "楽天市場", average: null, count: null, reviewUrl: links.rakuten, itemUrl: links.rakuten, checkedAt },
      links,
    };
  }

  const endpoint = new URL("https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701");
  endpoint.searchParams.set("applicationId", applicationId);
  endpoint.searchParams.set("accessKey", accessKey);
  endpoint.searchParams.set("keyword", `${product.brand} ${product.name}`);
  endpoint.searchParams.set("hits", "1");
  endpoint.searchParams.set("format", "json");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);

  try {
    const response = await fetch(endpoint, { signal: controller.signal });
    if (!response.ok) throw new Error("review source unavailable");
    const item = findFirstObject(await response.json() as unknown);
    const itemName = typeof item?.itemName === "string" ? item.itemName : "";
    const matchedProduct = normalizedProductName(itemName).includes(normalizedProductName(product.name));
    const rawAverage = typeof item?.reviewAverage === "number" ? item.reviewAverage : Number(item?.reviewAverage);
    const rawCount = typeof item?.reviewCount === "number" ? item.reviewCount : Number(item?.reviewCount);
    const average = matchedProduct && Number.isFinite(rawAverage) && rawAverage >= 0 && rawAverage <= 5 ? rawAverage : null;
    const count = matchedProduct && Number.isFinite(rawCount) && rawCount >= 0 ? Math.trunc(rawCount) : null;
    const itemUrl = safeRakutenUrl(item?.itemUrl, links.rakuten);
    const reviewUrl = safeRakutenUrl(item?.reviewUrl, itemUrl);
    return {
      productId: product.id,
      review: {
        status: average != null || count != null ? "available" : "links_only",
        source: "楽天市場",
        average,
        count,
        reviewUrl,
        itemUrl,
        checkedAt,
      },
      links,
    };
  } catch {
    return {
      productId: product.id,
      review: { status: "unavailable", source: "楽天市場", average: null, count: null, reviewUrl: links.rakuten, itemUrl: links.rakuten, checkedAt },
      links,
    };
  } finally {
    clearTimeout(timeout);
  }
}
