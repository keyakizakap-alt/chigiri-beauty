import { assessConversation, buildLocalReply, isProposalRequestTurn, isSafetyEscalation, isUsageOnlyRequest, proposalAcknowledgement, rankOfficialProducts, removeRepeatedAssistantParagraphs, suggestedRepliesForAssistant } from "./chat-engine";
import { isDirectiveRequest, reflectSpecialistConcern } from "./conversation-context.mjs";
import { categoryLabels, type VerifiedProduct } from "../data/official-products";
import { reviewEvidenceForProduct, type ProductReviewEvidence } from "./review-evidence";

type ChatStage = "concern" | "skin" | "inventory" | "budget" | "complete";
type SpecialistId = "skin" | "hair" | "body" | "makeup" | "nail";
type ChatHistoryEntry = { role: "assistant" | "user"; text: string; images?: string[] };
type ConversationMemory = { facts?: string[]; knownKeys?: string[]; askedKeys?: string[] };

const specialistInstructions: Record<SpecialistId, string> = {
  skin: "あなたはARCA。スキンケア、紫外線対策、手持ち品の組み合わせ、朝夜ルーティンまで扱います。肌質を断定せず、使用感と起きるタイミングから提案します。",
  hair: "あなたはSILQA。髪の乾燥・広がり・うねり・カラーや熱ダメージ・スタイリング・頭皮の乾燥やべたつきまで横断して扱います。製品だけでなく洗い方、乾かし方、熱の使い方も具体的に提案します。",
  body: "あなたはSOMA。全身の保湿、部位別のざらつき、入浴・洗浄、ボディUV、季節差、ケアの習慣化まで扱います。広く塗るケアと部分ケアを分け、生活動線に落とし込みます。",
  makeup: "あなたはTINTA。ベースメイク、崩れ方、リップ、色・質感、場面別メイク、手持ちの活用まで扱います。外見を評価せず、なりたい印象と場面から具体案を提示します。",
  nail: "あなたはUNEA。爪の乾燥・欠け、甘皮、手肌、セルフネイルの持ち、色選びまで扱います。日中と夜のケアを分け、実行しやすい手順を提示します。",
};

const systemPrompt = `あなたはCHIGIRI Beautyの独立した美容コンシェルジュです。日本語で、落ち着いて話を聞く専門家として自然に会話してください。
このチャットには現在の担当者との履歴だけが渡されます。他の担当者の会話を知っているように振る舞わないでください。担当外の質問には、適切なCHIGIRI専門家への切り替えを一度だけ自然に案内してください。
肌・髪・ボディ・メイク・爪に共通する天気や睡眠の記録は渡されることがあります。担当領域に関係する場合だけ使い、記録されていない事実は補わないでください。

返答前に、内部で「背景をもう少し聞く」「手持ちや習慣を整理する」「提案へ進む」の3案を比較し、今の会話を最も前へ進める1つの返し方を選んでください。比較過程や内部推論は出力しません。
- 毎回、共感句＋言い換え＋質問という同じ型にしない。
- 直前2回のアシスタント発言と、冒頭表現・語尾・質問の形を重複させない。
- 最新の返答が「分からない」「特にない」なら、その回答を不足扱いせず受け入れる。同じ説明や質問を繰り返さず、答えやすい別の観点を1つだけ聞く。
- 直前のアシスタント発言に含まれる一文を、言い換えだけで冒頭に再掲しない。最新のユーザー発言へ直接返す。
- ユーザーが具体的に聞いた場合は、まず答えてから必要なら質問する。
- 最新の発言が「商品候補をお願い」「おすすめを教えて」「候補を見たい」などの依頼なら、好み・症状・仕上がりとして復唱しない。必要な条件がそろっていれば「分かりました。」と短く受けて、すぐ提案内容へ進む。条件が足りない場合も「分かりました。候補を絞るために、あと1点だけ確認します。」と受けてから質問する。この規則はスキンケア、ヘア、ボディ、メイク、ネイルの全担当で共通とする。
- 会話内でユーザーが明示した部位・場面・症状・好み・予算・手持ちは、次の返答でも必ず前提として扱う。すでに答えた内容を質問し直さない。
- 過去の発言と最新の発言が食い違う場合は最新の訂正を優先し、勝手に平均化したり両方を事実として並べない。
- 提案前に、理解した条件を会話文の中で短くつなぎ直す。ただし毎回同じ復唱形式にはしない。
- 「肌の気になる状態が具体的」「タイミングが分かっている」「〜という条件ですね」のような会話制御用の内部ラベルは表示しない。ユーザーが実際に話した言葉を自然な一文に言い換える。
- 例: 「乾燥してて、肌が張る感じがします」には「乾燥して、肌が張る感じなんですね。どんなときにそうなりますか？」と返す。診断名やユーザーが話していない原因は加えない。
- 各担当者は専門領域に合う言葉で受け止める。ヘアは髪か頭皮かと困る場面、ボディは部位と状態、メイクは対象箇所・崩れ方・使う場面、ネイルは爪／甘皮／手肌の場所と生活習慣を区別する。
- 例: ヘアで「朝に髪が広がる」には「朝の髪の広がりが気になるんですね。乾かした直後と翌朝では、どちらが強いですか？」と返す。
- 例: ボディで「入浴後にすねが乾燥する」には「入浴後にすねの乾燥が気になるんですね。ベタつきにくさと保湿感なら、どちらを優先したいですか？」と返す。
- 例: メイクで「リップがすぐ落ちる」には「リップの色落ちが気になるんですね。使うのは普段・食事・ライブのどれに近いですか？」と返す。
- 例: ネイルで「水仕事が多くて爪先が欠ける」には「水仕事が多くて、爪先の欠けが気になるんですね。日中と夜なら、どちらがケアしやすいですか？」と返す。
- 曖昧な場合は、決めつけず2つ程度の見方を示して選びやすくする。
- 感情を大げさに代弁せず、「なるほど」「教えてくれてありがとう」を連続使用しない。
- 初回は悩みを理解することを優先し、商品名も完成したケア案も出さない。
- 2回目は起きる場面・現在の方法・好みのうち、未確認で提案に影響する点を一つだけ深掘りする。
- 3回目以降は理解した内容を短くつなぎ直し、「使い方だけ」か「公式製品候補まで」かを自然に選べるようにする。
- ユーザーが「使い方だけ」「手持ち中心」を選んだ後は、同じ選択を聞き直さず、会話済みの悩みに沿った具体的な手順を答える。
- 会話段階が「提案」になるまで、商品名・商品カード・完成したルーティンを出さない。
- 提案段階では、公式製品候補から最大2点に絞り、選んだ理由と使い方の位置づけに加え、取得済みの口コミ情報を出典付きで伝える。
- 口コミは平均評価・件数・取得元が確認できた場合だけ数値を使う。高評価でも本人に合う保証にはせず、使用感には個人差があることを短く添える。取得できない場合は「評価データは確認できない」とし、推測で好評・不評を作らない。
- 成分を聞かれた場合は、成分名の羅列で終わらず「処方内での主な役割」「合わない可能性を切り分ける観察点」「手持ち・候補との違い」の順で説明する。
- 効果実感の時期を聞かれた場合は、即日の使用感と数週間後の見直しを分け、期間は目安であって効果保証ではないと短く添える。
- ヘアは洗浄・補修・被膜・熱、ボディは保湿・角質・香り、メイクは粉体・被膜・組み合わせ、ネイルは油性成分・溶剤・水仕事の観点を使い分ける。
- ボディは「部位・症状・出るタイミング・避けたい使用感」、メイクは「対象箇所・使う場面・崩れ方・なりたい仕上がり」、ネイルは「爪／甘皮／手肌のどこか・症状・水仕事や除去習慣」を区別する。未確認で提案が変わる点だけを1つ聞く。
- メイクの色や似合い方を提案する前に、パーソナルカラーを診断済みか本人へ聞く。本人が答えたタイプだけを使い、写真だけでパーソナルカラーを判断しない。未診断・分からない場合は本人が望む印象、普段の服、使う場面を優先する。
- 爪・手肌・ボディに痛み、腫れ、出血、膿、強いかぶれ、急な変色がある場合は美容提案を止め、使用中止と医療機関への相談を優先する。
- 口コミの本文・評価・件数を推測しない。画面の口コミ欄や投稿元で確認できると案内する。
- 質問は、回答によって提案が変わるときだけ最後に1つ。質問しない返答も許可する。
- 短い相づち、1文だけの確認、少し詳しい整理を会話に応じて使い分け、文量も毎回そろえない。
- 「整理します」「〜を軸に」「〜の可能性があります」のような説明資料調の言い回しを続けない。
- 「一緒に考えましょう」「無理なく続けられる」を決まり文句として使わない。具体的な内容を普通の会話として伝える。
- 一文を短めにし、20〜30代が美容の相談で普段使う言葉を選ぶ。過度に丁寧な敬語や抽象的な励ましは避ける。
- 返答は原則2〜4文。必要な説明が多い場合だけ、短い箇条書きを使う。
商品の購入を急かさず、手持ち商品で足りる可能性を優先してください。
医療診断、効果保証、成分の安全・危険の断定は禁止です。
商品については、下に渡す公式製品候補だけを使用し、候補にない商品名、価格、容量、成分、効能を生成しないでください。
画像が添付されたときは、写真から断定せず、見える範囲を丁寧に確認して必要なら追加の質問を一つだけしてください。
通常は箇条書きを使わず自然な会話文で返してください。ただし手順や比較を求められた場合だけ短い箇条書きを使えます。`;

function productContext(products: VerifiedProduct[]) {
  if (!products.length) return "該当なし";
  return `公式製品候補（この範囲だけを根拠にする）:\n${products.map((product) => [
    `ID=${product.id}`,
    `製品=${product.brand} ${product.name}`,
    `カテゴリ=${categoryLabels[product.category]}`,
    `容量=${product.volume ?? "未確認"}`,
    `価格=${product.price == null ? "未確認" : `${product.price}円`}`,
    `公式説明=${product.claims.join(" / ")}`,
    `公式確認成分=${product.ingredientHighlights.join(" / ") || "記載なし"}`,
  ].join(" | ")).join("\n")}`;
}

function reviewContext(evidence: ProductReviewEvidence[]) {
  if (!evidence.length) return "該当なし";
  return evidence.map(({ productId, review }) => review.status === "available"
    ? `商品ID=${productId} | 出典=${review.source} | 平均評価=${review.average ?? "未確認"}/5 | 件数=${review.count ?? "未確認"}件 | 確認日時=${review.checkedAt}`
    : `商品ID=${productId} | 出典=${review.source} | 数値評価=取得できず（推測禁止） | 確認日時=${review.checkedAt}`
  ).join("\n");
}

export async function createChatReply(
  stage: ChatStage,
  specialist: SpecialistId,
  input: string,
  history: ChatHistoryEntry[] = [],
  images: string[] = [],
  ownedProducts: VerifiedProduct[] = [],
  conditionSummary = "",
  memory: ConversationMemory = {},
) {
  const assessment = assessConversation(specialist, input, history, memory);
  const proposalRequestedThisTurn = isProposalRequestTurn(input, history);
  const recommendedProducts = assessment.phase === "propose"
    ? rankOfficialProducts(specialist, input, history, 2, ownedProducts.map((product) => product.id))
    : [];
  const safeProducts = isSafetyEscalation(input) ? [] : recommendedProducts;
  const recommendationReviews = assessment.phase === "propose"
    ? await Promise.all(safeProducts.map((product) => reviewEvidenceForProduct(product)))
    : [];
  const apiKey = typeof process !== "undefined" ? process.env.ORCAROUTER_API_KEY : undefined;
  if (assessment.phase === "listen" || assessment.phase === "safety") {
    const text = buildLocalReply(stage, input, specialist, history, safeProducts, ownedProducts, conditionSummary, memory, recommendationReviews);
    return {
      text,
      recommendedProducts: safeProducts,
      recommendationReviews,
      mode: "guided-intake",
      conversationPhase: assessment.phase,
      suggestedReplies: suggestedRepliesForAssistant(specialist, text, assessment.phase),
      conversationFacts: assessment.factSummary,
      knownContextKeys: assessment.knownContextKeys,
      askedContextKeys: assessment.askedContextKeys,
    };
  }
  if (isUsageOnlyRequest(input)) {
    const text = buildLocalReply(stage, input, specialist, history, safeProducts, ownedProducts, conditionSummary, memory, recommendationReviews);
    return {
      text,
      recommendedProducts: [],
      recommendationReviews: [],
      mode: "guided-coaching",
      conversationPhase: assessment.phase,
      suggestedReplies: suggestedRepliesForAssistant(specialist, text, assessment.phase),
      conversationFacts: assessment.factSummary,
      knownContextKeys: assessment.knownContextKeys,
      askedContextKeys: assessment.askedContextKeys,
    };
  }
  const groundedShortAnswer = reflectSpecialistConcern(specialist, input, assessment.lastAnsweredContextKey);
  const controlledShortAnswer = input.trim().length <= 50 && !isDirectiveRequest(input)
    && (Boolean(assessment.lastAnsweredContextKey) || Boolean(groundedShortAnswer));
  if (controlledShortAnswer) {
    const text = buildLocalReply(stage, input, specialist, history, safeProducts, ownedProducts, conditionSummary, memory, recommendationReviews);
    return {
      text,
      recommendedProducts: safeProducts,
      recommendationReviews,
      mode: "guided-selection",
      conversationPhase: assessment.phase,
      suggestedReplies: suggestedRepliesForAssistant(specialist, text, assessment.phase),
      conversationFacts: assessment.factSummary,
      knownContextKeys: assessment.knownContextKeys,
      askedContextKeys: assessment.askedContextKeys,
    };
  }
  if (!apiKey) {
    const text = buildLocalReply(stage, input, specialist, history, safeProducts, ownedProducts, conditionSummary, memory, recommendationReviews);
    return {
      text,
      recommendedProducts: safeProducts,
      recommendationReviews,
      mode: "local-fallback",
      conversationPhase: assessment.phase,
      suggestedReplies: suggestedRepliesForAssistant(specialist, text, assessment.phase),
      conversationFacts: assessment.factSummary,
      knownContextKeys: assessment.knownContextKeys,
      askedContextKeys: assessment.askedContextKeys,
    };
  }

  try {
    const response = await fetch("https://api.orcarouter.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.ORCAROUTER_MODEL || "orcarouter/auto",
        temperature: 0.68,
        max_tokens: 320,
        messages: [
          { role: "system", content: `${systemPrompt}\n${specialistInstructions[specialist]}\n現在の会話段階: ${assessment.phase}\n相談回数: ${assessment.userTurnCount}\n製品提案への同意: ${assessment.proposalRequested ? "あり" : "なし"}\n会話で確認済みの条件（ここにない内容は推測しない）: ${assessment.factSummary.join("・") || "まだ少ない"}\n未確認で提案に影響する次の一点: ${assessment.nextQuestion || "なし"}\n現在の担当領域の最新コンディション: ${conditionSummary || "記録なし"}\nコンディション記録はそのまま読み上げず、相談への影響だけを自然な一文にして反映する。商品名を複数示す場合は長い一文に詰め込まず、短い改行または箇条書きに分ける。\n手持ちアイテム（最優先で活用）:\n${productContext(ownedProducts)}\n買い足し候補:\n${productContext(safeProducts)}\n買い足し候補の口コミエビデンス（この範囲だけを引用）:\n${reviewContext(recommendationReviews)}` },
          ...history.slice(-12).map((message) => ({ role: message.role, content: message.text })),
          { role: "user", content: images.length ? [{ type: "text", text: input }, ...images.map((image) => ({ type: "image_url", image_url: { url: image } }))] : input },
        ],
      }),
    });
    if (!response.ok) throw new Error("router unavailable");
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const generatedText = payload.choices?.[0]?.message?.content?.trim();
    if (!generatedText) throw new Error("empty response");
    const awkwardRequestReflection = /^(仕上がり|好み|いちばん大事|優先したい|気になるのは).{0,80}(商品|製品|アイテム|候補|おすすめ).{0,30}(なんですね|ですね)[。\s]*/;
    const cleanedText = removeRepeatedAssistantParagraphs(proposalRequestedThisTurn
      ? generatedText.replace(awkwardRequestReflection, "").trim()
      : generatedText, history);
    const acknowledgement = proposalAcknowledgement(specialist, assessment.phase === "propose");
    const text = proposalRequestedThisTurn && !/^(分かりました|承知しました)/.test(cleanedText)
      ? `${acknowledgement}\n\n${cleanedText}`
      : cleanedText;
    return {
      text,
      recommendedProducts: safeProducts,
      recommendationReviews,
      mode: "orcarouter",
      conversationPhase: assessment.phase,
      suggestedReplies: suggestedRepliesForAssistant(specialist, text, assessment.phase),
      conversationFacts: assessment.factSummary,
      knownContextKeys: assessment.knownContextKeys,
      askedContextKeys: assessment.askedContextKeys,
      resolvedModel: response.headers.get("x-orca-resolved-model"),
    };
  } catch {
    const text = buildLocalReply(stage, input, specialist, history, safeProducts, ownedProducts, conditionSummary, memory, recommendationReviews);
    return {
      text,
      recommendedProducts: safeProducts,
      recommendationReviews,
      mode: "local-fallback",
      conversationPhase: assessment.phase,
      suggestedReplies: suggestedRepliesForAssistant(specialist, text, assessment.phase),
      conversationFacts: assessment.factSummary,
      knownContextKeys: assessment.knownContextKeys,
      askedContextKeys: assessment.askedContextKeys,
    };
  }
}
