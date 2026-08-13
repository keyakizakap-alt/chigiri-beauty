/**
 * 会話から「ユーザーが明示した条件」だけを抽出する軽量なメモリ層。
 * 推測で属性を補わず、回答済みの質問を繰り返さないために使う。
 */

/** @typedef {"skin" | "hair" | "body" | "makeup" | "nail"} SpecialistId */

const rules = {
  skin: [
    { key: "concern", pattern: /乾燥|つっぱ|粉っぽ|べたつ|皮脂|毛穴|赤み|刺激/, fact: "肌の気になる状態が具体的" },
    { key: "timing", pattern: /洗顔後|朝|夜|日中|季節|生理|入浴後/, fact: "気になるタイミングが分かっている" },
    { key: "preference", pattern: /軽い|しっとり|べたつか|時短|手間|予算|無香料|香り/, fact: "使用感や続け方の希望がある" },
  ],
  hair: [
    { key: "concern", pattern: /広が|パサ|うねり|べたつ|フケ|かゆ|ダメージ|まとま/, fact: "髪・頭皮の悩みが具体的" },
    { key: "scalpState", pattern: /頭皮.{0,12}([べベ][たタ]つ|乾燥|かゆ|フケ)|([べベ][たタ]つ|乾燥|かゆ|フケ).{0,12}頭皮/, fact: "頭皮で気になる状態が分かっている" },
    { key: "routine", pattern: /カラー|ブリーチ|アイロン|コテ|ドライヤー|毎朝|週\s*\d|月\s*\d/, fact: "カラーや熱の習慣が分かっている" },
    { key: "preference", pattern: /軽い仕上がり|しっとり|手触りを.{0,6}(重視|優先)|まとまりを.{0,6}(重視|優先)|時短|手間|予算|香り|仕上がりを優先/, fact: "仕上がりや手間の希望がある" },
  ],
  body: [
    { key: "area", pattern: /全身|首|デコルテ|腕|ひじ|肘|手の甲|背中|お腹|脚|すね|膝|ひざ|かかと|足/, fact: "気になる部位が分かっている" },
    { key: "concern", pattern: /乾燥|かさつ|粉|ざらつ|ごわつ|べたつ|日焼け|紫外線|ムダ毛|におい/, fact: "ボディの悩みが具体的" },
    { key: "timing", pattern: /入浴後|お風呂上がり|朝|夜|日中|季節|毎日|週\s*\d/, fact: "気になる時間やケア頻度が分かっている" },
    { key: "preference", pattern: /[べベ][たタ]つか|さらさら|しっとり|時短|短時間|手間|無香料|香り|予算/, fact: "使用感・香り・手間の希望がある" },
  ],
  makeup: [
    { key: "focus", pattern: /下地|ファンデ|ファンデーション|コンシーラー|パウダー|眉|アイシャドウ|アイライン|マスカラ|チーク|リップ|口紅|ベースメイク|アイメイク/, fact: "相談したいメイク箇所が分かっている" },
    { key: "scene", pattern: /普段|仕事|オフィス|食事|デート|お出かけ|ライブ|イベント|写真|結婚式|学校/, fact: "使う場面が分かっている" },
    { key: "issue", pattern: /崩れ|テカリ|皮脂|よれ|乾燥|粉っぽ|色落ち|にじみ|くすみ/, fact: "今困っている崩れ方が分かっている" },
    { key: "finish", pattern: /ナチュラル|自然|ツヤ|マット|きちんと|華やか|透明感|血色|韓国|アイドル/, fact: "なりたい仕上がりが分かっている" },
    { key: "personalColor", pattern: /イエベ|ブルベ|春タイプ|スプリング|夏タイプ|サマー|秋タイプ|オータム|冬タイプ|ウィンター|パーソナルカラー.{0,12}(分から|わから|不明|未診断|診断していない)/, fact: "本人が伝えたパーソナルカラー情報がある" },
    { key: "preference", pattern: /手持ち|買い足し|予算|円|時短|簡単|香り|刺激/, fact: "手持ち・予算・使い方の希望がある" },
  ],
  nail: [
    { key: "area", pattern: /爪先|爪の先|爪表面|爪の表面|甘皮|ささくれ|手肌|手の甲|指先|ハンド/, fact: "爪・手肌の気になる場所が分かっている" },
    { key: "concern", pattern: /乾燥|割れ|欠け|二枚爪|縦筋|ささくれ|手荒れ|はがれ|持ち|黄ばみ/, fact: "爪・手肌の悩みが具体的" },
    { key: "exposure", pattern: /水仕事|手洗い|消毒|アルコール|ジェル|ポリッシュ|除光液|アセトン|セルフネイル|サロン/, fact: "水仕事やネイル習慣が分かっている" },
    { key: "preference", pattern: /日中|夜|こまめ|時短|[べベ][たタ]つか|香り|色|予算|持ち/, fact: "ケアの時間・使用感・仕上がりの希望がある" },
  ],
};

const questions = {
  skin: [
    ["concern", "今いちばん気になるのは、乾燥・ベタつき・刺激感のどれに近いですか？"],
    ["timing", "どんなときにそうなりますか？"],
    ["preference", "仕上がりは、軽さとしっとり感のどちらを優先したいですか？"],
  ],
  hair: [
    ["concern", "いちばん変えたいのは、まとまり・手触り・頭皮の快適さのどれですか？"],
    ["scalpState", "頭皮で気になるのは、ベタつき・乾燥・かゆみのどれですか？"],
    ["routine", "カラーやアイロンは、普段どのくらい使いますか？"],
    ["preference", "手間を増やさないことと仕上がりなら、どちらを優先したいですか？"],
  ],
  body: [
    ["area", "どの部位がいちばん気になりますか？ 全身ではなく一部なら、その場所を教えてください。"],
    ["concern", "その部位は、乾燥・ざらつき・刺激感のどれがいちばん近いですか？"],
    ["timing", "気になるのは入浴後すぐと日中のどちらですか？"],
    ["preference", "ベタつきにくさ・保湿感・香りなしのうち、最優先はどれですか？"],
  ],
  makeup: [
    ["focus", "まず変えたいのは、ベース・目元・リップのどこですか？"],
    ["scene", "使う場面は、普段・仕事・食事・ライブのどれに近いですか？"],
    ["issue", "今のメイクで最初に気になるのは、テカリ・乾燥・色落ちのどれですか？"],
    ["finish", "仕上がりは、自然・ツヤ・きちんと感のどこへ寄せたいですか？"],
  ],
  nail: [
    ["area", "気になるのは、爪先・甘皮まわり・手肌のどこですか？"],
    ["concern", "いちばん困っているのは、乾燥・欠け・手荒れ・ネイルの持ちのどれですか？"],
    ["exposure", "水仕事・消毒・ジェルや除光液は、普段どのくらいありますか？"],
    ["preference", "日中の軽いケアと夜の集中ケアなら、どちらが続けやすいですか？"],
  ],
};

function normalize(value) {
  return value.normalize("NFKC").toLocaleLowerCase("ja-JP");
}

/**
 * 商品提案や使い方の依頼を、直前の質問への回答として誤って保存しない。
 * 「お願いします」単独も、直前の提案を承諾する発話として扱う。
 */
export function isDirectiveRequest(input) {
  const source = normalize(input).trim();
  return /^(お願い|お願いします|それでお願い|それでお願いします|見たい|それを見たい)[。！!？?]*$/.test(source)
    || /(商品|製品|アイテム|コスメ|ケア用品).{0,16}(候補|提案|おすすめ|選ん|教えて|見たい|出して|お願い)/.test(source)
    || /(候補|おすすめ).{0,12}(お願い|提案|教えて|見たい|出して|選ん)/.test(source)
    || /(使い方|手順|方法).{0,12}(お願い|教えて|知りたい|見たい|整え|見直)/.test(source)
    || /^(まず)?(手持ち|今あるもの).{0,12}(だけ|中心).{0,12}(考え|使|組|見直)/.test(source);
}

function addFact(facts, source, pattern, text) {
  if (pattern.test(source) && !facts.includes(text)) facts.push(text);
}

function describeKnownFacts(specialist, source, fallbackFacts) {
  const facts = [];
  if (specialist === "skin") {
    addFact(facts, source, /乾燥/, "乾燥が気になる");
    addFact(facts, source, /つっぱ|張る|張って/, "肌のつっぱり・張る感じがある");
    addFact(facts, source, /粉っぽ|粉をふ/, "粉っぽさが気になる");
    addFact(facts, source, /[べベ][たタ]つ|皮脂/, "ベタつき・皮脂が気になる");
    addFact(facts, source, /毛穴/, "毛穴が気になる");
    addFact(facts, source, /赤み/, "赤みが気になる");
    addFact(facts, source, /刺激|ヒリつ|ぴりつ|ピリつ/, "刺激感が気になる");
    addFact(facts, source, /洗顔後|洗顔直後/, "洗顔後に気になりやすい");
    addFact(facts, source, /日中/, "日中に気になりやすい");
    addFact(facts, source, /朝/, "朝に気になりやすい");
    addFact(facts, source, /夜/, "夜に気になりやすい");
    addFact(facts, source, /季節の変わり目/, "季節の変わり目に気になりやすい");
  } else if (specialist === "hair") {
    addFact(facts, source, /広が|まとまら/, "髪の広がり・まとまりにくさが気になる");
    addFact(facts, source, /パサ|乾燥/, "髪のパサつき・乾燥が気になる");
    addFact(facts, source, /うねり/, "髪のうねりが気になる");
    addFact(facts, source, /[べベ][たタ]つ|皮脂/, "頭皮のベタつきが気になる");
    addFact(facts, source, /フケ/, "フケが気になる");
    addFact(facts, source, /かゆ/, "頭皮のかゆみが気になる");
    addFact(facts, source, /カラー|ブリーチ/, "カラー・ブリーチの習慣がある");
    addFact(facts, source, /アイロン|コテ/, "アイロン・コテを使う");
    addFact(facts, source, /時短|手間を増やしたくない/, "手間を増やさないケアを希望");
    addFact(facts, source, /手触り/, "手触りを重視");
  } else if (specialist === "makeup") {
    addFact(facts, source, /リップ|口紅/, "リップを探している");
    addFact(facts, source, /下地|ファンデ|ファンデーション|コンシーラー|パウダー|ベースメイク/, "ベースメイクを相談したい");
    addFact(facts, source, /眉|アイシャドウ|アイライン|マスカラ|アイメイク/, "目元のメイクを相談したい");
    addFact(facts, source, /ライブ|イベント/, "ライブ・イベント用");
    addFact(facts, source, /仕事|オフィス/, "仕事用");
    addFact(facts, source, /食事|デート|お出かけ/, "食事・お出かけ用");
    addFact(facts, source, /色落ち/, "色落ちしにくさを重視");
    addFact(facts, source, /テカリ|皮脂|よれ|崩れ/, "崩れにくさを重視");
    addFact(facts, source, /乾燥|粉っぽ/, "乾燥・粉っぽさが気になる");
    addFact(facts, source, /ツヤ/, "ツヤ仕上げが好み");
    addFact(facts, source, /ナチュラル|自然/, "自然な仕上がりが好み");
    addFact(facts, source, /マット/, "マット仕上げが好み");
    addFact(facts, source, /イエベ.{0,4}春|春タイプ|スプリング/, "パーソナルカラーはイエベ春（本人申告）");
    addFact(facts, source, /ブルベ.{0,4}夏|夏タイプ|サマー/, "パーソナルカラーはブルベ夏（本人申告）");
    addFact(facts, source, /イエベ.{0,4}秋|秋タイプ|オータム/, "パーソナルカラーはイエベ秋（本人申告）");
    addFact(facts, source, /ブルベ.{0,4}冬|冬タイプ|ウィンター/, "パーソナルカラーはブルベ冬（本人申告）");
    addFact(facts, source, /パーソナルカラー.{0,12}(分から|わから|不明|未診断)|診断していない/, "パーソナルカラーは分からない（写真から推測しない）");
  } else if (specialist === "body") {
    addFact(facts, source, /全身/, "全身のケア");
    addFact(facts, source, /すね/, "すねのケア");
    addFact(facts, source, /ひじ|肘|膝|ひざ/, "ひじ・ひざのケア");
    addFact(facts, source, /かかと|足/, "かかと・足のケア");
    addFact(facts, source, /首|デコルテ/, "首・デコルテのケア");
    addFact(facts, source, /乾燥|かさつ|粉/, "乾燥が気になる");
    addFact(facts, source, /ざらつ|ごわつ/, "ざらつきが気になる");
    addFact(facts, source, /入浴後|お風呂上がり/, "入浴後に気になりやすい");
    addFact(facts, source, /[べベ][たタ]つか|さらさら/, "ベタつきにくい使用感を希望");
    addFact(facts, source, /無香料|香りなし/, "香りなしを希望");
  } else if (specialist === "nail") {
    addFact(facts, source, /爪先|爪の先|爪表面|爪の表面/, "爪先・表面のケア");
    addFact(facts, source, /甘皮|ささくれ/, "甘皮まわりのケア");
    addFact(facts, source, /手肌|手の甲|指先|ハンド/, "手肌のケア");
    addFact(facts, source, /割れ|欠け|二枚爪/, "割れ・欠けが気になる");
    addFact(facts, source, /乾燥/, "乾燥が気になる");
    addFact(facts, source, /水仕事|手洗い|消毒|アルコール/, "水仕事・手洗いが多い");
    addFact(facts, source, /ジェル|ポリッシュ|除光液|アセトン|セルフネイル|サロン/, "ネイルや除去の習慣がある");
    addFact(facts, source, /夜/, "夜にケアできる");
    addFact(facts, source, /日中|こまめ/, "日中にこまめなケアができる");
  }
  const budget = source.replace(/,/g, "").match(/(\d{3,5})\s*円/);
  if (budget) facts.push(`予算は${Number(budget[1]).toLocaleString("ja-JP")}円`);
  return facts.length ? facts : fallbackFacts;
}

/**
 * 肌相談の初回返答で、内部ラベルではなくユーザーの言葉を自然に
 * 言い換える。診断名や原因は補わず、明示された状態とタイミングだけを使う。
 */
export function reflectSkinConcern(input) {
  const source = normalize(input);
  const concerns = [];
  const hasDryness = /乾燥/.test(source);
  const hasTightness = /つっぱ|張る|張って/.test(source);

  if (hasDryness && hasTightness) concerns.push("乾燥して、肌が張る感じ");
  else {
    if (hasDryness) concerns.push("乾燥");
    if (hasTightness) concerns.push("肌のつっぱり・張る感じ");
  }
  if (/粉っぽ|粉をふ/.test(source)) concerns.push("粉っぽさ");
  if (/[べベ][たタ]つ|皮脂/.test(source)) concerns.push("ベタつき・皮脂");
  if (/毛穴/.test(source)) concerns.push("毛穴");
  if (/赤み/.test(source)) concerns.push("赤み");
  if (/刺激|ヒリつ|ぴりつ|ピリつ/.test(source)) concerns.push("刺激感");
  if (!concerns.length) return "";

  const timing = /洗顔後|洗顔直後/.test(source) ? "洗顔後に"
    : /日中/.test(source) ? "日中に"
      : /朝/.test(source) ? "朝に"
        : /夜/.test(source) ? "夜に"
          : /季節の変わり目/.test(source) ? "季節の変わり目に"
            : "";
  const joined = concerns.slice(0, 2).join("、");
  if (hasDryness && hasTightness) return `${timing}乾燥して、肌が張る感じなんですね。`;
  return `${timing}${joined}が気になるんですね。`;
}

function plainAnswer(input) {
  return input.trim().replace(/[。！？!?]+$/g, "").replace(/\s+/g, " ").slice(0, 60);
}

function firstMatch(source, choices) {
  return choices.find(([pattern]) => pattern.test(source))?.[1] ?? "";
}

/**
 * 各担当者が、ユーザーの実際の言葉だけをカテゴリーに合う自然な一文へ
 * 言い換える。診断名や原因は補わない。
 */
export function reflectSpecialistConcern(specialist, input, lastAnsweredKey = "") {
  if (isDirectiveRequest(input)) return "";

  if (specialist === "skin") {
    const reflected = reflectSkinConcern(input);
    if (reflected) return reflected;
  }

  const source = normalize(input);
  const answer = plainAnswer(input);
  const unknownAnswer = /^(わからない|分からない|不明|まだ決めていない|特にない|答えたくない)/.test(source);

  if (lastAnsweredKey && unknownAnswer) {
    const unknownResponses = {
      skin: "今は分からなくても大丈夫です。実際に気になる場面から順に見ていきます。",
      hair: "今は分からなくても大丈夫です。髪と頭皮のうち、気づきやすい方から確認できます。",
      body: "はっきり決めなくても大丈夫です。普段いちばん気になりやすい場面から絞れます。",
      makeup: lastAnsweredKey === "personalColor"
        ? "分からなくて大丈夫です。パーソナルカラーは決めつけず、普段の服や使う場面、なりたい印象から色を絞ります。"
        : "まだ決まっていなくても大丈夫です。使う場面や、変えたいところから一緒に絞れます。",
      nail: "今は分からなくても大丈夫です。日中と夜のどちらなら続けやすいかから考えられます。",
    };
    return unknownResponses[specialist] ?? "分からなくても大丈夫です。答えやすいところから確認します。";
  }

  if (specialist === "hair") {
    const concern = firstMatch(source, [
      [/広が|まとまら/, "髪の広がり・まとまりにくさ"],
      [/パサ|乾燥/, "髪のパサつき・乾燥"],
      [/うねり/, "髪のうねり"],
      [/[べベ][たタ]つ|皮脂/, "頭皮のベタつき"],
      [/フケ/, "フケ"],
      [/かゆ/, "頭皮のかゆみ"],
      [/ダメージ/, "髪のダメージ"],
    ]);
    const timing = firstMatch(source, [[/翌朝|朝起き/, "翌朝に"], [/朝/, "朝に"], [/乾かした(後|直後)/, "乾かした後に"], [/日中/, "日中に"]]);
    if (concern) return `${timing}${concern}が気になるんですね。`;
  }

  if (specialist === "body") {
    const area = firstMatch(source, [
      [/すね/, "すね"], [/ひじ|肘/, "ひじ"], [/ひざ|膝/, "ひざ"], [/かかと/, "かかと"],
      [/背中/, "背中"], [/首|デコルテ/, "首・デコルテ"], [/腕/, "腕"], [/全身/, "全身"],
    ]);
    const concern = firstMatch(source, [[/乾燥|かさつ|粉/, "乾燥"], [/ざらつ|ごわつ/, "ざらつき"], [/[べベ][たタ]つ/, "ベタつき"], [/日焼け|紫外線/, "紫外線"], [/におい/, "におい"]]);
    const timing = firstMatch(source, [[/入浴後|お風呂上がり/, "入浴後に"], [/日中/, "日中に"], [/朝/, "朝に"], [/夜/, "夜に"]]);
    if (area && concern) return `${timing}${area}の${concern}が気になるんですね。`;
    if (area) return `${area}が気になるんですね。`;
    if (concern) return `ボディの${concern}が気になるんですね。`;
  }

  if (specialist === "makeup") {
    const focus = firstMatch(source, [
      [/リップ|口紅/, "リップ"], [/下地|ファンデ|コンシーラー|パウダー|ベースメイク/, "ベースメイク"],
      [/眉|アイシャドウ|アイライン|マスカラ|アイメイク/, "目元メイク"], [/チーク/, "チーク"],
    ]);
    const issue = firstMatch(source, [[/色落ち/, "色落ち"], [/テカリ|皮脂/, "テカリ"], [/よれ|崩れ/, "崩れ"], [/乾燥|粉っぽ/, "乾燥・粉っぽさ"], [/にじみ/, "にじみ"]]);
    const finish = firstMatch(source, [[/ツヤ/, "ツヤのある"], [/マット/, "マットな"], [/ナチュラル|自然/, "自然な"], [/華やか|アイドル/, "華やかな"]]);
    if (focus && issue) return `${focus}の${issue}が気になるんですね。`;
    if (focus) return `${focus}について相談したいんですね。`;
    if (finish) return `${finish}仕上がりが好みなんですね。`;
  }

  if (specialist === "nail") {
    const area = firstMatch(source, [[/爪先|爪の先|爪表面|爪の表面/, "爪先・表面"], [/甘皮|ささくれ/, "甘皮まわり"], [/手肌|手の甲|指先|ハンド/, "手肌"]]);
    const concern = firstMatch(source, [[/割れ|欠け|二枚爪/, "割れ・欠け"], [/乾燥/, "乾燥"], [/手荒れ/, "手荒れ"], [/はがれ|持ち/, "ネイルの持ち"], [/縦筋/, "縦筋"]]);
    const exposure = /水仕事|手洗い|消毒|アルコール/.test(source) ? "水仕事や手洗いが多くて、" : "";
    if (/爪先|爪の先/.test(source) && /欠け/.test(source)) return `${exposure}爪先が欠けるのが気になるんですね。`;
    if (area && concern) return `${exposure}${area}の${concern}が気になるんですね。`;
    if (area) return `${exposure}${area}が気になるんですね。`;
    if (concern) return `${exposure}${concern}が気になるんですね。`;
  }

  if (lastAnsweredKey && answer) {
    const shortAnswerTemplates = {
      skin: {
        concern: `いちばん気になるのは「${answer}」なんですね。`,
        timing: `「${answer}」のときに気になるんですね。`,
        preference: `仕上がりは「${answer}」が好みなんですね。`,
      },
      hair: {
        concern: `いちばん変えたいのは「${answer}」なんですね。`,
        scalpState: `頭皮では「${answer}」が気になるんですね。`,
        routine: `カラーやアイロンは「${answer}」くらいなんですね。`,
        preference: `「${answer}」を優先したいんですね。`,
      },
      body: {
        area: `気になるのは「${answer}」なんですね。`,
        concern: `その部分は「${answer}」が気になるんですね。`,
        timing: `「${answer}」のときに気になるんですね。`,
        preference: `いちばん大事なのは「${answer}」なんですね。`,
      },
      makeup: {
        focus: `まず変えたいのは「${answer}」なんですね。`,
        scene: `「${answer}」で使うメイクなんですね。`,
        issue: `今いちばん困るのは「${answer}」なんですね。`,
        finish: `「${answer}」の仕上がりが好みなんですね。`,
      },
      nail: {
        area: `気になるのは「${answer}」なんですね。`,
        concern: `いちばん困るのは「${answer}」なんですね。`,
        exposure: `水仕事やネイルの習慣は「${answer}」くらいなんですね。`,
        preference: `「${answer}」なら続けやすそうなんですね。`,
      },
    };
    const shortReflection = shortAnswerTemplates[specialist]?.[lastAnsweredKey];
    if (shortReflection) return shortReflection;
  }

  return "";
}

const assistantQuestionRules = {
  skin: [
    ["concern", /いちばん気になる|乾燥.{0,8}[べベ][たタ]つき.{0,8}刺激/],
    ["timing", /どんなとき|いつ.{0,8}気になる|洗顔.{0,8}日中|気になるタイミング/],
    ["preference", /軽さ.{0,8}しっとり|仕上がり.{0,12}優先/],
  ],
  hair: [
    ["concern", /いちばん変えたい|優先したい.{0,20}(まとまり|手触り|頭皮)|まとまり.{0,8}手触り.{0,8}頭皮/],
    ["scalpState", /頭皮.{0,12}([べベ][たタ]つき|乾燥|かゆみ)|([べベ][たタ]つき|乾燥|かゆみ).{0,12}どれ/],
    ["routine", /カラー|ブリーチ|アイロン|コテ|熱.{0,12}(頻度|どのくらい)|使う頻度/],
    ["preference", /手間.{0,20}(仕上がり|増や)|仕上がり.{0,12}優先|夜.{0,12}丁寧なケア/],
  ],
  makeup: [
    ["focus", /まず変えたい|ベース.{0,8}目元.{0,8}リップ|メイク箇所/],
    ["scene", /使う場面|過ごす.{0,12}(普段|仕事|食事|ライブ)|普段.{0,8}仕事.{0,8}食事/],
    ["issue", /最初に気になる|テカリ.{0,8}乾燥.{0,8}色落ち|崩れ方/],
    ["finish", /仕上がり|自然.{0,8}ツヤ.{0,8}きちんと/],
    ["personalColor", /パーソナルカラー.{0,16}(診断済み|分かれば|わかれば|分からなければ|わからなければ)/],
  ],
  body: [
    ["area", /どの部位|気になる.{0,8}(部位|場所)/],
    ["concern", /その部位|乾燥.{0,8}ざらつき.{0,8}刺激/],
    ["timing", /入浴後.{0,8}日中|気になる.{0,8}(時間|タイミング)/],
    ["preference", /[べベ][たタ]つきにくさ.{0,8}保湿感.{0,8}香り|最優先/],
  ],
  nail: [
    ["area", /爪先.{0,8}甘皮.{0,8}手肌|気になる.{0,8}(場所|どこ)/],
    ["concern", /いちばん困|乾燥.{0,8}欠け.{0,8}手荒れ|ネイルの持ち/],
    ["exposure", /水仕事.{0,8}消毒|ジェル.{0,8}除光液|どのくらい/],
    ["preference", /日中.{0,8}夜|集中ケア|続けやすい/],
  ],
};

const inferredFactLabels = {
  skin: {
    concern: "肌で気になること",
    timing: "肌が気になるタイミング",
    preference: "仕上がりの希望",
  },
  hair: {
    concern: "髪・頭皮で優先したいこと",
    scalpState: "頭皮で気になる状態",
    routine: "カラーや熱を使う頻度",
    preference: "仕上がり・手間の希望",
  },
  makeup: {
    focus: "相談したいメイク箇所",
    scene: "メイクを使う場面",
    issue: "気になる崩れ方",
    finish: "なりたい仕上がり",
    personalColor: "パーソナルカラー",
  },
  body: {
    area: "気になる部位",
    concern: "ボディで気になること",
    timing: "気になるタイミング",
    preference: "使用感の希望",
  },
  nail: {
    area: "気になる場所",
    concern: "爪・手肌で気になること",
    exposure: "水仕事・ネイル習慣",
    preference: "続けやすいケア",
  },
};

function latestAssistantQuestionKey(specialist, history) {
  const latest = [...history].reverse().find((entry) => entry.role === "assistant" && /[？?]/.test(entry.text));
  if (!latest || !assistantQuestionRules[specialist]) return "";
  const matchedRule = assistantQuestionRules[specialist].find(([, pattern]) => pattern.test(normalize(latest.text)));
  return matchedRule ? String(matchedRule[0]) : "";
}

function inferredAnswerFact(specialist, key, input) {
  const label = inferredFactLabels[specialist]?.[key];
  const answer = input.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!label || !answer) return "";
  if (key === "personalColor" && /^(わからない|分からない|不明|診断していない|未診断|答えたくない)/.test(normalize(answer))) {
    return `${label}: 分からない・未回答（写真から推測しない）`;
  }
  if (/^(わからない|分からない|不明|特にない|答えたくない)/.test(normalize(answer))) return "";
  return `${label}: ${answer}`;
}

/**
 * @param {SpecialistId} specialist
 * @param {string} input
 * @param {Array<{role: "assistant" | "user", text: string}>} history
 * @param {{facts?: string[], knownKeys?: string[], askedKeys?: string[]}} memory
 */
export function deriveConversationContext(specialist, input, history = [], memory = {}) {
  const userTexts = history.filter((entry) => entry.role === "user").map((entry) => entry.text);
  const conversation = normalize([...userTexts, input].filter(Boolean).join(" "));
  const matched = rules[specialist].filter((rule) => rule.pattern.test(conversation));
  const allowedKeys = new Set(rules[specialist].map((rule) => rule.key));
  const knownKeys = new Set([
    ...(Array.isArray(memory.knownKeys) ? memory.knownKeys.filter((key) => allowedKeys.has(key)).slice(0, 12) : []),
    ...matched.map((item) => item.key),
  ]);
  const lastAnsweredKey = isDirectiveRequest(input) ? "" : latestAssistantQuestionKey(specialist, history);
  const answerFact = inferredAnswerFact(specialist, lastAnsweredKey, input);
  if (lastAnsweredKey && input.trim()) knownKeys.add(lastAnsweredKey);
  const askedKeys = new Set([
    ...(Array.isArray(memory.askedKeys) ? memory.askedKeys.filter((key) => allowedKeys.has(key)).slice(0, 12) : []),
    ...history
      .filter((entry) => entry.role === "assistant")
      .flatMap((entry) => assistantQuestionRules[specialist]?.filter(([, pattern]) => pattern.test(normalize(entry.text))).map(([key]) => String(key)) ?? []),
  ]);
  const colorSelectionRequested = specialist === "makeup"
    && /似合|パーソナルカラー|色味|カラー(を|が|選|提案|知)|リップ.{0,10}(色|カラー)|口紅.{0,10}(色|カラー)|チーク.{0,10}(色|カラー)|アイシャドウ.{0,10}(色|カラー)/.test(conversation.replace(/色落ち/g, ""));
  const personalColorQuestion = ["personalColor", "パーソナルカラーは診断済みですか？ 分かればタイプを、分からなければ「分からない」で大丈夫です。"];
  const scalpFocusSelected = specialist === "hair" && /頭皮/.test(conversation);
  const next = colorSelectionRequested && !knownKeys.has("personalColor") && !askedKeys.has("personalColor")
    ? personalColorQuestion
    : questions[specialist].find(([key]) => {
      if (specialist === "hair" && key === "scalpState" && !scalpFocusSelected) return false;
      if (specialist === "hair" && key === "routine" && scalpFocusSelected) return false;
      return !knownKeys.has(key) && !askedKeys.has(key);
    });
  const makeupBaseEnough = knownKeys.has("focus") && ["scene", "issue", "finish"].filter((key) => knownKeys.has(key)).length >= 2;
  const enoughBySpecialist = {
    skin: knownKeys.has("concern") && (knownKeys.has("timing") || knownKeys.has("preference")),
    hair: knownKeys.has("concern") && (scalpFocusSelected ? knownKeys.has("scalpState") : (knownKeys.has("routine") || knownKeys.has("preference"))),
    body: knownKeys.has("area") && knownKeys.has("concern") && (knownKeys.has("timing") || knownKeys.has("preference")),
    makeup: makeupBaseEnough && (!colorSelectionRequested || knownKeys.has("personalColor")),
    nail: knownKeys.has("area") && knownKeys.has("concern") && (knownKeys.has("exposure") || knownKeys.has("preference")),
  };

  const previousFacts = Array.isArray(memory.facts)
    ? memory.facts.filter((fact) => typeof fact === "string" && fact.trim()).map((fact) => fact.trim().slice(0, 120)).slice(0, 20)
    : [];
  const currentFacts = [...describeKnownFacts(specialist, conversation, matched.map((item) => item.fact)), ...(answerFact ? [answerFact] : [])];

  return {
    knownKeys: [...knownKeys],
    askedKeys: [...askedKeys],
    facts: [...new Set([...previousFacts, ...currentFacts])].slice(-20),
    enoughContext: enoughBySpecialist[specialist],
    nextQuestion: next?.[1] ?? "",
    lastAnsweredKey,
  };
}
