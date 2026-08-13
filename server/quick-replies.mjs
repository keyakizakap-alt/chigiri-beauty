/**
 * Quick replies must answer the question that is actually visible to the user.
 * Looking at the whole assistant response can match an earlier topic and show
 * unrelated choices, so matching is limited to the final question sentence.
 */

const commonRules = [
  { pattern: /使い方.*商品|商品.*使い方|公式製品候補/, replies: ["まず使い方を整えたい", "商品候補まで見たい", "手持ちだけで考えたい"] },
  { pattern: /軽さ.*しっとり|しっとり.*軽さ/, replies: ["軽い仕上がりが好き", "しっとり感を優先したい", "中間くらいが理想"] },
  { pattern: /朝.*夜|夜.*朝/, replies: ["朝を簡単にしたい", "夜に丁寧にケアしたい", "どちらも無理なく続けたい"] },
  { pattern: /手持ち.*(商品|製品|候補)|買い足し/, replies: ["手持ち中心で考えたい", "足りないものだけ追加したい", "商品候補も比較したい"] },
  { pattern: /予算|いくら|価格/, replies: ["3,000円以内", "5,000円以内", "価格より相性を優先"] },
  { pattern: /香り/, replies: ["無香料がいい", "控えめなら大丈夫", "香りも楽しみたい"] },
];

const specialistRules = {
  skin: [
    { pattern: /乾燥.*[べベ][たタ]つき.*刺激|いちばん気になる.*肌/, replies: ["乾燥・つっぱり", "ベタつき・毛穴", "刺激・赤みが気になる"] },
    { pattern: /つけた直後|感触/, replies: ["ベタつきが気になる", "つっぱりを感じる", "特に違和感はない"] },
    { pattern: /洗顔.*直後|日中|季節の変わり目|タイミング|どんな(とき|時)/, replies: ["洗顔後すぐ気になる", "日中に気になる", "季節の変わり目に出やすい"] },
    { pattern: /乾燥.*皮脂|皮脂.*乾燥|肌の状態/, replies: ["乾燥が気になる", "ベタつきが気になる", "両方気になる"] },
    { pattern: /紫外線|日焼け止め|UV/, replies: ["毎日使っている", "外出時だけ使う", "あまり使えていない"] },
  ],
  hair: [
    { pattern: /頭皮.*[べベ][たタ]つき.*乾燥.*かゆみ|頭皮で気になる/, replies: ["頭皮のベタつき", "頭皮の乾燥", "頭皮のかゆみ"] },
    { pattern: /手間.*仕上がり|仕上がり.*手間/, replies: ["手間を増やしたくない", "仕上がりを優先したい", "両方のバランスを取りたい"] },
    { pattern: /乾かした直後.*翌朝|翌朝.*乾かした直後/, replies: ["乾かした直後から広がる", "翌朝にまとまらない", "湿気のある日に強く出る"] },
    { pattern: /カラー.*アイロン|アイロン.*カラー|頻度/, replies: ["カラー月1回・アイロン毎朝", "カラーだけしている", "どちらもほとんどしない"] },
    { pattern: /まとまり.*手触り.*頭皮|優先/, replies: ["朝のまとまりを優先", "手触りを良くしたい", "頭皮の快適さを優先"] },
    { pattern: /手間.*夜|丁寧なケア/, replies: ["手間は増やしたくない", "夜なら1工程増やせる", "効果重視で丁寧にしたい"] },
  ],
  body: [
    { pattern: /乾燥.*ざらつき.*刺激|悩み.*近い/, replies: ["乾燥が気になる", "ざらつきが気になる", "刺激感が気になる"] },
    { pattern: /[べベ][たタ]つき.*保湿感.*香り|最優先/, replies: ["ベタつきにくさ", "保湿感", "無香料"] },
    { pattern: /どの部位|気になる(場所|部位)|全身.*ひじ|ひじ.*すね|かかと.*どこ/, replies: ["全身の乾燥", "ひじ・ひざのざらつき", "すね・かかとの乾燥"] },
    { pattern: /入浴後.*日中|日中.*入浴後/, replies: ["入浴後すぐ気になる", "日中に乾燥する", "どちらも気になる"] },
    { pattern: /続きにくい|べたつき.*手間|塗る場所/, replies: ["ベタつきが苦手", "塗る手間が負担", "置き場所を忘れやすい"] },
    { pattern: /全身.*短時間|部分.*丁寧/, replies: ["全身を短時間で済ませたい", "気になる部分を丁寧に", "日によって使い分けたい"] },
  ],
  makeup: [
    { pattern: /パーソナルカラー.*(診断済み|分かれば|わかれば|分からなければ|わからなければ)/, replies: ["イエベ系です", "ブルベ系です", "分からない"] },
    { pattern: /ベース.*目元.*リップ|どこ.*(変え|相談)/, replies: ["ベースメイク", "目元メイク", "リップ"] },
    { pattern: /普段.*仕事.*食事|ライブ|使う場面/, replies: ["普段・仕事用", "食事やお出かけ用", "ライブ・イベント用"] },
    { pattern: /テカリ.*乾燥.*色落ち|最初に気になる/, replies: ["テカリが気になる", "乾燥・粉っぽさが気になる", "色落ちが気になる"] },
    { pattern: /自然.*ツヤ.*きちんと|仕上がり/, replies: ["自然な仕上がり", "ツヤ感を出したい", "きちんと感を出したい"] },
    { pattern: /目元.*リップ|主役/, replies: ["目元を主役にしたい", "リップを主役にしたい", "全体をナチュラルに"] },
  ],
  nail: [
    { pattern: /爪の表面.*爪先|甘皮.*手肌|気になる.*どこ/, replies: ["爪先・表面", "甘皮・ささくれ", "手肌の乾燥"] },
    { pattern: /水仕事.*消毒|セルフネイル.*頻度|頻度/, replies: ["水仕事・消毒が多い", "セルフネイルをよくする", "どちらも少ない"] },
    { pattern: /爪の乾燥.*手肌|ネイルの持ち|優先/, replies: ["爪の乾燥・欠け", "手肌の保湿", "ネイルの持ち"] },
    { pattern: /日中.*夜|集中ケア/, replies: ["日中にこまめにケア", "夜にまとめてケア", "両方を使い分けたい"] },
  ],
};

const phaseReplies = {
  align: ["まず使い方を整えたい", "商品候補まで見たい", "手持ちだけで考えたい"],
  coach: ["この方法で試してみる", "もう少し簡単にしたい", "商品候補も見たい"],
  propose: ["この内容で試してみる", "予算を抑えて見直したい", "別の候補も見たい"],
};

function finalQuestion(text) {
  const questionEnd = Math.max(text.lastIndexOf("？"), text.lastIndexOf("?"));
  if (questionEnd < 0) return "";
  const before = text.slice(0, questionEnd);
  const previousBoundary = Math.max(
    before.lastIndexOf("。"),
    before.lastIndexOf("！"),
    before.lastIndexOf("!"),
    before.lastIndexOf("？"),
    before.lastIndexOf("?"),
    before.lastIndexOf("\n"),
  );
  return text.slice(previousBoundary + 1, questionEnd + 1).trim();
}

function choicesForQuestion(specialist, question) {
  if (!question) return [];
  const rules = [...(specialistRules[specialist] ?? []), ...commonRules];
  return rules.find((rule) => rule.pattern.test(question))?.replies ?? [];
}

/**
 * @param {"skin" | "hair" | "body" | "makeup" | "nail"} specialist
 * @param {string} assistantText
 * @param {"listen" | "understand" | "align" | "coach" | "propose" | "safety"} phase
 * @param {string} expectedQuestion
 */
export function suggestedRepliesForQuestion(specialist, assistantText, phase) {
  if (phase === "safety") return [];

  const visibleQuestion = finalQuestion(assistantText);
  if (!visibleQuestion) return phaseReplies[phase] ?? [];

  const visibleChoices = choicesForQuestion(specialist, visibleQuestion);
  if (visibleChoices.length) return visibleChoices;
  return [];
}

export { finalQuestion };
