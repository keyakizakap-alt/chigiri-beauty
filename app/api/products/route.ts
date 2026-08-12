import { getDb } from "@/db";
import { products } from "@/db/schema";
import { brandMarkets, officialProducts } from "@/data/official-products";
import { asc } from "drizzle-orm";

function toDbProduct(product: (typeof officialProducts)[number]) {
  return {
      id: product.id,
      brand: product.brand,
      name: product.name,
      category: product.category,
      volume: product.volume,
      price: product.price,
      priceType: product.priceType,
      currency: product.currency,
      claimsJson: JSON.stringify(product.claims),
      ingredientHighlightsJson: JSON.stringify(product.ingredientHighlights),
      officialUrl: product.officialUrl,
      sourcePublisher: product.sourcePublisher,
      sourceCheckedAt: product.sourceCheckedAt,
      verificationStatus: product.verificationStatus,
  };
}

// カタログの同期は参照のたびに走らせない。1インスタンスにつき一度だけ行い、
// 失敗したら次のリクエストで再試行できるようにする。
let catalogSynced: Promise<void> | null = null;

async function syncOfficialCatalog(db: Awaited<ReturnType<typeof getDb>>) {
  if (!catalogSynced) {
    catalogSynced = (async () => {
      const batchSize = 12;
      for (let index = 0; index < officialProducts.length; index += batchSize) {
        await db
          .insert(products)
          .values(officialProducts.slice(index, index + batchSize).map(toDbProduct))
          .onConflictDoNothing();
      }
    })().catch((error) => {
      catalogSynced = null;
      throw error;
    });
  }
  await catalogSynced;
}

export async function GET() {
  try {
    const db = await getDb();
    await syncOfficialCatalog(db);
    const rows = await db.select().from(products).orderBy(asc(products.brand), asc(products.name));
    return Response.json({
      products: rows.map((row) => ({
        ...row,
        claims: JSON.parse(row.claimsJson),
        ingredientHighlights: JSON.parse(row.ingredientHighlightsJson),
        market: brandMarkets[row.brand] ?? null,
      })),
      dataMode: "d1-official-verified",
    });
  } catch {
    return Response.json({
      products: officialProducts.map((product) => ({
        ...product,
        market: brandMarkets[product.brand] ?? null,
      })),
      dataMode: "official-verified-static",
    });
  }
}
