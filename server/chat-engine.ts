import {
  categoryLabels,
  officialProducts,
  productSpecialistOf,
  type ProductSpecialistId,
  type VerifiedProduct,
} from "../data/official-products";
import { deriveConversationContext, isDirectiveRequest, reflectSpecialistConcern } from "./conversation-context.mjs";
import { suggestedRepliesForQuestion } from "./quick-replies.mjs";
import type { ProductReviewEvidence } from "./review-evidence";

type ChatStage = "concern" | "skin" | "inventory" | "budget" | "complete";
type ChatHistoryEntry = { role: "assistant" | "user"; text: string; images?: string[] };
type ConversationMemory = { facts?: string[]; knownKeys?: string[]; askedKeys?: string[] };

export type ConversationPhase = "listen" | "understand" | "align" | "coach" | "propose" | "safety";
export type ConversationAssessment = {
  phase: ConversationPhase;
  userTurnCount: number;
  proposalRequested: boolean;
  enoughContext: boolean;
  suggestedReplies: string[];
  factSummary: string[];
  knownContextKeys: string[];
  askedContextKeys: string[];
  nextQuestion: string;
  lastAnsweredContextKey: string;
};

const safetyPattern = /(強い痛み|激しい痛み|出血|膿|大きく腫|急に悪化|息苦し|水ぶくれ|ただれ|発熱|じんましん|かぶれ|熱を持|しびれ|爪.{0,6}(緑|黒い線|強い変色))/;

const specialistProfiles: Record<ProductSpecialistId, {
  name: string;
  perspectives: string[];
  actions: Array<{ pattern: RegExp; advice: string }>;
  defaultAdvice: string[];
  questions: string[];
  contextQuestions: string[];
  preferenceQuestions: string[];
  acknowledgements: string[];
}> = {
  skin: {
    name: "ARCA",
    perspectives: ["肌の状態", "今のケア", "続けやすさ"],
    actions: [
      { pattern: /乾燥|つっぱ|粉/, advice: "洗顔後は時間を空けず、化粧水だけで終えずに乳液やクリームまで重ねる流れを先に整えてみましょう。" },
      { pattern: /毛穴|べたつ|皮脂/, advice: "落としすぎを避けつつ、朝は重ねる量を減らし、夜は保湿を省かない組み方が試しやすいです。" },
      { pattern: /紫外線|日焼け|UV/, advice: "朝の最後に日焼け止めを固定し、外出時間が長い日は塗り直しやすさまで含めて選ぶのが現実的です。" },
    ],
    defaultAdvice: ["まず工程を増やさず、洗う・うるおす・守るの3役が手持ちで揃っているか確認しましょう。"],
    questions: ["仕上がりは、軽さとしっとり感のどちらを優先したいですか？", "朝と夜では、どちらのケアを簡単にしたいですか？"],
    contextQuestions: ["気になりやすいのは、洗顔の直後・日中・季節の変わり目のどこですか？", "今使っている中で、つけた直後の感触が気になるものはありますか？"],
    preferenceQuestions: ["今は商品を増やすより、手持ちの使い方を整える方向が近いですか？", "朝の手軽さと夜の満足感なら、どちらを優先したいですか？"],
    acknowledgements: ["肌の状態だけでなく、気になるタイミングも大事な手がかりになりそうです。", "その感じなら、アイテム数より使う順番から見た方がよさそうです。"],
  },
  hair: {
    name: "SILQA",
    perspectives: ["髪のまとまり", "頭皮の状態", "乾かし方・熱ダメージ"],
    actions: [
      { pattern: /広が|パサ|乾燥|まとま/, advice: "広がり中心なら、タオルでこすらず水分を取り、根元から乾かして毛先は最後に弱めの風で整えるところから変えてみてください。" },
      { pattern: /べたつ|皮脂|臭い/, advice: "頭皮のべたつきは洗浄力だけで決めず、予洗いを長めにしてシャンプーを頭皮へ残さないことを先に試す価値があります。" },
      { pattern: /ダメージ|カラー|ブリーチ|アイロン|うねり/, advice: "熱やカラーの負担が中心なら、毎日の洗浄を強くするより、毛先の集中ケアとアイロン温度の見直しを優先しましょう。" },
      { pattern: /頭皮.*快適/, advice: "頭皮の快適さを優先するなら、髪の仕上がりとは分けて、ベタつき・乾燥・かゆみのどれが近いかを先に確認します。" },
      { pattern: /フケ|かゆみ|頭皮.*乾燥/, advice: "頭皮の違和感が中心なら、毛髪用トリートメントとは分けて、洗い方と頭皮向け保湿の必要性を確認します。" },
    ],
    defaultAdvice: ["髪・頭皮・スタイリングは原因が別なので、いちばん困る場面を一つ決めて、洗い方と乾かし方から順に変えます。"],
    questions: ["優先したいのは、朝のまとまり・手触り・頭皮の快適さのどれですか？", "カラーやアイロンを使う頻度はどのくらいですか？"],
    contextQuestions: ["広がりや違和感が強いのは、乾かした直後と翌朝のどちらですか？", "カラー・アイロン・スタイリング剤は、普段どのくらい使いますか？"],
    preferenceQuestions: ["まず変えたいのは、朝のまとまりと頭皮の快適さのどちらですか？", "手間を増やさず整えたいですか、それとも夜に少し丁寧なケアができますか？"],
    acknowledgements: ["髪そのものと頭皮では見方が変わるので、まず困る場面を分けて考えたいです。", "毎日の熱や乾かし方まで含めると、製品を増やさず変えられる余地もありそうです。"],
  },
  body: {
    name: "SOMA",
    perspectives: ["乾燥する部位", "入浴習慣", "塗りやすさ"],
    actions: [
      { pattern: /全身|乾燥|かさ|粉/, advice: "全身の乾燥には、お風呂上がりに肌の水分を軽く押さえた直後、ポンプ式など広げやすい保湿剤を置いて習慣化する方法が続きやすいです。" },
      { pattern: /ひじ|ひざ|かかと|ざら/, advice: "ひじ・ひざ・かかとは全身用ミルクだけで終えず、乾燥する部分だけクリームを重ねる二段構えが無駄を抑えられます。" },
      { pattern: /UV|日焼け|紫外線/, advice: "ボディのUV対策は、腕・首・手の甲など露出部を先に固定し、塗り直せる形状を選ぶと続けやすくなります。" },
      { pattern: /習慣|面倒|続か/, advice: "保湿剤を浴室の出口か着替える場所に置き、最初は気になる一部位だけ塗るルールにすると定着しやすいです。" },
    ],
    defaultAdvice: ["全身を同じ方法でケアせず、広く塗るミルクと乾燥部位のクリームを分けると、時間と使用感のバランスが取りやすいです。"],
    questions: ["いちばん乾燥するのは、全身・ひじ膝・すね・かかとのどこですか？", "べたつきにくさと保湿感なら、どちらを優先しますか？"],
    contextQuestions: ["気になる部位は、入浴後すぐと日中ではどちらがつらいですか？", "今のボディケアが続きにくい理由は、べたつき・手間・塗る場所のどれに近いですか？"],
    preferenceQuestions: ["全身を短時間で済ませる方法と、気になる部分だけ丁寧にする方法ならどちらが合いそうですか？", "香りや使用感で避けたいものはありますか？"],
    acknowledgements: ["部位と生活動線を分けて考えると、続けやすい形が見つかりそうです。", "ボディケアは塗るものだけでなく、塗る場所とタイミングもかなり影響します。"],
  },
  makeup: {
    name: "TINTA",
    perspectives: ["なりたい印象", "崩れ方", "使う場面"],
    actions: [
      { pattern: /崩れ|テカ|皮脂|よれ/, advice: "崩れ対策は全部を厚くするより、下地を薄く均一にし、テカリやすい部分だけパウダーを重ねる方が直しやすいです。" },
      { pattern: /乾燥|割れ|粉/, advice: "乾燥崩れなら、ベースを薄くして保湿後の待ち時間を取り、パウダーを顔全体ではなく必要な部分だけに使ってみてください。" },
      { pattern: /リップ|色|血色|似合/, advice: "色選びは診断名で固定せず、普段の服・使う場面・欲しい印象の3点で候補を絞ると失敗しにくいです。" },
      { pattern: /目元|アイメイク/, advice: "目元を変えるなら、アイシャドウ・ライン・マスカラのうち主役を一つに絞り、使う場面に合わせて濃さを決めます。" },
      { pattern: /自然|ナチュラル/, advice: "自然な仕上がりなら、肌の質感を残しつつ、色を足す場所を一つに絞ると手持ちでも調整しやすいです。" },
      { pattern: /ツヤ/, advice: "ツヤを出すなら顔全体を光らせず、頬の高い位置など一部に絞ると崩れも目立ちにくくなります。" },
      { pattern: /きちんと/, advice: "きちんと感は厚塗りより、眉・肌の色むら・リップの輪郭を整える方が出しやすいです。" },
      { pattern: /ライブ|推し|イベント|写真/, advice: "イベント用なら、写真映えだけでなく色持ちと直しやすさを優先し、目元かリップのどちらかを主役にするとまとまります。" },
    ],
    defaultAdvice: ["ベース・目元・リップを一度に変えず、なりたい印象に最も影響する1か所だけを変えると手持ちも活かせます。"],
    questions: ["仕上がりは、ナチュラル・ツヤ・きちんと感のどれに寄せたいですか？", "使う場面は、普段・仕事・食事・イベントのどれに近いですか？"],
    contextQuestions: ["そのメイクで過ごすのは、普段・仕事・食事・ライブのどれに近いですか？", "今のメイクで最初に気になってくるのは、テカリ・乾燥・色落ちのどれですか？"],
    preferenceQuestions: ["仕上がりは、自然・ツヤ・きちんと感のどこへ寄せたいですか？", "手持ち中心で組みたいですか、それとも足りない1点だけ候補を見たいですか？"],
    acknowledgements: ["似合うかだけでなく、過ごす場面と直しやすさまで合わせて考えたいです。", "全部を変えなくても、印象を決める一か所を選べば組み立てられそうです。"],
  },
  nail: {
    name: "UNEA",
    perspectives: ["爪の乾燥", "手肌", "セルフネイルの持ち"],
    actions: [
      { pattern: /乾燥|割れ|欠け|二枚爪/, advice: "乾燥や欠けが中心なら、爪表面だけでなく爪の根元と両脇にもオイルをなじませ、手洗い後か就寝前に固定するのが始めやすいです。" },
      { pattern: /甘皮|ささくれ/, advice: "甘皮は無理に切らず、入浴後など柔らかい状態で専用オイルを使い、少しずつ整えてください。" },
      { pattern: /ネイル|はがれ|持ち|色/, advice: "セルフネイルの持ちは、塗る前の油分除去と薄い層を重ねること、爪先の断面まで塗ることで変わりやすいです。" },
      { pattern: /手荒れ|手肌|ハンド/, advice: "手肌の乾燥には、日中の軽い保湿と夜の集中保湿を分けると、べたつきを避けながら続けられます。" },
    ],
    defaultAdvice: ["爪・甘皮・手肌は同じ乾燥でもケア位置が違うので、気になる場所を分けて1工程ずつ整えます。"],
    questions: ["優先したいのは、爪の乾燥・手肌・ネイルの持ちのどれですか？", "日中の使いやすさと夜の集中保湿なら、どちらが合いそうですか？"],
    contextQuestions: ["気になるのは爪の表面・爪先・甘皮まわり・手肌のどこですか？", "水仕事や消毒、セルフネイルの頻度はどのくらいですか？"],
    preferenceQuestions: ["日中にこまめに使える軽さと、夜の集中ケアならどちらが続けやすいですか？", "ケア中心とネイルの持ち改善なら、今はどちらを優先したいですか？"],
    acknowledgements: ["同じ乾燥でも爪先と甘皮ではケアする場所が違うので、そこを分けて見たいです。", "手を使う場面まで分かると、続けやすいタイミングをかなり絞れます。"],
  },
};

export function suggestedRepliesForAssistant(
  specialist: ProductSpecialistId,
  assistantText: string,
  phase: ConversationPhase,
) {
  return suggestedRepliesForQuestion(specialist, assistantText, phase);
}

function normalize(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("ja-JP");
}

function variationIndex(input: string, history: ChatHistoryEntry[], size: number) {
  const seed = `${input}|${history.filter((entry) => entry.role === "assistant").slice(-2).map((entry) => entry.text).join("|")}`;
  return [...seed].reduce((total, character) => total + character.codePointAt(0)!, 0) % size;
}

function budgetFromConversation(input: string, history: ChatHistoryEntry[]) {
  const source = [input, ...history.filter((entry) => entry.role === "user").slice(-5).map((entry) => entry.text)].join(" ");
  if (/買いたくない|買い足しなし|(^|[^\d])0\s*円/.test(source)) return 0;
  const values = [...source.replace(/,/g, "").matchAll(/(\d{3,5})\s*円/g)].map((match) => Number(match[1]));
  return values.at(-1) ?? 5000;
}

export function isSafetyEscalation(input: string) {
  return safetyPattern.test(input);
}

const proposalPattern = /(商品|製品|アイテム).*(提案|候補|おすすめ|選ん)|おすすめ|買うなら|何を買|何がいい|どれがいい|候補を見|提案して|選んで/;
const coachingPattern = /(まず)?使い方.{0,12}(整え|見直|知り)|手持ち(だけ|中心).{0,12}(考え|使|組)/;
const affirmativePattern = /^(はい|うん|お願い|お願いします|見たい|知りたい|それで|提案して|候補を|商品も|製品も)/;

export function isProposalRequestTurn(input: string, history: ChatHistoryEntry[] = []) {
  const current = normalize(input).trim();
  if (proposalPattern.test(current)) return true;
  if (!isDirectiveRequest(input) || !affirmativePattern.test(current)) return false;
  const latestAssistant = [...history].reverse().find((entry) => entry.role === "assistant")?.text ?? "";
  return /(商品|製品|アイテム|コスメ).{0,18}(候補|提案|おすすめ)|候補まで見|商品も見/.test(normalize(latestAssistant));
}

export function isUsageOnlyRequest(input: string) {
  const source = normalize(input).trim();
  return coachingPattern.test(source)
    || /^(使い方(を)?見直す|使い方だけ|手持ちだけ|手持ち中心|今あるものだけ)[。！!？?]*$/.test(source);
}

function paragraphSimilarity(left: string, right: string) {
  const normalizeParagraph = (value: string) => normalize(value).replace(/[\s「」『』。、！？!?・]/g, "");
  const a = normalizeParagraph(left);
  const b = normalizeParagraph(right);
  if (!a || !b) return 0;
  if (a === b || (Math.min(a.length, b.length) >= 18 && (a.includes(b) || b.includes(a)))) return 1;
  const bigrams = (value: string) => new Set(Array.from({ length: Math.max(0, value.length - 1) }, (_, index) => value.slice(index, index + 2)));
  const aPairs = bigrams(a);
  const bPairs = bigrams(b);
  const intersection = [...aPairs].filter((pair) => bPairs.has(pair)).length;
  const union = new Set([...aPairs, ...bPairs]).size;
  return union ? intersection / union : 0;
}

export function removeRepeatedAssistantParagraphs(text: string, history: ChatHistoryEntry[]) {
  const recentParagraphs = history
    .filter((entry) => entry.role === "assistant")
    .slice(-3)
    .flatMap((entry) => entry.text.split(/\n\s*\n/))
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  if (!recentParagraphs.length) return text.trim();
  const paragraphs = text.split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const unique = paragraphs.filter((paragraph) => !recentParagraphs.some((previous) => paragraphSimilarity(paragraph, previous) >= 0.82));
  return (unique.length ? unique : paragraphs.slice(-1)).join("\n\n");
}

function usageOnlyReply(specialist: ProductSpecialistId, history: ChatHistoryEntry[]) {
  const options: Record<ProductSpecialistId, string[]> = {
    skin: [
      "では、買い足しはせず、今あるアイテムの量と順番だけ整えます。\n\n次のケアでは、化粧水をつけたあと少し置き、乳液かクリームはつっぱりやすい部分から薄く重ねてください。1〜2時間後に乾燥した場所だけ確認しましょう。",
      "使い方から見直しましょう。新しい商品は増やしません。\n\n今夜は保湿剤を一度に多く塗らず、少量ずつ重ねてください。つけた直後ではなく、時間がたった後の乾燥とベタつきを比べます。",
    ],
    hair: [
      "では、商品は増やさず、洗い方と乾かし方を一つずつ調整します。\n\n今夜は予洗いを少し長めにし、根元から乾かして毛先は最後に弱い風で整えてください。翌朝の髪と頭皮の状態を比べましょう。",
      "手持ちのまま試せます。今日は洗浄料の量を増やさず、すすぎと乾かし方だけ変えてください。\n\n変化を見るのは、乾かした直後と翌朝のどちらが気になるかの1点だけで十分です。",
    ],
    body: [
      "では、手持ちの保湿剤を使う場所とタイミングだけ変えます。\n\n入浴後、気になる一部位へ薄く塗り、乾燥が残る場所だけ少量を重ねてください。翌朝の乾燥とベタつきを確認します。",
      "買い足さずに使い方から整えましょう。全身へ同じ量を塗らず、乾燥しやすい部分から始めます。\n\nまず1日試して、塗った場所の使用感だけ教えてください。",
    ],
    makeup: [
      "では、手持ちだけで仕上がりを調整します。\n\n次回は変える場所を一つに絞り、薄く重ねてください。崩れ始めた時間と場所が分かれば、次の調整を具体的にできます。",
      "買い足さず、塗る量と重ねる場所から見直しましょう。\n\nベース・目元・リップのうち一か所だけ変えて、仕上がりと直しやすさを比べてください。",
    ],
    nail: [
      "では、今あるケア用品を使うタイミングから整えます。\n\n気になる場所へ少量をなじませ、手洗い後か就寝前の続けやすい方に固定してください。翌日の乾燥や引っかかりを確認します。",
      "手持ちだけで進めましょう。爪全体へ多く塗るより、乾燥しやすい爪先・甘皮・手肌の一か所へ絞ります。\n\nまず1日続けて、どこが変わったかだけ見てください。",
    ],
  };
  const recent = history.filter((entry) => entry.role === "assistant").slice(-3).map((entry) => entry.text).join("\n");
  const ranked = options[specialist].map((text) => ({
    text,
    similarity: text.split(/\n\s*\n/).reduce((max, paragraph) => Math.max(max, paragraphSimilarity(paragraph, recent)), 0),
  })).sort((left, right) => left.similarity - right.similarity);
  return removeRepeatedAssistantParagraphs(ranked[0].text, history);
}

export function proposalAcknowledgement(specialist: ProductSpecialistId, readyToPropose = true) {
  if (!readyToPropose) return "分かりました。商品候補を絞るために、あと1点だけ確認します。";
  const labels: Record<ProductSpecialistId, string> = {
    skin: "スキンケア",
    hair: "ヘア・頭皮ケア",
    body: "ボディケア",
    makeup: "メイク・コスメ",
    nail: "ネイル・ハンドケア",
  };
  return `分かりました。今のお悩みと手持ちアイテムを踏まえて、${labels[specialist]}の商品候補をご提案します。`;
}

export function assessConversation(
  specialist: ProductSpecialistId,
  input: string,
  history: ChatHistoryEntry[] = [],
  memory: ConversationMemory = {},
): ConversationAssessment {
  const userMessages = history.filter((entry) => entry.role === "user");
  const turns = Math.max(1, userMessages.length + (input.trim() ? 1 : 0));
  const conversation = normalize([...userMessages.map((entry) => entry.text), input].join(" "));
  const proposalRequested = proposalPattern.test(conversation) || (turns >= 3 && affirmativePattern.test(normalize(input)));
  const context = deriveConversationContext(specialist, input, history, memory);
  const enoughContext = context.enoughContext;
  const details = {
    factSummary: context.facts,
    knownContextKeys: context.knownKeys,
    askedContextKeys: context.askedKeys,
    nextQuestion: context.nextQuestion,
    lastAnsweredContextKey: context.lastAnsweredKey,
  };

  if (isSafetyEscalation(input)) {
    return { phase: "safety", userTurnCount: turns, proposalRequested: false, enoughContext, suggestedReplies: [], ...details };
  }
  if (isUsageOnlyRequest(input)) {
    return { phase: "coach", userTurnCount: turns, proposalRequested: false, enoughContext, suggestedReplies: ["この方法で試してみる", "もう少し簡単にしたい", "商品候補も見たい"], ...details };
  }
  if (proposalRequested && enoughContext) {
    return { phase: "propose", userTurnCount: turns, proposalRequested, enoughContext, suggestedReplies: ["もう少し予算を抑えたい", "手持ち中心に変えたい", "別の方向も見たい"], ...details };
  }
  if (enoughContext) {
    return { phase: "align", userTurnCount: turns, proposalRequested, enoughContext, suggestedReplies: ["まず使い方を整えたい", "商品候補も見たい", "手持ちだけで考えたい"], ...details };
  }
  if (turns <= 1) {
    return { phase: "listen", userTurnCount: turns, proposalRequested, enoughContext, suggestedReplies: specialistProfiles[specialist].questions.slice(0, 2), ...details };
  }
  if (turns === 2 || !enoughContext) {
    return { phase: "understand", userTurnCount: turns, proposalRequested, enoughContext, suggestedReplies: ["もう少し状況を話す", "手持ちも含めて相談する", "仕上がりの好みを伝える"], ...details };
  }
  if (!proposalRequested) {
    return { phase: "align", userTurnCount: turns, proposalRequested, enoughContext, suggestedReplies: ["まず使い方を整えたい", "商品候補も見たい", "手持ちだけで考えたい"], ...details };
  }
  return { phase: "propose", userTurnCount: turns, proposalRequested, enoughContext, suggestedReplies: ["もう少し予算を抑えたい", "手持ち中心に変えたい", "別の方向も見たい"], ...details };
}

export function rankOfficialProducts(
  specialist: ProductSpecialistId,
  input: string,
  history: ChatHistoryEntry[] = [],
  limit = 2,
  ownedProductIds: string[] = [],
) {
  if (isSafetyEscalation(input)) return [];
  const conversation = normalize([input, ...history.filter((entry) => entry.role === "user").slice(-5).map((entry) => entry.text)].join(" "));
  const budget = budgetFromConversation(input, history);

  return officialProducts
    .filter((product) => productSpecialistOf(product) === specialist && !ownedProductIds.includes(product.id))
    .map((product, index) => {
      const tags = product.recommendationTags ?? [];
      const tagScore = tags.reduce((score, tag) => score + (conversation.includes(normalize(tag)) ? 9 : 0), 0);
      const identityScore = [product.brand, product.name, categoryLabels[product.category]]
        .reduce((score, value) => score + (conversation.includes(normalize(value)) ? 12 : 0), 0);
      const priceScore = budget === 0
        ? -40
        : product.price == null
          ? 0
          : product.price <= budget ? 4 : -8;
      return { product, score: tagScore + identityScore + priceScore - index / 1000 };
    })
    .filter(({ score }) => budgetFromConversation(input, history) !== 0 && score > -20)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ product }) => product);
}

export function buildLocalReply(
  stage: ChatStage,
  input: string,
  specialist: ProductSpecialistId = "skin",
  history: ChatHistoryEntry[] = [],
  recommendedProducts: VerifiedProduct[] = rankOfficialProducts(specialist, input, history),
  ownedProducts: VerifiedProduct[] = [],
  conditionSummary = "",
  memory: ConversationMemory = {},
  recommendationReviews: ProductReviewEvidence[] = [],
) {
  if (isSafetyEscalation(input)) {
    return "その症状は化粧品だけで判断しない方が安全です。新しい製品の提案はいったん止め、使用中の製品があれば中止して、皮膚科などの医療機関へ相談してください。急な悪化や強い痛みがある場合は早めの受診を優先してください。";
  }

  if (/全成分|成分表示|配合成分|成分.*(合わ|違い|役割)/.test(input)) {
    const product = [...ownedProducts, ...recommendedProducts]
      .find((item) => input.includes(item.name) || input.includes(item.brand));
    const highlights = product?.ingredientHighlights?.length
      ? `公式ページで確認できる注目成分は、${product.ingredientHighlights.join("、")}です。`
      : "まず写真から読める成分名を確認します。";
    const focus: Record<ProductSpecialistId, string> = {
      skin: "保湿・洗浄・紫外線防御の役割と、塗布直後の刺激、時間がたった後の乾燥やベタつきを分けて見ます。",
      hair: "洗浄成分・補修成分・被膜成分を分け、頭皮の違和感と毛先の重さ、熱を使う日のまとまりを確認します。",
      body: "保湿成分・角質ケア・香りに関わる要素を分け、部位ごとの刺激やベタつきを確認します。",
      makeup: "粉体・被膜・保湿成分を分け、仕上がりだけでなく乾燥、テカリ、落とした後の状態を確認します。",
      nail: "油性成分・被膜・溶剤を分け、爪まわりの刺激、乾燥、除去工程まで含めて確認します。",
    };
    return `${highlights}${focus[specialist]}成分だけで不調の原因は断定できないので、使い始めた時期と、どのタイミングで違和感が出るかも合わせて教えてください。`;
  }

  const profile = specialistProfiles[specialist];
  const assessment = assessConversation(specialist, input, history, memory);
  const proposalRequestedThisTurn = isProposalRequestTurn(input, history);
  if (isUsageOnlyRequest(input)) return usageOnlyReply(specialist, history);
  const conversation = [input, ...history.filter((entry) => entry.role === "user").slice(-5).map((entry) => entry.text)].join(" ");
  const action = profile.actions.find((candidate) => candidate.pattern.test(conversation))?.advice
    ?? profile.defaultAdvice[variationIndex(input, history, profile.defaultAdvice.length)];
  const recentAssistantText = history.filter((entry) => entry.role === "assistant").slice(-6).map((entry) => entry.text).join("\n");
  const coachingFollowUps: Record<ProductSpecialistId, string> = {
    skin: /乾燥|つっぱ|粉/.test(conversation)
      ? "今日は新しいものを増やさず、洗顔後すぐに化粧水と乳液・クリームまで重ね、数時間後のつっぱりだけ確認してみてください。"
      : "朝夜それぞれの使用量と、つけた直後・数時間後の感触だけをメモすると、次に変える場所を一つに絞れます。",
    hair: /広が|パサ|まとま/.test(conversation)
      ? "今夜は、タオルで押さえる→根元から乾かす→毛先を弱い風で整える、の順だけ試してください。翌朝の広がりがどう変わるかを見ます。"
      : "洗った直後・乾かした直後・翌朝のうち、変化が出る場面を一つだけ記録すると、頭皮と毛先のどちらを先に変えるか決めやすくなります。",
    body: /すね|脚|ひじ|肘|ひざ|膝|かかと/.test(conversation)
      ? "今夜は気になる部分だけ、入浴後すぐに薄く塗ってください。量を増やす前に、翌朝の乾燥とベタつきの両方を確認しましょう。"
      : "今夜は一部位だけ、入浴後すぐに塗ってみてください。全身へ広げるかは、翌朝の乾燥と使用感を見てからで十分です。",
    makeup: /リップ|口紅/.test(conversation)
      ? "手持ちのリップを薄く1回塗ってティッシュオフし、色を残したい中央へもう一度だけ重ねてください。ツヤは最後に中央へ少量戻すと、色持ちとの両立を狙えます。"
      : /下地|ファンデ|ベース/.test(conversation)
        ? "次回はベースを薄く均一にし、崩れやすい部分だけパウダーを重ねてください。崩れ始める時間と場所を一つ覚えておくと、次の調整が具体的になります。"
        : "次回は目元かリップのどちらか一か所だけ変え、崩れ始める時間を見てください。手持ちで直す場所を絞れます。",
    nail: /爪先|欠け|割れ|二枚爪/.test(conversation)
      ? "今夜は爪先と爪の両脇へオイルを少量なじませ、就寝前の1回だけ試してください。翌日の欠けや引っかかりを見て回数を調整します。"
      : "気になる場所だけに塗り、手洗い後と就寝前のどちらが続けやすいか試してください。",
  };
  const actionForThisTurn = recentAssistantText.includes(action) ? coachingFollowUps[specialist] : action;
  const candidate = recommendedProducts[0];
  const candidateSentence = assessment.phase === "propose" && candidate
    ? `製品候補なら「${candidate.brand} ${candidate.name}」が近いです。公式では${candidate.claims[0]}と案内されているため、${categoryLabels[candidate.category]}を見直す候補として比較できます。`
    : "";
  const candidateReview = candidate ? recommendationReviews.find((item) => item.productId === candidate.id) : undefined;
  const reviewSentence = assessment.phase === "propose" && candidateReview?.review.status === "available"
    ? `口コミは${candidateReview.review.source}で平均${candidateReview.review.average?.toFixed(1) ?? "--"}/5（${candidateReview.review.count?.toLocaleString("ja-JP") ?? "件数未確認"}件）です。評価は参考情報なので、同じ使い方でも使用感には個人差があります。`
    : assessment.phase === "propose" && candidateReview
      ? "口コミの数値評価は現在取得できないため、提案カードの確認先リンクから最新情報を見られます。"
      : "";
  const ownedSentence = assessment.phase === "propose" && ownedProducts.length
    ? `まずは手持ちの「${ownedProducts.slice(0, 2).map((product) => `${product.brand} ${product.name}`).join("」「")}」を活かす形で組みましょう。`
    : "";
  const conditionSentence = conditionSummary && assessment.phase !== "listen"
    ? "今日のコンディションも参考に、工程は増やさず今のケアを微調整します。"
    : "";
  const contextQuestion = profile.contextQuestions[variationIndex(`${stage}:context:${input}`, history, profile.contextQuestions.length)];
  const preferenceQuestion = profile.preferenceQuestions[variationIndex(`${stage}:preference:${input}`, history, profile.preferenceQuestions.length)];
  const acknowledgement = profile.acknowledgements[variationIndex(input, history, profile.acknowledgements.length)];
  const categoryReflection = reflectSpecialistConcern(specialist, input, assessment.lastAnsweredContextKey);
  const unknownAnswer = /^(わからない|分からない|不明|まだ決めていない|特にない|答えたくない)/.test(normalize(input).trim());
  const heardSentence = proposalRequestedThisTurn
    ? proposalAcknowledgement(specialist, assessment.phase === "propose")
    : categoryReflection || acknowledgement;
  const nextQuestion = assessment.nextQuestion || contextQuestion;

  let reply: string;

  if (proposalRequestedThisTurn && assessment.phase !== "propose") {
    reply = `${heardSentence}\n\n${assessment.nextQuestion || preferenceQuestion}`;
    return removeRepeatedAssistantParagraphs(reply, history);
  }

  if (unknownAnswer && assessment.lastAnsweredContextKey) {
    if (assessment.nextQuestion) reply = `${heardSentence}\n\n${assessment.nextQuestion}`;
    else if (assessment.enoughContext) reply = `${heardSentence}\n\n手持ちの使い方から見直しますか？ それとも商品候補まで見ますか？`;
    else reply = `${heardSentence}\n\n${preferenceQuestion}`;
    return removeRepeatedAssistantParagraphs(reply, history);
  }

  if (assessment.phase === "listen") {
    reply = `${heardSentence}\n\n${nextQuestion}`;
  } else if (assessment.phase === "understand") {
    reply = `${heardSentence}\n\n${actionForThisTurn}\n\n${assessment.nextQuestion || preferenceQuestion}`;
  } else if (assessment.phase === "align") {
    reply = `${heardSentence}\n\n${actionForThisTurn}\n\n次は、手持ちの使い方だけを見直しますか？ それとも商品候補まで見てみますか？`;
  } else if (assessment.phase === "coach") {
    reply = `${heardSentence}\n\n${actionForThisTurn}`;
  } else {
    reply = [heardSentence, conditionSentence, ownedSentence, actionForThisTurn, candidateSentence, reviewSentence, assessment.nextQuestion].filter(Boolean).join("\n\n");
  }
  return removeRepeatedAssistantParagraphs(reply, history);
}
