/**
 * 主要20商品の公式商品画像。ブランド／メーカー公式ページに掲載された
 * URLだけを固定し、実行時のHTML解析や任意URLのプロキシは行わない。
 */
export const officialProductImages = {
  "rohto-gokujun-lotion": "https://jp.rohto.com/-/media/com/hadalabo/gokujun-lotion/img_155712_01.jpg?sc_lang=ja-jp",
  "kao-curel-face-cream": "https://kao-h.assetsadobe3.com/is/image/content/dam/sites/kao/www-kao-kirei-com/jp/ja/item/kbb/curel/25417079/GG01.jpg",
  "torriden-divein-serum": "https://torriden.jp/cdn/shop/files/1a35ad8effd962812b073e447e9ca622_LQYTuK6d_bb0fb98d07802e43ea458ee4e77041f012722cbc.jpg?v=1757046063&width=1000",
  "fancl-washing-powder": "https://www.fancl.co.jp/ItemImages/large/3733a.jpg",
  "essential-premium-barrier-silky-shampoo": "https://kao-h.assetsadobe3.com/is/image/content/dam/sites/kao/www-kao-kirei-com/jp/ja/item/khg/essential/25502904/GG01.jpg",
  "minon-medicated-hair-shampoo": "https://www.daiichisankyo-hc.co.jp/library/content/img_library/image/minon_shampoo_8C110_main.jpg",
  "curel-scalp-moisture-lotion": "https://kao-h.assetsadobe3.com/is/image/content/dam/sites/kao/www-kao-kirei-com/jp/ja/item/kbb/curel/25941033/GG01.jpg",
  "tsubaki-premium-ex-repair-mask": "https://brand.finetoday.com/jp/tsubaki/assets/img/menu_special_img1.png",
  "minon-whole-body-moisturizing-milk": "https://www.daiichisankyo-hc.co.jp/site_minon-body/assets/img/product/ds/img_moisturizer_milk_400.png",
  "muji-sensitive-body-milk": "https://www.muji.com/public/media/img/item/4550584935824_org.jpg?im=Resize%2Ctype%3Ddownsize%2Cwidth%3D3840",
  "nivea-lucent-beauty-silk-brightening": "https://img.nivea.com/-/media/miscellaneous/media-center-items/5/2/5/019f5a2d828b74ba9522591437ec0866-original.png",
  "curel-body-lotion": "https://kao-h.assetsadobe3.com/is/image/content/dam/sites/kao/www-kao-kirei-com/jp/ja/item/kbb/curel/25430903/GG01.jpg",
  "canmake-marshmallow-finish-powder": "https://www.canmake.com/wp-content/uploads/2025/08/A03_62_colMO_chip_01.jpg",
  "cezanne-lasting-gloss-lip-n": "https://www.cezanne.co.jp/uploads/lineup/4939553530497/img1_101.png",
  "kate-lip-monster": "https://kao-h.assetsadobe3.com/is/image/content/dam/sites/kanebo/www-nomorerules-net/all_products/lip/lip-lip_monster-thumb-m-251120.png?fmt=png-alpha",
  "maquillage-skin-sensor-base-neo": "https://maquillage.shiseido.co.jp/features/dramatic-skin-sensor-base-neo/img/finish__content__pkg__thumb_01.webp",
  "uka-nail-oil-2445": "https://uka.co.jp/_nuxt/image/8ccc34.jpg",
  "muji-nail-care-oil": "https://www.muji.com/public/media/img/item/4550583916923_org.jpg?im=Resize%2Ctype%3Ddownsize%2Cwidth%3D3840",
  "nailholic-247": "https://www.kose.co.jp/nailholic/twentyfour_seven/_assets/img/items_01_bottles.png",
  "atrix-beauty-charge-night-superior": "https://kao-h.assetsadobe3.com/is/image/content/dam/sites/kao/www-kao-kirei-com/jp/ja/item/khg/atrix/25339586/GG01.jpg",
} as const;

export type OfficialImageProductId = keyof typeof officialProductImages;

export function officialProductImage(productId: string) {
  return officialProductImages[productId as OfficialImageProductId] ?? undefined;
}

export const featuredOfficialImageProductIds = Object.keys(officialProductImages) as OfficialImageProductId[];
