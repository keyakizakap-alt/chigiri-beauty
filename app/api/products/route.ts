import { brandMarkets, officialProducts } from "@/data/official-products";

/**
 * 商品カタログはリポジトリ内の公式確認済みデータが唯一の出典。
 *
 * 以前はこれをD1へ書き写してから読み戻していたが、
 * - 1回あたり14列×12件＝168個のプレースホルダになり、D1のバインド上限を超えて
 *   毎回失敗し、実際には常に静的データへフォールバックしていた
 * - `onConflictDoNothing` のため、一度書けたとしても `data/official-products.ts`
 *   の更新がD1側へ反映されず、古い内容を返し続ける
 * - 提案の根拠（rankOfficialProducts・チャット・口コミ照会）はいずれも静的配列を
 *   直接読んでおり、D1側の写しは誰も参照していない
 * という理由から、書き写しをやめて静的データをそのまま返す。
 */
export function GET() {
  return Response.json({
    products: officialProducts.map((product) => ({
      ...product,
      market: brandMarkets[product.brand] ?? null,
    })),
    dataMode: "official-verified-static",
  }, { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } });
}
