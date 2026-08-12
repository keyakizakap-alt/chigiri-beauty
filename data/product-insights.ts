import type { ProductCategory, VerifiedProduct } from "./official-products";

export type IngredientNote = {
  name: string;
  role: string;
};

export type ProductInsight = {
  ingredientNotes: IngredientNote[];
  checkPoints: string[];
  firstCheck: string;
  nextCheck: string;
  timingNote: string;
};

const categoryChecks: Record<ProductCategory, string[]> = {
  cleanser: ["洗顔直後のつっぱりや赤み", "すすいだ後のぬるつき", "使い始めた時期と不調の重なり"],
  lotion: ["塗った直後の刺激感", "時間がたった後の乾燥・ベタつき", "香りやエタノールを含む製品との重ね使い"],
  serum: ["塗った直後の刺激感", "同時に使い始めた美容液や角質ケア", "使用頻度を下げたときの変化"],
  moisturizer: ["塗った後のムレ・ベタつき", "乾燥する部分と皮脂が出る部分の違い", "朝と夜で量を変えたときの使用感"],
  sunscreen: ["目まわりのしみやすさ", "乾燥・きしみ・白浮き", "落とし方との組み合わせ"],
  hair_shampoo: ["洗った直後の頭皮のつっぱり・かゆみ", "翌日のベタつき", "洗浄料の量とすすぎ時間"],
  hair_treatment: ["毛先の重さ・乾きにくさ", "頭皮についたときの違和感", "乾かした直後と翌朝のまとまり"],
  scalp_care: ["塗布直後の刺激や清涼感", "フケ・かゆみが出るタイミング", "カラーや整髪料を使った日との重なり"],
  body_moisturizer: ["塗布後のベタつき・かゆみ", "衣類が触れる部位との違い", "入浴後すぐ塗った場合の使用感"],
  body_uv: ["乾燥・きしみ・白残り", "汗をかいた後の刺激感", "落とし方と塗り直しの負担"],
  makeup_base: ["時間がたった後の乾燥・テカリ", "ファンデーションとの相性", "落とした後の違和感"],
  face_powder: ["粉っぽさ・乾燥", "皮脂が出る部分との仕上がり差", "ブラシやパフの清潔さ"],
  lip_color: ["唇の乾燥・皮むけ", "香りや清涼感", "食事後と塗り直し後の状態"],
  nail_oil: ["爪まわりの刺激・赤み", "香りの強さ", "塗った後の作業のしにくさ"],
  nail_color: ["爪表面の乾燥・変色", "除光液を使う頻度", "塗布中のにおいや刺激"],
  hand_cream: ["手洗い後の刺激感", "ベタつきと保湿感のバランス", "指先・手の甲での使用感の違い"],
  cuticle_care: ["甘皮まわりの刺激・赤み", "使用量とこする強さ", "ささくれや傷がある状態で使っていないか"],
};

const observationWindows: Record<ProductCategory, Pick<ProductInsight, "firstCheck" | "nextCheck" | "timingNote">> = {
  cleanser: { firstCheck: "当日〜3日", nextCheck: "1〜2週間", timingNote: "洗い上がりはすぐ、乾燥やベタつきとの相性は朝晩の使用を続けて確認します。" },
  lotion: { firstCheck: "当日〜7日", nextCheck: "2〜4週間", timingNote: "うるおい感は早めに、毎日のケアとの相性は肌状態が安定した期間で見ます。" },
  serum: { firstCheck: "1〜2週間", nextCheck: "4〜8週間", timingNote: "使用感と刺激の有無を先に確認し、見た目の変化は急いで判断しません。" },
  moisturizer: { firstCheck: "当日〜7日", nextCheck: "2〜4週間", timingNote: "塗った後の快適さは当日、乾燥しやすい時間帯の変化は数週間で振り返ります。" },
  sunscreen: { firstCheck: "初回〜7日", nextCheck: "2週間", timingNote: "仕上がり・落としやすさ・塗り直しやすさを日常の外出で確認します。" },
  hair_shampoo: { firstCheck: "初回〜7日", nextCheck: "2〜4週間", timingNote: "洗い上がりと翌日の頭皮・髪の状態を分けて見ます。" },
  hair_treatment: { firstCheck: "初回〜3日", nextCheck: "2〜4週間", timingNote: "手触りは早く分かりますが、熱や湿気がある日のまとまりも含めて判断します。" },
  scalp_care: { firstCheck: "3〜7日", nextCheck: "2〜4週間", timingNote: "刺激や違和感を先に確認し、頭皮の快適さは生活リズムと合わせて見ます。" },
  body_moisturizer: { firstCheck: "当日〜7日", nextCheck: "2〜4週間", timingNote: "入浴後の快適さは早めに、粉ふきやざらつきは部位ごとに数週間で確認します。" },
  body_uv: { firstCheck: "初回〜7日", nextCheck: "2週間", timingNote: "塗りやすさ・汗との相性・落としやすさを外出日に確認します。" },
  makeup_base: { firstCheck: "初回", nextCheck: "3〜7回の使用", timingNote: "仕上がりは当日、天気や一緒に使うベースメイクを変えて再現性を見ます。" },
  face_powder: { firstCheck: "初回", nextCheck: "3〜7回の使用", timingNote: "塗布直後と夕方の仕上がりを比べ、肌状態が違う日も確認します。" },
  lip_color: { firstCheck: "初回", nextCheck: "3〜7回の使用", timingNote: "色・乾燥・落ち方を、食事の有無も含めて確認します。" },
  nail_oil: { firstCheck: "当日〜7日", nextCheck: "4〜8週間", timingNote: "塗った直後の柔らかさと、爪が伸びる間の欠けやすさを分けて見ます。" },
  nail_color: { firstCheck: "初回〜7日", nextCheck: "2〜3回の付け替え", timingNote: "発色と持ちは初回、爪への負担は落とす工程まで含めて確認します。" },
  hand_cream: { firstCheck: "当日〜7日", nextCheck: "2〜4週間", timingNote: "手洗い後の快適さは早めに、乾燥や荒れやすさは生活の中で振り返ります。" },
  cuticle_care: { firstCheck: "当日〜7日", nextCheck: "2〜4週間", timingNote: "甘皮まわりの柔らかさと刺激の有無を先に確認し、無理に処理しません。" },
};

function ingredientRole(ingredient: string) {
  if (/ヒアルロン|セラミド|コラーゲン|アミノ酸|スクワラン|シア|オイル|油|グリセリン/.test(ingredient)) return "うるおいを保ち、乾燥を防ぐ目的で配合される成分";
  if (/グリチル|トラネキサム酸/.test(ingredient)) return ingredient.includes("有効成分") ? "医薬部外品の有効成分。効能は公式表示の範囲で確認" : "肌を整える目的で使われる成分";
  if (/ナイアシンアミド/.test(ingredient)) return ingredient.includes("有効成分") ? "医薬部外品の有効成分。商品ごとの承認効能を確認" : "保湿・整肌目的で使われる成分";
  if (/酸化亜鉛|酸化チタン/.test(ingredient)) return "紫外線を防ぐ粉体。仕上がりや乾燥感には個人差があります";
  if (/洗浄|ココイル|弱酸性/.test(ingredient)) return "汚れを落とす設計に関わる要素。洗浄力は処方全体で決まります";
  if (/シリカ|粉体|ミネラル/.test(ingredient)) return "仕上がりや皮脂吸着に関わる粉体";
  if (/植物|ツボクサ|ドクダミ|モモ|アロエ|プロポリス/.test(ingredient)) return "保湿・整肌目的の植物由来成分。植物由来でも相性には個人差があります";
  if (/ビタミン|グルタチオン|PDRN|発酵|培養/.test(ingredient)) return "商品が訴求する整肌・保湿成分。濃度や処方全体は商品情報で確認";
  if (/色持ち|被膜|酸素透過/.test(ingredient)) return "仕上がりや持続性に関わる処方技術";
  return "商品の特徴をつくる成分・処方要素。働きは処方全体で判断します";
}

export function productInsight(product: VerifiedProduct): ProductInsight {
  return {
    ingredientNotes: product.ingredientHighlights.map((name) => ({ name, role: ingredientRole(name) })),
    checkPoints: categoryChecks[product.category],
    ...observationWindows[product.category],
  };
}

export function productDifference(base: VerifiedProduct, candidate: VerifiedProduct) {
  const sameCategory = base.category === candidate.category;
  const priceDifference = base.price != null && candidate.price != null
    ? candidate.price - base.price
    : null;
  return {
    sameCategory,
    summary: sameCategory
      ? `${base.name}と同じ種類のアイテムとして、公式説明と注目成分の違いを比べています。`
      : `${base.name}とは役割が異なるため、置き換えではなく追加する必要があるかを比べます。`,
    priceDifference,
  };
}
