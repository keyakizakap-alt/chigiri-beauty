"use client";
/* eslint-disable @next/next/no-img-element -- user-uploaded R2 images use runtime URLs */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  brandMarkets,
  categoryLabels,
  officialProducts as fallbackProducts,
  productSpecialistOf,
  type ProductCategory,
  type ProductMarket,
  type VerifiedProduct,
} from "@/data/official-products";
import { productDifference, productInsight } from "@/data/product-insights";
import { officialProductImage } from "@/data/official-product-images";
import type { ProductReviewEvidence } from "@/server/review-evidence";

type Stage = "concern" | "skin" | "inventory" | "budget" | "complete";
type SpecialistId = "skin" | "hair" | "body" | "makeup" | "nail";
type ConversationPhase = "listen" | "understand" | "align" | "coach" | "propose" | "safety";
type ReplyMode = "quick" | "balanced" | "deep";
type CustomOwnedItem = { id: string; brand: string; name: string; category: ProductCategory; note: string | null };
type ChatImage = { id: string; name: string; url: string };
type ConditionEntry = {
  id: string;
  specialistId: SpecialistId;
  recordedAt: string;
  weatherLabel?: string;
  temperature?: number;
  humidity?: number;
  tomorrowLabel?: string;
  tomorrowTempMax?: number;
  tomorrowHumidity?: number;
  sleepHours?: number;
  note?: string;
};
type Message = {
  id: number;
  role: "assistant" | "user";
  text: string;
  time: string;
  images?: ChatImage[];
  recommendedProducts?: VerifiedProduct[];
  recommendationReviews?: ProductReviewEvidence[];
};
type ReviewData = {
  review?: {
    status: "available" | "links_only" | "unavailable";
    source: string;
    average: number | null;
    count: number | null;
    reviewUrl: string;
    checkedAt: string;
  };
  links?: { rakuten: string; cosme: string };
};
type ChatSession = {
  id: string;
  title: string;
  updatedAt: string;
  messages: Message[];
  stage: Stage;
  selectedIds: string[];
  budget: number;
  specialistId: SpecialistId;
  conversationPhase?: ConversationPhase;
  suggestedReplies?: string[];
  conversationFacts?: string[];
  knownContextKeys?: string[];
  askedContextKeys?: string[];
  replyMode?: ReplyMode;
};
type MarketFilter = "all" | ProductMarket;
type CategoryFilter = "all" | ProductCategory;
type HistorySpecialistFilter = "all" | SpecialistId;
type PlanFocus = {
  id: string;
  name: string;
  tagline: string;
  keywords: string[];
  priority: ProductCategory[];
};
type LifeRhythm = {
  id: string;
  name: string;
  tagline: string;
  keywords: string[];
  morningOrder: ProductCategory[];
  nightOrder: ProductCategory[];
};
type ShoppingStyle = {
  id: "use-only" | "minimum" | "cost-first" | "official-fit";
  name: string;
  tagline: string;
};
type ChigiriPlan = {
  id: string;
  title: string;
  focus: PlanFocus;
  rhythm: LifeRhythm;
  shopping: ShoppingStyle;
  score: number;
  missing: ProductCategory[];
  recommendation?: VerifiedProduct;
  morning: VerifiedProduct[];
  night: VerifiedProduct[];
  reason: string;
};

type ComparedPlan = ChigiriPlan & {
  finalScore: number;
};

const careFocuses: PlanFocus[] = [
  { id: "moisture", name: "うるおいを守る", tagline: "乾燥しやすい日も、重ねすぎず保湿を軸に。", keywords: ["乾燥", "つっぱ", "かさ", "保湿"], priority: ["moisturizer", "lotion", "cleanser", "sunscreen"] },
  { id: "texture", name: "キメを整える", tagline: "手持ちの美容液も活かし、丁寧に重ねる。", keywords: ["毛穴", "キメ", "ざら", "美容液"], priority: ["lotion", "moisturizer", "cleanser", "sunscreen"] },
  { id: "balance", name: "水分・皮脂バランス", tagline: "べたつきと乾燥が混ざる日を想定。", keywords: ["べたつ", "Tゾーン", "皮脂", "混合"], priority: ["cleanser", "lotion", "moisturizer", "sunscreen"] },
  { id: "gentle", name: "ゆらぎ時のシンプルケア", tagline: "アイテム数を絞り、変化を追いやすく。", keywords: ["ゆら", "敏感", "刺激", "日によって"], priority: ["cleanser", "moisturizer", "sunscreen", "lotion"] },
  { id: "uv", name: "毎日のUV習慣", tagline: "朝の紫外線対策を忘れにくい流れへ。", keywords: ["紫外線", "UV", "日焼け", "外出"], priority: ["sunscreen", "moisturizer", "cleanser", "lotion"] },
];

const lifeRhythms: LifeRhythm[] = [
  { id: "quick", name: "朝3分", tagline: "朝は3ステップを目安に迷いを減らす。", keywords: ["忙しい", "時短", "朝", "簡単"], morningOrder: ["cleanser", "moisturizer", "sunscreen"], nightOrder: ["cleanser", "lotion", "moisturizer"] },
  { id: "balanced", name: "朝夜バランス", tagline: "朝と夜に無理なく役割を分ける。", keywords: ["毎日", "基本", "バランス"], morningOrder: ["cleanser", "lotion", "serum", "moisturizer", "sunscreen"], nightOrder: ["cleanser", "lotion", "serum", "moisturizer"] },
  { id: "night", name: "夜を丁寧に", tagline: "朝は軽く、夜に手持ちを活用する。", keywords: ["夜", "帰宅", "ゆっくり"], morningOrder: ["cleanser", "moisturizer", "sunscreen"], nightOrder: ["cleanser", "lotion", "serum", "moisturizer"] },
  { id: "weekday", name: "平日・休日メリハリ", tagline: "平日は短く、余裕のある日に丁寧に。", keywords: ["平日", "休日", "週末", "仕事"], morningOrder: ["cleanser", "lotion", "moisturizer", "sunscreen"], nightOrder: ["cleanser", "lotion", "serum", "moisturizer"] },
  { id: "reset", name: "少数精鋭リセット", tagline: "工程を増やさず、続けやすさを優先。", keywords: ["分からない", "面倒", "少ない", "シンプル"], morningOrder: ["cleanser", "moisturizer", "sunscreen"], nightOrder: ["cleanser", "moisturizer"] },
];

const shoppingStyles: ShoppingStyle[] = [
  { id: "use-only", name: "買い足しゼロ", tagline: "不足があっても、まず手持ちだけで試す。" },
  { id: "minimum", name: "不足を1点だけ", tagline: "優先度が最も高い役割だけを補う。" },
  { id: "cost-first", name: "予算最優先", tagline: "予算内で無理なく続けられるものを優先する。" },
  { id: "official-fit", name: "目的との一致重視", tagline: "相談内容に合う使い方と特徴を優先する。" },
];

const specialists: Array<{ id: SpecialistId; name: string; role: string; icon: string; greeting: string; quickReplies: string[] }> = [
  { id: "skin", name: "ARCA", role: "スキンケア", icon: "A", greeting: "ARCAです。肌のことで、今いちばん気になっていることは何ですか？ 小さな違和感でも大丈夫です。", quickReplies: ["乾燥が気になる", "毛穴やキメが気になる", "日によって肌がゆらぐ", "何を使えばいいか分からない"] },
  { id: "hair", name: "SILQA", role: "ヘア・頭皮ケア", icon: "S", greeting: "SILQAです。髪の広がりやダメージ、頭皮のことまで相談できます。今日はどこから話しますか？", quickReplies: ["髪の乾燥・広がり", "頭皮のべたつき", "ダメージが気になる", "自分に合うケアが不明"] },
  { id: "body", name: "SOMA", role: "ボディケア", icon: "S", greeting: "SOMAです。乾燥やざらつき、UV対策まで相談できます。今日はどの悩みから話しますか？", quickReplies: ["全身の乾燥", "ひじ・ひざのざらつき", "ボディのUV対策", "ケアを習慣化したい"] },
  { id: "makeup", name: "TINTA", role: "メイク・コスメ", icon: "T", greeting: "TINTAです。普段のメイクでも、ライブやお出かけ用でも大丈夫です。今日は何について相談しますか？", quickReplies: ["似合う色を知りたい", "崩れにくくしたい", "手持ちでメイクしたい", "場面別に提案してほしい"] },
  { id: "nail", name: "UNEA", role: "ネイル・ハンド", icon: "U", greeting: "UNEAです。爪の乾燥、手荒れ、セルフネイルのことまで相談できます。今いちばん困っているのはどれですか？", quickReplies: ["爪が乾燥しやすい", "手荒れが気になる", "セルフネイル相談", "簡単なケアを知りたい"] },
];

const inventoryPrompts: Record<SpecialistId, string> = {
  skin: "今お持ちのスキンケアアイテムは何ですか？ いつも使っているものを選んでください。",
  hair: "今お持ちのヘア・頭皮ケアアイテムは何ですか？ いつも使っているものを選んでください。",
  body: "今お持ちのボディケアアイテムは何ですか？ いつも使っているものを選んでください。",
  makeup: "今お持ちのメイク・コスメアイテムは何ですか？ いつも使っているものを選んでください。",
  nail: "今お持ちのネイル・ハンドケアアイテムは何ですか？ いつも使っているものを選んでください。",
};

const essentialCategories: ProductCategory[] = ["cleanser", "lotion", "moisturizer", "sunscreen"];

function keywordScore(text: string, keywords: string[]) {
  return keywords.reduce((score, keyword) => score + (text.includes(keyword.toLocaleLowerCase("ja-JP")) ? 1 : 0), 0);
}

function orderRoutine(products: VerifiedProduct[], order: ProductCategory[]) {
  return products
    .filter((product, index, list) => order.includes(product.category) && list.findIndex((item) => item.id === product.id) === index)
    .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
}

function createPlans(
  products: VerifiedProduct[],
  selectedProducts: VerifiedProduct[],
  budget: number,
  messages: Message[]
): ChigiriPlan[] {
  const conversation = messages
    .filter((message) => message.role === "user")
    .map((message) => message.text)
    .join(" ")
    .toLocaleLowerCase("ja-JP");
  const covered = new Set(selectedProducts.map((product) => product.category));
  const missing = essentialCategories.filter((category) => !covered.has(category));

  return careFocuses.flatMap((focus, focusIndex) =>
    lifeRhythms.flatMap((rhythm, rhythmIndex) =>
      shoppingStyles.map((shopping, shoppingIndex) => {
        const affordable = products.filter((product) =>
          missing.includes(product.category)
          && product.price != null
          && product.price <= budget
        );
        let recommendation: VerifiedProduct | undefined;

        if (shopping.id === "minimum") {
          recommendation = [...affordable].sort((a, b) => {
            const priority = focus.priority.indexOf(a.category) - focus.priority.indexOf(b.category);
            return priority || (a.price ?? 999999) - (b.price ?? 999999);
          })[0];
        } else if (shopping.id === "cost-first") {
          recommendation = [...affordable].sort((a, b) => (a.price ?? 999999) - (b.price ?? 999999))[0];
        } else if (shopping.id === "official-fit") {
          recommendation = [...affordable].sort((a, b) => {
            const aText = `${a.claims?.join(" ") ?? ""} ${a.ingredientHighlights?.join(" ") ?? ""}`.toLocaleLowerCase("ja-JP");
            const bText = `${b.claims?.join(" ") ?? ""} ${b.ingredientHighlights?.join(" ") ?? ""}`.toLocaleLowerCase("ja-JP");
            return keywordScore(bText, focus.keywords) - keywordScore(aText, focus.keywords)
              || (a.price ?? 999999) - (b.price ?? 999999);
          })[0];
        }

        const routineProducts = recommendation ? [...selectedProducts, recommendation] : selectedProducts;
        const focusMatch = keywordScore(conversation, focus.keywords);
        const rhythmMatch = keywordScore(conversation, rhythm.keywords);
        let score = 60 + Math.min(focusMatch * 9, 22) + Math.min(rhythmMatch * 7, 14);
        if (missing.length === 0 && shopping.id === "use-only") score += 16;
        if (budget === 0 && shopping.id === "use-only") score += 22;
        if (budget > 0 && budget <= 2000 && shopping.id === "cost-first") score += 14;
        if (budget >= 3000 && shopping.id === "official-fit") score += 9;
        if (shopping.id === "minimum" && missing.length > 0) score += 8;
        if (recommendation) score += 5;
        score += (focusIndex * 3 + rhythmIndex * 2 + shoppingIndex) % 5;

        return {
          id: `${focus.id}-${rhythm.id}-${shopping.id}`,
          title: `${focus.name} × ${rhythm.name}`,
          focus,
          rhythm,
          shopping,
          score: Math.min(score, 99),
          missing,
          recommendation,
          morning: orderRoutine(routineProducts, rhythm.morningOrder),
          night: orderRoutine(routineProducts, rhythm.nightOrder),
          reason: `${focus.tagline}${rhythm.tagline}${shopping.tagline}`,
        };
      })
    )
  ).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

function selectBestFromTopThree(plans: ChigiriPlan[], selectedProductCount: number, budget: number): ComparedPlan {
  const finalists = plans.slice(0, 3).map((plan) => {
    const ownedProductScore = Math.min(selectedProductCount * 2, 8);
    const budgetScore = !plan.recommendation
      ? 8
      : plan.recommendation.price != null && plan.recommendation.price <= budget
        ? 6
        : -20;
    const minimalPurchaseScore = plan.recommendation ? 2 : 6;
    const routineScore = Math.max(0, 8 - Math.max(plan.morning.length, plan.night.length));

    return {
      ...plan,
      finalScore: plan.score + ownedProductScore + budgetScore + minimalPurchaseScore + routineScore,
    };
  });

  return finalists.sort((a, b) => b.finalScore - a.finalScore || b.score - a.score || a.id.localeCompare(b.id))[0];
}

const chatStorageKey = "chigiri-specialist-sessions-v4";
const historyCacheKey = "chigiri-consultation-cache-v1";
const historyOutboxKey = "chigiri-consultation-outbox-v1";

function storedSessions(key: string) {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter((session): session is ChatSession => Boolean(
      session
      && typeof session === "object"
      && typeof (session as ChatSession).id === "string"
      && typeof (session as ChatSession).specialistId === "string"
      && Array.isArray((session as ChatSession).messages)
    ));
  } catch {
    return [];
  }
}

function mergeSessions(...groups: ChatSession[][]) {
  const merged = new Map<string, ChatSession>();
  for (const session of groups.flat()) {
    const current = merged.get(session.id);
    if (!current || Date.parse(session.updatedAt) >= Date.parse(current.updatedAt)) merged.set(session.id, session);
  }
  return [...merged.values()].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

function storeSessions(key: string, sessions: ChatSession[]) {
  try {
    localStorage.setItem(key, JSON.stringify(sessions));
    return true;
  } catch {
    return false;
  }
}

function cacheSession(key: string, session: ChatSession) {
  storeSessions(key, mergeSessions([session], storedSessions(key)));
}

function removeCachedSession(key: string, id: string) {
  storeSessions(key, storedSessions(key).filter((session) => session.id !== id));
}

async function syncSessionBatch(sessions: ChatSession[]) {
  for (let offset = 0; offset < sessions.length; offset += 50) {
    const response = await fetch("/api/consultations", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessions: sessions.slice(offset, offset + 50) }),
    });
    if (!response.ok) throw new Error("history sync failed");
  }
}
function initialMessageFor(specialistId: SpecialistId): Message {
  const specialist = specialists.find((item) => item.id === specialistId) ?? specialists[0];
  return { id: Date.now(), role: "assistant", text: specialist.greeting, time: "いま" };
}

const initialMessage = initialMessageFor("skin");

const stageOrder: Record<Stage, Stage> = {
  concern: "skin",
  skin: "inventory",
  inventory: "budget",
  budget: "complete",
  complete: "complete",
};

function now() {
  return new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit" }).format(new Date());
}

// 表示までに少しだけ間を置き、内容量に応じた自然な会話テンポをつくる。
// 生成モデルの品質・コストを変えず、待機中は既存のタイピング表示で伝える。
function naturalReplyDelay(text: string, phase: ConversationPhase | undefined, mode: ReplyMode) {
  const characters = text.replace(/\s/g, "").length;
  const timing = mode === "quick"
    ? { minimum: 550, maximum: 1400, base: 420, perCharacter: 4 }
    : mode === "deep"
      ? { minimum: 2600, maximum: 5600, base: 2200, perCharacter: 11 }
      : { minimum: 1500, maximum: 3600, base: 1100, perCharacter: 8 };
  const proposalExtra = phase === "propose" ? 320 : 0;
  return Math.min(timing.maximum, Math.max(timing.minimum, timing.base + proposalExtra + characters * timing.perCharacter + Math.round(Math.random() * 260)));
}

const replyModeOptions: Array<{ id: ReplyMode; label: string; detail: string }> = [
  { id: "quick", label: "すぐ回答", detail: "短く要点から" },
  { id: "balanced", label: "自然な相談", detail: "会話をくみ取る" },
  { id: "deep", label: "じっくり分析", detail: "比較と理由を丁寧に" },
];

function productImageSource(product: VerifiedProduct) {
  return officialProductImage(product.id);
}

function productUseCaution(product: VerifiedProduct) {
  const [firstCheck, secondCheck] = productInsight(product).checkPoints;
  return `${firstCheck}をまず確認してください。違和感があれば使用を止め、${secondCheck ?? "使い始めた時期や重ね使い"}も一緒に振り返ると原因を切り分けやすくなります。`;
}

function createSessionId() {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function priceText(product: VerifiedProduct) {
  if (product.priceType === "open") return "オープン価格";
  if (product.price == null) return "価格未確認";
  return `¥${product.price.toLocaleString("ja-JP")}`;
}

const directOfficialStoreHosts = new Set([
  "torriden.jp",
  "etvos.com",
  "www.shiseido.co.jp",
  "www.muji.com",
  "www.fancl.co.jp",
  "anuashop.jp",
  "vtcosmetics.jp",
  "tirtir.co.jp",
  "manyo-japanese.com",
  "www.cosrx.com",
]);

function purchaseDestination(product: VerifiedProduct) {
  const url = new URL(product.officialUrl);
  const isDirectStore = directOfficialStoreHosts.has(url.hostname)
    && !(product.brand === "ANESSA" && !url.pathname.includes("onlinestore"));

  return {
    url: product.officialUrl,
    label: isDirectStore ? "公式サイトで購入する" : "公式サイトで購入先を確認",
    note: isDirectStore
      ? "ブランド・メーカーの公式商品ページへ移動します。価格や在庫は移動先で最終確認してください。"
      : "公式商品ページへ移動します。掲載されている取扱店・オンラインショップをご確認ください。",
  };
}

function parseBudget(text: string) {
  if (text.includes("買いたくない") || text.includes("0円")) return 0;
  const match = text.replace(/,/g, "").match(/(\d{3,5})/);
  return match ? Number(match[1]) : 3000;
}

function marketOf(product: VerifiedProduct): ProductMarket {
  return brandMarkets[product.brand] ?? "JP";
}

const brandSearchAliases: Record<string, string> = {
  "THE ANSWER": "ジアンサー",
  "SUBLIMIC": "サブリミック",
  "Biore UV": "ビオレUV ビオレユー・ヴィー",
  "NAIL HOLIC": "ネイルホリック",
  "CANMAKE": "キャンメイク",
  "CEZANNE": "セザンヌ",
  "MAQuillAGE": "マキアージュ",
  "MACHERIE": "マシェリ",
  "NIVEA": "ニベア",
  "SHISEIDO": "資生堂",
};

function filterProducts(
  products: VerifiedProduct[],
  query: string,
  market: MarketFilter,
  category: CategoryFilter
) {
  const normalizedQuery = query.trim().toLocaleLowerCase("ja-JP");
  return products.filter((product) => {
    const searchableText = [
      product.brand,
      brandSearchAliases[product.brand] ?? "",
      product.name,
      categoryLabels[product.category],
      ...(product.recommendationTags ?? []),
    ].join(" ").toLocaleLowerCase("ja-JP");
    const matchesQuery = !normalizedQuery
      || searchableText.includes(normalizedQuery);
    const matchesMarket = market === "all" || marketOf(product) === market;
    const matchesCategory = category === "all" || product.category === category;
    return matchesQuery && matchesMarket && matchesCategory;
  });
}

function weatherLabel(code: number) {
  if (code === 0) return "晴れ";
  if (code <= 3) return "くもり";
  if (code === 45 || code === 48) return "霧";
  if (code >= 51 && code <= 67) return "雨";
  if (code >= 71 && code <= 77) return "雪";
  if (code >= 80 && code <= 82) return "にわか雨";
  if (code >= 85 && code <= 86) return "にわか雪";
  if (code >= 95) return "雷雨";
  return "天気未確認";
}

function careHint(specialistId: SpecialistId, condition?: ConditionEntry | null) {
  if (!condition) return "記録すると、次の相談で今日の状態をふまえてお話しできます。";
  const humidTomorrow = (condition.tomorrowHumidity ?? 0) >= 75;
  const rainyTomorrow = /雨|雷/.test(condition.tomorrowLabel ?? "");
  if (specialistId === "hair" && (humidTomorrow || rainyTomorrow)) return "明日は湿気が高そうです。朝はオイルを増やすより、根元をよく乾かしてから毛先を整えるとまとまりを保ちやすくなります。";
  if (specialistId === "skin" && (condition.humidity ?? 100) <= 45) return "空気が乾きやすい日は、朝も化粧水だけで終えず、乳液やクリームを薄く重ねる準備を。";
  if (specialistId === "makeup" && (humidTomorrow || rainyTomorrow)) return "明日は湿気による崩れを想定して、ベースは薄めに。直しやすいパウダーだけ持っておくと安心です。";
  if ((condition.sleepHours ?? 8) < 6) return "睡眠が短めの日は、工程を増やさず、いつものケアをやさしく続ける日にしましょう。";
  return "大きく変えず、今日の使い心地を覚えておくと、次回の相談で調整しやすくなります。";
}

export default function ChigiriApp() {
  const [splashVisible, setSplashVisible] = useState(true);
  const [stage, setStage] = useState<Stage>("concern");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [shelfOpen, setShelfOpen] = useState(false);
  const [conditionOpen, setConditionOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [products, setProducts] = useState<VerifiedProduct[]>(fallbackProducts);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [budget, setBudget] = useState(3000);
  const [messages, setMessages] = useState<Message[]>([initialMessage]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [historyReady, setHistoryReady] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyReviewOpen, setHistoryReviewOpen] = useState(false);
  const [historyReviewQuery, setHistoryReviewQuery] = useState("");
  const [historySpecialistFilter, setHistorySpecialistFilter] = useState<HistorySpecialistFilter>("all");
  const [reviewSessionId, setReviewSessionId] = useState("");
  const [historySyncState, setHistorySyncState] = useState<"loading" | "saved" | "saving" | "error">("loading");
  const [specialistId, setSpecialistId] = useState<SpecialistId>("skin");
  const [replyModes, setReplyModes] = useState<Record<SpecialistId, ReplyMode>>(() => {
    const defaults: Record<SpecialistId, ReplyMode> = { skin: "balanced", hair: "balanced", body: "balanced", makeup: "balanced", nail: "balanced" };
    if (typeof window === "undefined") return defaults;
    try {
      const stored = localStorage.getItem("chigiri-reply-modes-v1");
      return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
    } catch { return defaults; }
  });
  const [customItems, setCustomItems] = useState<CustomOwnedItem[]>([]);
  const [customItemDraft, setCustomItemDraft] = useState({ brand: "", name: "", category: "moisturizer" as ProductCategory, note: "" });
  const [customItemSaving, setCustomItemSaving] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const [marketFilter, setMarketFilter] = useState<MarketFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [catalogLimit, setCatalogLimit] = useState(60);
  const [pendingImages, setPendingImages] = useState<ChatImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [conversationPhase, setConversationPhase] = useState<ConversationPhase>("listen");
  const [suggestedReplies, setSuggestedReplies] = useState<string[]>(specialists[0].quickReplies);
  const [conversationFacts, setConversationFacts] = useState<string[]>([]);
  const [knownContextKeys, setKnownContextKeys] = useState<string[]>([]);
  const [askedContextKeys, setAskedContextKeys] = useState<string[]>([]);
  const [conditions, setConditions] = useState<ConditionEntry[]>([]);
  const [conditionLoading, setConditionLoading] = useState(false);
  const [weatherDraft, setWeatherDraft] = useState<Partial<ConditionEntry>>({});
  const [sleepDraft, setSleepDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [detailProductId, setDetailProductId] = useState<string | null>(null);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [serviceNotice, setServiceNotice] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const saveRevisionRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setSplashVisible(false), 1100);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    fetch("/api/products")
      .then((response) => response.json())
      .then((data) => data.products?.length && setProducts(data.products))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    localStorage.setItem("chigiri-reply-modes-v1", JSON.stringify(replyModes));
  }, [replyModes]);

  useEffect(() => {
    if (!detailProductId) return;
    const controller = new AbortController();
    fetch(`/api/reviews?productId=${encodeURIComponent(detailProductId)}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("reviews unavailable")))
      .then((data: ReviewData) => setReviewData(data))
      .catch(() => undefined)
      .finally(() => setReviewLoading(false));
    return () => controller.abort();
  }, [detailProductId]);

  useEffect(() => {
    if (!detailProductId) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDetailProductId(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [detailProductId]);

  useEffect(() => {
    if (!historyReady) return;
    fetch("/api/check-ins")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("load failed")))
      .then((data: { entries?: ConditionEntry[] }) => setConditions(data.entries ?? []))
      .catch(() => undefined);
  }, [historyReady]);

  useEffect(() => {
    if (!historyReady) return;
    fetch("/api/owned-items", { credentials: "same-origin" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("load failed")))
      .then((data: { items?: CustomOwnedItem[] }) => setCustomItems(data.items ?? []))
      .catch(() => undefined);
  }, [historyReady]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        const cached = mergeSessions(storedSessions(historyCacheKey), storedSessions(historyOutboxKey));
        if (cached.length) setSessions(cached);
        try {
          const pending = storedSessions(historyOutboxKey);
          const currentSource = localStorage.getItem(chatStorageKey);
          let migratable: ChatSession[] = [];
          if (currentSource) {
            const stored = JSON.parse(currentSource) as Array<Omit<ChatSession, "specialistId"> & { specialistId?: SpecialistId }>;
            migratable = stored.filter((session) => session.id && session.messages?.length).map((session) => {
              const firstAssistantText = session.messages.find((message) => message.role === "assistant")?.text ?? "";
              const identifiedSpecialist = specialists.find((specialist) => firstAssistantText.includes(specialist.name))?.id;
              return { ...session, specialistId: identifiedSpecialist ?? session.specialistId ?? "skin" } as ChatSession;
            });
            for (const session of migratable) {
              cacheSession(historyCacheKey, session);
              cacheSession(historyOutboxKey, session);
            }
          }

          const loadFor = async (specialist: (typeof specialists)[number]) => {
            const all: ChatSession[] = [];
            let cursor: string | null = "0";
            while (cursor !== null) {
              const response: Response = await fetch(`/api/consultations?specialist=${specialist.id}&cursor=${encodeURIComponent(cursor)}`, { credentials: "same-origin" });
              if (!response.ok) throw new Error("history load failed");
              const data: { sessions?: ChatSession[]; nextCursor?: string | null } = await response.json();
              all.push(...(data.sessions ?? []));
              cursor = data.nextCursor ?? null;
            }
            return { specialistId: specialist.id, sessions: all };
          };
          // The first request establishes the anonymous HttpOnly owner cookie when
          // ChatGPT account headers are unavailable. Later requests can then share it.
          const firstLoaded = await loadFor(specialists[0]);
          const loaded = [firstLoaded, ...(await Promise.all(specialists.slice(1).map(loadFor)))];
          const valid = loaded.flatMap((group) => group.sessions).filter((session) => session.id && session.messages?.length);
          const combined = mergeSessions(valid, cached, migratable);
          setSessions(combined);
          storeSessions(historyCacheKey, combined);
          const queued = mergeSessions(pending, migratable);
          if (queued.length) {
            await syncSessionBatch(queued);
            storeSessions(historyOutboxKey, []);
          }
          if (currentSource) localStorage.removeItem(chatStorageKey);
          // Keep past consultations available, but always open on a fresh chat.
          // A previous conversation resumes only when the user selects it.
          setActiveSessionId(createSessionId());
          setHistorySyncState("saved");
        } catch {
          setActiveSessionId(createSessionId());
          setHistorySyncState("error");
        } finally {
          setHistoryReady(true);
        }
      })();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!historyReady || !activeSessionId) return;
    const firstUserMessage = messages.find((message) => message.role === "user")?.text;
    const current: ChatSession = {
      id: activeSessionId,
      title: firstUserMessage?.slice(0, 24) || "新しい美容相談",
      updatedAt: new Date().toISOString(),
      messages,
      stage,
      selectedIds,
      budget,
      specialistId,
      conversationPhase,
      suggestedReplies,
      conversationFacts,
      knownContextKeys,
      askedContextKeys,
      replyMode: replyModes[specialistId],
    };
    const revision = ++saveRevisionRef.current;
    const timer = window.setTimeout(() => {
      setSessions((previous) => {
        const next = [current, ...previous.filter((session) => session.id !== activeSessionId)]
          .filter((session) => session.id === activeSessionId || session.messages.some((message) => message.role === "user"));
        storeSessions(historyCacheKey, next);
        return next;
      });
      if (!current.messages.some((message) => message.role === "user")) return;
      cacheSession(historyOutboxKey, current);
      setHistorySyncState("saving");
      void fetch("/api/consultations", {
        method: "POST",
        credentials: "same-origin",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessions: [current] }),
      }).then((response) => {
        if (!response.ok) throw new Error("history save failed");
        removeCachedSession(historyOutboxKey, current.id);
        if (saveRevisionRef.current === revision) setHistorySyncState("saved");
      }).catch(() => {
        if (saveRevisionRef.current === revision) setHistorySyncState("error");
      });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [activeSessionId, askedContextKeys, budget, conversationFacts, conversationPhase, historyReady, knownContextKeys, messages, replyModes, selectedIds, specialistId, stage, suggestedReplies]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy, stage]);

  const selectedProducts = useMemo(
    () => products.filter((product) => selectedIds.includes(product.id)),
    [products, selectedIds]
  );

  const visibleProducts = useMemo(
    () => filterProducts(products, productQuery, marketFilter, categoryFilter),
    [categoryFilter, marketFilter, productQuery, products]
  );

  const displayedProducts = useMemo(
    () => visibleProducts.slice(0, catalogLimit),
    [catalogLimit, visibleProducts]
  );

  const specialistVisibleProducts = useMemo(
    () => visibleProducts.filter((product) => productSpecialistOf(product) === specialistId),
    [specialistId, visibleProducts]
  );

  const plans = useMemo(
    () => createPlans(products, selectedProducts, budget, messages),
    [budget, messages, products, selectedProducts]
  );
  const result = useMemo(
    () => selectBestFromTopThree(plans, selectedProducts.length, budget),
    [budget, plans, selectedProducts.length]
  );
  const activeSpecialist = specialists.find((item) => item.id === specialistId) ?? specialists[0];
  const visibleSessions = useMemo(
    () => sessions,
    [sessions]
  );
  const reviewSessions = useMemo(() => {
    const query = historyReviewQuery.trim().toLocaleLowerCase("ja-JP");
    return sessions.filter((session) => {
      if (historySpecialistFilter !== "all" && session.specialistId !== historySpecialistFilter) return false;
      if (!query) return true;
      const searchable = [session.title, ...session.messages.map((message) => message.text)].join(" ").toLocaleLowerCase("ja-JP");
      return searchable.includes(query);
    });
  }, [historyReviewQuery, historySpecialistFilter, sessions]);
  const reviewSession = reviewSessions.find((session) => session.id === reviewSessionId)
    ?? sessions.find((session) => session.id === reviewSessionId)
    ?? reviewSessions[0]
    ?? null;
  const specialistConditions = useMemo(
    () => conditions.filter((entry) => entry.specialistId === specialistId).sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)),
    [conditions, specialistId]
  );
  const latestCondition = specialistConditions[0];
  const detailProduct = products.find((product) => product.id === detailProductId) ?? null;
  const detailInsight = detailProduct ? productInsight(detailProduct) : null;
  const lastRecommendedProduct = [...messages]
    .reverse()
    .flatMap((message) => message.recommendedProducts ?? [])
    .find((product) => productSpecialistOf(product) === specialistId);
  const comparisonProduct = detailProduct
    ? (selectedIds.includes(detailProduct.id)
      ? (lastRecommendedProduct?.id !== detailProduct.id ? lastRecommendedProduct : undefined)
      : selectedProducts.find((product) => product.id !== detailProduct.id && productSpecialistOf(product) === productSpecialistOf(detailProduct)))
    : undefined;
  const comparison = detailProduct && comparisonProduct ? productDifference(comparisonProduct, detailProduct) : null;
  const latestConditions = useMemo(() => {
    const seen = new Set<SpecialistId>();
    return [...conditions].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)).filter((entry) => {
      if (seen.has(entry.specialistId)) return false;
      seen.add(entry.specialistId);
      return true;
    }).slice(0, 5);
  }, [conditions]);
  const todayPlan = useMemo(() => {
    const latest = latestConditions[0];
    const actions: Array<{ specialist: SpecialistId; title: string; detail: string }> = [];
    if ((latest?.sleepHours ?? 8) < 6) {
      actions.push({ specialist: "skin", title: "今日は増やさない", detail: "睡眠が短い日は新しいものを重ねず、いつもの保湿までで様子を見ます。" });
    }
    if ((latest?.humidity ?? latest?.tomorrowHumidity ?? 0) >= 70) {
      actions.push({ specialist: "hair", title: "湿気に備える", detail: "根元をしっかり乾かし、オイルは毛先だけ。ベースメイクも薄めが直しやすいです。" });
    }
    if (selectedProducts.length) {
      actions.push({ specialist: productSpecialistOf(selectedProducts[0]), title: "手持ちから使う", detail: `${selectedProducts[0].brand} ${selectedProducts[0].name}を先に活かします。買い足しは変化を見てからで十分です。` });
    }
    if (!actions.some((item) => item.specialist === "body")) {
      actions.push({ specialist: "body", title: "入浴後に1か所だけ", detail: "全身を頑張らず、乾燥が気になる場所だけ先に保湿します。" });
    }
    if (!actions.some((item) => item.specialist === "skin")) {
      actions.push({ specialist: "skin", title: "朝は守るケア", detail: "保湿のあとは日焼け止めまで。工程を増やさず、続けやすさを優先します。" });
    }
    return actions.slice(0, 3);
  }, [latestConditions, selectedProducts]);

  function openProductInsight(productId: string) {
    setReviewLoading(true);
    setReviewData(null);
    setDetailProductId(productId);
  }

  function askFromIngredientPhoto(product: VerifiedProduct) {
    setInput(`「${product.brand} ${product.name}」の全成分表示です。配合成分の役割と、今の悩みに合わない可能性を断定せずに整理してください。`);
    setDetailProductId(null);
    setShelfOpen(false);
    window.setTimeout(() => imageInputRef.current?.click(), 100);
  }

  async function send(text = input) {
    const value = text.trim();
    const imagesToSend = pendingImages;
    if ((!value && !imagesToSend.length) || busy || uploading) return;
    setInput("");
    setPendingImages([]);
    const visibleText = value || "写真を添付しました。";
    setMessages((current) => [...current, { id: Date.now(), role: "user", text: visibleText, time: now(), images: imagesToSend }]);
    setBusy(true);
    if (stage === "budget" && value) setBudget(parseBudget(value));

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage,
          specialist: specialistId,
          input: visibleText,
          images: imagesToSend.map((image) => image.url),
          ownedProductIds: selectedIds,
          customOwnedItems: customItems,
          replyMode: replyModes[specialistId],
          conditions: latestConditions,
          history: messages.map(({ role, text }) => ({ role, text })).slice(-20),
          memory: {
            facts: conversationFacts,
            knownKeys: knownContextKeys,
            askedKeys: askedContextKeys,
          },
        }),
      });
      const data = (await response.json()) as { text?: string; recommendedProducts?: VerifiedProduct[]; recommendationReviews?: ProductReviewEvidence[]; conversationPhase?: ConversationPhase; suggestedReplies?: string[]; conversationFacts?: string[]; knownContextKeys?: string[]; askedContextKeys?: string[]; mode?: string };
      const userTurnCount = messages.filter((message) => message.role === "user").length + 1;
      const shouldEnterInventory = stage === "concern"
        && selectedIds.length === 0 && customItems.length === 0
        && userTurnCount >= 2
        && ["understand", "align", "propose"].includes(data.conversationPhase ?? "understand");
      const nextStage: Stage = shouldEnterInventory
        ? "inventory"
        : stage === "inventory"
          ? specialistId === "skin" ? "budget" : "complete"
          : specialistId === "skin" && data.conversationPhase === "propose"
            ? "complete"
            : specialistId === "skin" && stage !== "budget" && stage !== "complete"
              ? stageOrder[stage]
              : stage;
      const assistantText = nextStage === "inventory"
        ? inventoryPrompts[specialistId]
        : data.text ?? "うまくお返事をまとめられませんでした。少し言い換えて、もう一度送ってもらえますか？";
      setServiceNotice(data.mode === "local-fallback" ? "今は基本のケア案内でお返ししています。詳しいパーソナル提案は、少し時間をおいてお試しください。" : "");
      await new Promise((resolve) => setTimeout(resolve, naturalReplyDelay(assistantText, data.conversationPhase, replyModes[specialistId])));
      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: assistantText,
          time: now(),
          recommendedProducts: nextStage === "inventory" ? undefined : data.recommendedProducts?.slice(0, 2),
          recommendationReviews: nextStage === "inventory" ? undefined : data.recommendationReviews?.slice(0, 2),
        },
      ]);
      setConversationPhase(data.conversationPhase ?? "understand");
      setSuggestedReplies(nextStage === "inventory" ? [] : data.suggestedReplies?.slice(0, 3) ?? []);
      setConversationFacts(data.conversationFacts?.slice(0, 20) ?? conversationFacts);
      setKnownContextKeys(data.knownContextKeys?.slice(0, 12) ?? knownContextKeys);
      setAskedContextKeys(data.askedContextKeys?.slice(0, 12) ?? askedContextKeys);
      setStage(nextStage);
    } catch {
      setMessages((current) => [
        ...current,
        { id: Date.now() + 1, role: "assistant", text: "少し接続が不安定みたいです。もう一度だけ送ってもらえますか？", time: now() },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function fetchWeather() {
    if (!navigator.geolocation || conditionLoading) {
      window.alert("この端末では現在地から天気を取得できません。睡眠時間やメモだけでも記録できます。");
      return;
    }
    setConditionLoading(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 10000, maximumAge: 30 * 60 * 1000 });
      });
      const params = new URLSearchParams({
        latitude: String(position.coords.latitude),
        longitude: String(position.coords.longitude),
        current: "temperature_2m,relative_humidity_2m,weather_code",
        daily: "weather_code,temperature_2m_max,relative_humidity_2m_max",
        timezone: "auto",
        forecast_days: "2",
      });
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
      if (!response.ok) throw new Error("weather failed");
      const data = await response.json() as {
        current?: { temperature_2m?: number; relative_humidity_2m?: number; weather_code?: number };
        daily?: { weather_code?: number[]; temperature_2m_max?: number[]; relative_humidity_2m_max?: number[] };
      };
      setWeatherDraft({
        weatherLabel: weatherLabel(data.current?.weather_code ?? -1),
        temperature: data.current?.temperature_2m,
        humidity: data.current?.relative_humidity_2m,
        tomorrowLabel: weatherLabel(data.daily?.weather_code?.[1] ?? -1),
        tomorrowTempMax: data.daily?.temperature_2m_max?.[1],
        tomorrowHumidity: data.daily?.relative_humidity_2m_max?.[1],
      });
    } catch {
      window.alert("天気を取得できませんでした。位置情報の許可と通信状態をご確認ください。");
    } finally {
      setConditionLoading(false);
    }
  }

  async function saveCondition() {
    if (!sleepDraft && !noteDraft.trim() && !weatherDraft.weatherLabel) return;
    const entry: ConditionEntry = {
      id: createSessionId(),
      specialistId,
      recordedAt: new Date().toISOString(),
      ...weatherDraft,
      sleepHours: sleepDraft ? Number(sleepDraft) : undefined,
      note: noteDraft.trim() || undefined,
    };
    try {
      const response = await fetch("/api/check-ins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
      if (!response.ok) throw new Error("save failed");
      setConditions((current) => [entry, ...current]);
      setWeatherDraft({});
      setSleepDraft("");
      setNoteDraft("");
    } catch {
      window.alert("今日のコンディションを保存できませんでした。もう一度お試しください。");
    }
  }

  async function deleteCondition(id: string) {
    if (!window.confirm("このコンディション記録を削除しますか？")) return;
    try {
      const response = await fetch(`/api/check-ins?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("delete failed");
      setConditions((current) => current.filter((entry) => entry.id !== id));
    } catch {
      window.alert("記録を削除できませんでした。もう一度お試しください。");
    }
  }

  async function addImages(files: FileList | null) {
    if (!files?.length || busy || uploading) return;
    const candidates = Array.from(files).slice(0, Math.max(0, 3 - pendingImages.length));
    if (!candidates.length) return;
    const accepted = candidates.filter((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size <= 5 * 1024 * 1024);
    if (accepted.length !== candidates.length) {
      window.alert("JPEG・PNG・WebP形式、1枚あたり5MB以下の画像を選択してください。");
    }
    if (!accepted.length) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(accepted.map(async (file) => {
        const formData = new FormData();
        formData.append("image", file);
        const response = await fetch("/api/uploads", { method: "POST", body: formData });
        if (!response.ok) throw new Error("upload failed");
        const data = await response.json() as { id: string; url: string; name: string };
        return { id: data.id, url: data.url, name: data.name };
      }));
      setPendingImages((current) => [...current, ...uploaded].slice(0, 3));
    } catch {
      window.alert("画像を追加できませんでした。通信状態を確認して、もう一度お試しください。");
    } finally {
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  async function removePendingImage(image: ChatImage) {
    setPendingImages((current) => current.filter((item) => item.id !== image.id));
    try {
      await fetch(`/api/uploads?id=${encodeURIComponent(image.id)}`, { method: "DELETE" });
    } catch {
      // The image is already hidden from the draft. Server cleanup can be retried with the session deletion flow.
    }
  }

  function finishInventory() {
    if ((!selectedIds.length && !customItems.length) || busy) return;
    const summary = [...selectedProducts.map((product) => `${product.brand} ${product.name}`), ...customItems.map((item) => `${item.brand} ${item.name}`.trim())].join("、");
    void send(summary);
  }

  function toggleProduct(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  function startNewSession() {
    const id = createSessionId();
    setActiveSessionId(id);
    setMessages([initialMessageFor(specialistId)]);
    setStage("concern");
    setSelectedIds([]);
    setBudget(3000);
    setConversationPhase("listen");
    setSuggestedReplies(activeSpecialist.quickReplies);
    setConversationFacts([]);
    setKnownContextKeys([]);
    setAskedContextKeys([]);
    setInput("");
    setServiceNotice("");
    setHistoryOpen(false);
  }

  function openSession(session: ChatSession) {
    if (busy) return;
    setActiveSessionId(session.id);
    setMessages(session.messages);
    setStage(session.stage);
    setSelectedIds(session.selectedIds ?? []);
    setBudget(session.budget ?? 3000);
    setSpecialistId(session.specialistId);
    setConversationPhase(session.conversationPhase ?? "listen");
    setSuggestedReplies(session.suggestedReplies ?? specialists.find((item) => item.id === session.specialistId)?.quickReplies ?? []);
    setConversationFacts(session.conversationFacts ?? []);
    setKnownContextKeys(session.knownContextKeys ?? []);
    setAskedContextKeys(session.askedContextKeys ?? []);
    if (session.replyMode) setReplyModes((current) => ({ ...current, [session.specialistId]: session.replyMode! }));
    setInput("");
    setHistoryOpen(false);
  }

  function openHistoryReview(session?: ChatSession) {
    const target = session ?? sessions.find((item) => item.id === activeSessionId) ?? sessions[0];
    setReviewSessionId(target?.id ?? "");
    setHistoryReviewOpen(true);
    setHistoryOpen(false);
  }

  function resumeReviewedSession() {
    if (!reviewSession) return;
    openSession(reviewSession);
    setHistoryReviewOpen(false);
  }

  function chooseSpecialist(nextId: SpecialistId) {
    if (busy || nextId === specialistId) return;
    const firstUserMessage = messages.find((message) => message.role === "user")?.text;
    const currentSnapshot: ChatSession = {
      id: activeSessionId,
      title: firstUserMessage?.slice(0, 24) || "新しい美容相談",
      updatedAt: new Date().toISOString(),
      messages,
      stage,
      selectedIds,
      budget,
      specialistId,
      conversationPhase,
      suggestedReplies,
      conversationFacts,
      knownContextKeys,
      askedContextKeys,
      replyMode: replyModes[specialistId],
    };
    const saved = [currentSnapshot, ...sessions.filter((session) => session.id !== activeSessionId)]
      .filter((session) => session.messages.some((message) => message.role === "user"));
    setSessions(saved);
    setSpecialistId(nextId);
    setPendingImages([]);
    setInput("");
    setHistoryOpen(false);
    setActiveSessionId(createSessionId());
    setMessages([initialMessageFor(nextId)]);
    setStage("concern");
    setSelectedIds([]);
    setBudget(3000);
    setConversationPhase("listen");
    setSuggestedReplies(specialists.find((item) => item.id === nextId)?.quickReplies ?? []);
    setConversationFacts([]);
    setKnownContextKeys([]);
    setAskedContextKeys([]);
    setServiceNotice("");
  }

  async function retryHistorySync() {
    const pending = storedSessions(historyOutboxKey);
    if (!pending.length) {
      setHistorySyncState("saved");
      return;
    }
    setHistorySyncState("saving");
    try {
      await syncSessionBatch(pending);
      storeSessions(historyOutboxKey, []);
      setHistorySyncState("saved");
    } catch {
      setHistorySyncState("error");
    }
  }

  async function addCustomItem() {
    if (!customItemDraft.name.trim() || customItemSaving) return;
    setCustomItemSaving(true);
    try {
      const response = await fetch("/api/owned-items", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(customItemDraft),
      });
      if (!response.ok) throw new Error("save failed");
      const data = await response.json() as { item: CustomOwnedItem };
      setCustomItems((current) => [data.item, ...current.filter((item) => item.id !== data.item.id)]);
      setCustomItemDraft({ brand: "", name: "", category: "moisturizer", note: "" });
    } catch {
      window.alert("マイアイテムを追加できませんでした。通信状態を確認してください。");
    } finally {
      setCustomItemSaving(false);
    }
  }

  async function removeCustomItem(id: string) {
    if (!window.confirm("このマイアイテムを一覧から外しますか？")) return;
    try {
      const response = await fetch(`/api/owned-items?id=${encodeURIComponent(id)}`, { method: "DELETE", credentials: "same-origin" });
      if (!response.ok) throw new Error("delete failed");
      setCustomItems((current) => current.filter((item) => item.id !== id));
    } catch {
      window.alert("マイアイテムを外せませんでした。通信状態を確認してください。");
    }
  }

  function sessionTime(value: string) {
    const date = new Date(value);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit" }).format(date);
    }
    return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" }).format(date);
  }

  return (
    <div className="app-shell">
      {splashVisible && (
        <div className="app-splash" role="status" aria-label="CHIGIRI Beautyを開いています">
          <div className="splash-glow" aria-hidden="true" />
          <div className="splash-icon" aria-hidden="true" />
          <div className="splash-name">CHIGIRI</div>
          <div className="splash-caption">BEAUTY CONCIERGE</div>
        </div>
      )}
      <button
        type="button"
        className={`history-backdrop ${historyOpen ? "visible" : ""}`}
        onClick={() => setHistoryOpen(false)}
        aria-label="相談履歴を閉じる"
        tabIndex={historyOpen ? 0 : -1}
      />
      <aside className={`rail ${historyOpen ? "mobile-open" : ""}`} aria-label="相談履歴">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true" />
          <div>
            <div className="brand-name">CHIGIRI</div>
            <div className="brand-caption">あなたの美容相談室</div>
          </div>
          <button type="button" className="rail-close" onClick={() => setHistoryOpen(false)} aria-label="相談履歴を閉じる">×</button>
        </div>
        <div className="rail-card specialist-card">
          <div className="eyebrow">美容コンシェルジュ</div>
          <h2>相談先を選ぶ</h2>
          <p>気になることに合う担当を選べます。過去の会話は履歴から開けます。</p>
          <div className="specialist-list" aria-label="美容専門家を選択">
            {specialists.map((specialist) => (
              <button type="button" key={specialist.id} className={`specialist-option ${specialist.id === specialistId ? "active" : ""}`} onClick={() => chooseSpecialist(specialist.id)} aria-pressed={specialist.id === specialistId}>
                <span className="specialist-icon" aria-hidden="true">{specialist.icon}</span>
                <span><b>{specialist.name}</b><small>{specialist.role}</small></span>
              </button>
            ))}
          </div>
        </div>
        <div className="history-panel">
          <div className="history-head">
            <div>
              <div className="eyebrow">チャット</div>
              <h3>相談履歴</h3>
            </div>
            <div className="history-head-actions">
              <button type="button" onClick={startNewSession} aria-label="新しい相談を始める">＋</button>
            </div>
          </div>
          <div className="history-list">
            {visibleSessions.length ? visibleSessions.map((session) => {
              const sessionSpecialist = specialists.find((item) => item.id === session.specialistId) ?? specialists[0];
              return (
                <div
                  key={session.id}
                  className={`history-row ${session.id === activeSessionId ? "active" : ""}`}
                >
                  <button
                    type="button"
                    className="history-item"
                    onClick={() => openSession(session)}
                    aria-current={session.id === activeSessionId ? "page" : undefined}
                    title={`${session.title} — ${sessionSpecialist.name}`}
                  >
                    <span className="history-title"><b>{session.title}</b></span>
                    <span className="history-item-actions" aria-hidden="true"><span>{sessionSpecialist.name}</span><time>{sessionTime(session.updatedAt)}</time></span>
                  </button>
                </div>
              );
            }) : <p className="history-empty">相談を始めると、ここにチャット履歴が残ります。</p>}
          </div>
          {visibleSessions.length ? <button type="button" className="history-review-link" onClick={() => openHistoryReview()}>履歴を検索・すべて見る</button> : null}
          <p className={`history-retention ${historySyncState === "error" ? "error" : ""}`}>
            {historySyncState === "loading" ? "すべての相談ログを読み込んでいます" : historySyncState === "saving" ? "相談内容を保存中" : historySyncState === "error" ? "この端末には保持しています。再同期してください" : "相談ログは削除せず、すべて保存します"}
          </p>
          {historySyncState === "error" ? <button type="button" className="history-more" onClick={() => void retryHistorySync()}>相談履歴を再同期</button> : null}
        </div>
        <div className="rail-bottom">強い痛みや腫れなどがある場合は、製品の使用を止めて医療機関へ相談してください。</div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            <button type="button" className="mobile-history-button" onClick={() => setHistoryOpen(true)} aria-label="相談履歴を開く">
              <span aria-hidden="true">☰</span><span>専門家・履歴</span>
            </button>
            <div className="status">{activeSpecialist.name} · {activeSpecialist.role}</div>
          </div>
          <div className="topbar-actions">
            <button className="utility-button history-review-button" onClick={() => openHistoryReview()}>相談ログ</button>
            <button className="utility-button plan-button" onClick={() => setPlanOpen(true)}>今日のプラン</button>
            <button className="utility-button condition-button" onClick={() => setConditionOpen(true)}>今日の調子</button>
            <button className="utility-button shelf-button" onClick={() => setShelfOpen(true)}>マイアイテム{selectedIds.length + customItems.length ? ` ${selectedIds.length + customItems.length}` : ""}</button>
          </div>
        </header>

        <div className="conversation">
          <section className="intro">
            <div className="eyebrow">{activeSpecialist.name} · {activeSpecialist.role}</div>
            <h1>今の悩みを、<br />そのまま聞かせてください。</h1>
            <p>普段使っているものや、いつもの過ごし方も教えてください。</p>
            <div className="reply-mode-picker" aria-label={`${activeSpecialist.name}の返答モード`}>
              {replyModeOptions.map((mode) => (
                <button type="button" key={mode.id} className={replyModes[specialistId] === mode.id ? "active" : ""} onClick={() => setReplyModes((current) => ({ ...current, [specialistId]: mode.id }))} aria-pressed={replyModes[specialistId] === mode.id}>
                  <b>{mode.label}</b><span>{mode.detail}</span>
                </button>
              ))}
            </div>
            {serviceNotice ? <div className="service-notice" role="status">{serviceNotice}</div> : null}
          </section>

          <div className="messages" aria-live="polite">
            {messages.map((message) => (
              <div className={`message ${message.role}`} key={message.id}>
                {message.role === "assistant" && <div className="avatar" aria-label="CHIGIRI" />}
                <div className="bubble">
                  {message.text}
                  {!!message.recommendedProducts?.length && (
                    <div className="message-products" aria-label="おすすめの製品候補">
                      {message.recommendedProducts.map((product) => {
                        const evidence = message.recommendationReviews?.find((item) => item.productId === product.id);
                        return <article className="message-product-card" key={product.id}>
                          <div className="message-product-heading">
                            <img
                              className="product-photo"
                              src={productImageSource(product)}
                              alt={`${product.brand} ${product.name}の公式商品写真`}
                              loading="lazy"
                              onError={(event) => { event.currentTarget.hidden = true; }}
                            />
                            <div>
                              <span>{categoryLabels[product.category]}の候補</span>
                              <b>{product.brand}</b>
                              <strong>{product.name}</strong>
                            </div>
                          </div>
                          <p>{product.claims[0]}</p>
                          <aside className="product-caution" role="note" aria-label={`${product.name}を使う前の注意`}>
                            <strong>使う前の注意</strong>
                            <p>{productUseCaution(product)}</p>
                          </aside>
                          <div className="proposal-review" aria-label={`${product.name}の口コミ情報`}>
                            <span>口コミ</span>
                            {evidence?.review.status === "available" ? (
                              <p><b>★ {evidence.review.average?.toFixed(1) ?? "--"} / 5</b> <small>（{evidence.review.count?.toLocaleString("ja-JP") ?? 0}件・{evidence.review.source}）</small></p>
                            ) : (
                              <p>数値評価は未取得です。最新情報は投稿元で確認できます。</p>
                            )}
                            <a href={evidence?.review.reviewUrl ?? evidence?.links.rakuten ?? `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(`${product.brand} ${product.name}`)}/`} target="_blank" rel="noopener noreferrer">口コミを確認する ↗</a>
                            <small>評価は参考情報です。使用感には個人差があります。</small>
                          </div>
                          <div>
                            <small>{product.volume ?? "容量は公式ページで確認"} · {priceText(product)}</small>
                            <a href={product.officialUrl} target="_blank" rel="noopener noreferrer">商品を見る ↗</a>
                          </div>
                          <button type="button" className="insight-open" onClick={() => openProductInsight(product.id)}>成分・違い・口コミを見る</button>
                        </article>;
                      })}
                    </div>
                  )}
                  {!!message.images?.length && (
                    <div className="message-images" aria-label="添付画像">
                      {message.images.map((image) => <a key={image.id} href={image.url} target="_blank" rel="noopener noreferrer"><img src={image.url} alt={image.name || "添付した写真"} /></a>)}
                    </div>
                  )}
                  <div className="message-time">{message.time}</div>
                </div>
              </div>
            ))}

            {busy && (
              <div className="message">
                <div className="avatar" aria-label="CHIGIRI" />
                <div className="typing" aria-label="返信を考えています"><i /><i /><i /><span>回答を考えています…</span></div>
              </div>
            )}

            {!busy && stage !== "inventory" && suggestedReplies.length > 0 && (
              <div className="quick-replies">
                {suggestedReplies.map((reply) => (
                  <button key={reply} onClick={() => void send(reply)}>{reply}</button>
                ))}
              </div>
            )}

            {!busy && stage === "inventory" && (
              <div className="product-picker">
                <div className="product-picker-head">
                  <div>
                    <strong>{activeSpecialist.role}の手持ちアイテム</strong>
                    <small>いつも使っているものを選んでください。見つからない場合は、あとで会話から伝えられます。</small>
                  </div>
                  <span>{selectedIds.length + customItems.length}件登録中</span>
                </div>
                <div className="product-filters">
                  <input
                    type="search"
                    value={productQuery}
                    onChange={(event) => {
                      setProductQuery(event.target.value);
                      setCatalogLimit(60);
                    }}
                    placeholder="ブランド名・商品名で検索"
                    aria-label="手持ち商品を検索"
                  />
                  <select
                    value={marketFilter}
                    onChange={(event) => {
                      setMarketFilter(event.target.value as MarketFilter);
                      setCatalogLimit(60);
                    }}
                    aria-label="ブランドの国を絞り込む"
                  >
                    <option value="all">日本・韓国</option>
                    <option value="JP">日本コスメ</option>
                    <option value="KR">韓国コスメ</option>
                  </select>
                  <select
                    value={categoryFilter}
                    onChange={(event) => {
                      setCategoryFilter(event.target.value as CategoryFilter);
                      setCatalogLimit(60);
                    }}
                    aria-label="商品カテゴリを絞り込む"
                  >
                    <option value="all">全カテゴリ</option>
                    {Object.entries(categoryLabels).map(([value, label]) => (
                      <option value={value} key={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="filter-summary">見つかったアイテム {specialistVisibleProducts.length}件</div>
                <div className="product-grid">
                  {specialistVisibleProducts.map((product) => (
                    <button
                      key={product.id}
                      className={`product-option ${selectedIds.includes(product.id) ? "selected" : ""}`}
                      onClick={() => toggleProduct(product.id)}
                    >
                      <b>{product.brand}<small>｜ {product.name}</small></b>
                      <span>{marketOf(product) === "JP" ? "日本" : "韓国"} · {categoryLabels[product.category]}</span>
                    </button>
                  ))}
                  {!specialistVisibleProducts.length && (
                    <p className="no-products">条件に合う商品がありません。検索語か絞り込みを変更してください。</p>
                  )}
                </div>
                <div className="picker-actions">
                  <button className="picker-skip" onClick={() => void send("手持ちはまだ登録していません")}>まだ分からない</button>
                  <button className="picker-done" disabled={!selectedIds.length && !customItems.length} onClick={finishInventory}>この内容で相談する</button>
                </div>
              </div>
            )}

            {!busy && specialistId === "skin" && stage === "complete" && (
              <div className="result-card">
                <div className="selection-summary">
                  <div className="selection-check" aria-hidden="true">✓</div>
                  <div>
                    <div className="eyebrow">今回のケア</div>
                    <h3>まずはこの内容で試してみましょう</h3>
                    <p>今の悩みと手持ち、予算に合うものを選びました。</p>
                  </div>
                </div>
                <div className="result-hero">
                  <div className="result-hero-row">
                    <div>
                      <div className="eyebrow">CHIGIRI PLAN</div>
                      <h3>{result.title}</h3>
                      <p>{result.reason}</p>
                    </div>
                    <div className="saving">
                      <strong>{result.recommendation ? "買い足し 1点" : "買い足し 0点"}</strong>
                      <span>{result.shopping.name}</span>
                    </div>
                  </div>
                </div>
                <div className="result-body">
                  <div className="routine-columns">
                    <div className="routine">
                      <h4>☀ 朝のルーティン</h4>
                      {result.morning.map((product, index) => (
                        <div className="routine-step" key={product.id}><span className="step-no">{index + 1}</span><span>{product.name}<br />{categoryLabels[product.category]}</span></div>
                      ))}
                    </div>
                    <div className="routine">
                      <h4>☾ 夜のルーティン</h4>
                      {result.night.map((product, index) => (
                        <div className="routine-step" key={product.id}><span className="step-no">{index + 1}</span><span>{product.name}<br />{categoryLabels[product.category]}</span></div>
                      ))}
                    </div>
                  </div>
                  {result.recommendation ? (
                    <article className="recommendation purchase-card">
                      <div className="purchase-heading">
                        <div className="purchase-product-media">
                          <img
                            className="product-photo purchase-photo"
                            src={productImageSource(result.recommendation)}
                            alt={`${result.recommendation.brand} ${result.recommendation.name}の公式商品写真`}
                            loading="lazy"
                            onError={(event) => { event.currentTarget.hidden = true; }}
                          />
                          <div>
                            <span className="product-kicker">必要なら追加するもの · {categoryLabels[result.recommendation.category]}</span>
                            <h4>{result.recommendation.brand}</h4>
                            <h3>{result.recommendation.name}</h3>
                          </div>
                        </div>
                        <div className="purchase-price">
                          <strong>{priceText(result.recommendation)}</strong>
                          <span>{result.recommendation.volume ?? "容量は公式ページで確認"}</span>
                        </div>
                      </div>

                      <div className="product-description">
                        <h5>どんなアイテム？</h5>
                        <p>{result.recommendation.claims?.[0] ?? "詳しい特徴は商品ページで確認できます。"}</p>
                      </div>
                      <aside className="product-caution purchase-caution" role="note" aria-label={`${result.recommendation.name}を使う前の注意`}>
                        <strong>使う前の注意</strong>
                        <p>{productUseCaution(result.recommendation)}</p>
                      </aside>

                      {!!result.recommendation.ingredientHighlights?.length && (
                        <div className="ingredient-list" aria-label="公式ページで確認した注目成分">
                          <span>商品ページに記載されている成分</span>
                          <div>
                            {result.recommendation.ingredientHighlights.map((ingredient) => (
                              <b key={ingredient}>{ingredient}</b>
                            ))}
                          </div>
                        </div>
                      )}

                      <button type="button" className="insight-open result-insight-open" onClick={() => openProductInsight(result.recommendation!.id)}>成分・手持ちとの違い・口コミを見る</button>

                      <div className="recommendation-reason">
                        <h5>選んだ理由</h5>
                        <p>手持ちにない役割を補えて、予算{budget.toLocaleString("ja-JP")}円以内に収まるものを選びました。</p>
                      </div>

                      <div className="purchase-actions">
                        <a
                          className="purchase-link"
                          href={purchaseDestination(result.recommendation).url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${result.recommendation.name}の${purchaseDestination(result.recommendation).label}`}
                        >
                          {purchaseDestination(result.recommendation).label}<span aria-hidden="true">↗</span>
                        </a>
                        <small>{purchaseDestination(result.recommendation).note}</small>
                      </div>

                      <details className="evidence-details">
                        <summary>商品情報を確認</summary>
                        <p>{result.recommendation.sourcePublisher}の商品ページで内容を確認できます。</p>
                        <a href={result.recommendation.officialUrl} target="_blank" rel="noopener noreferrer">商品ページを見る ↗</a>
                      </details>
                    </article>
                  ) : result.missing.length ? (
                    <div className="recommendation"><h4>まずは手持ちだけで大丈夫です</h4><p>{result.shopping.id === "use-only" ? "足りない役割はありますが、先に使い方を整えて変化を見ましょう。" : "予算に合うものが見つからなかったので、今回は無理に買い足さなくて大丈夫です。"}</p></div>
                  ) : (
                    <div className="recommendation"><h4>新しい商品は必要ありません</h4><p>洗顔・保湿・紫外線対策の役割を、現在の手持ちで構成できます。まずはこの流れを続けて、使用感を見てから考えましょう。</p></div>
                  )}
                  <div className="result-note">肌や髪に合わないと感じたときは使用を中止してください。気になる症状が続く場合は、医療機関へご相談ください。</div>
                  <div className="proposal-followup">
                    <div>
                      <h4>内容を変えたいときは</h4>
                      <p>下のチャットで希望を教えてください。予算や手持ちに合わせて選び直します。</p>
                    </div>
                    <div className="proposal-followup-actions" aria-label="提案の調整例">
                      {["もっと予算を抑えたい", "買い足しなしで考えたい", "朝のケアを簡単にしたい", "別の商品も見たい"].map((reply) => (
                        <button type="button" key={reply} onClick={() => void send(reply)}>{reply}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        </div>

        <div className="composer-wrap">
          <form className="composer" onSubmit={(event) => { event.preventDefault(); void send(); }}>
            <input ref={imageInputRef} className="image-input" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => void addImages(event.target.files)} aria-label="写真を追加" />
            <button className="attach" type="button" onClick={() => imageInputRef.current?.click()} disabled={busy || uploading || stage === "inventory" || pendingImages.length >= 3} aria-label="写真を追加">⌁</button>
            <input
              aria-label="相談内容"
              value={input}
              disabled={busy || stage === "inventory"}
              onChange={(event) => setInput(event.target.value)}
              placeholder={stage === "complete" ? "気になる点や変えたいことを入力" : stage === "inventory" ? "上の商品から選んでください" : "気になっていることを入力"}
            />
            <button className="send" type="submit" disabled={(!input.trim() && !pendingImages.length) || busy || uploading || stage === "inventory"} aria-label="送信">↑</button>
          </form>
          {!!pendingImages.length && (
            <div className="pending-images" aria-label="送信予定の画像">
              {pendingImages.map((image) => <div className="pending-image" key={image.id}><img src={image.url} alt={image.name || "送信予定の写真"} /><button type="button" onClick={() => void removePendingImage(image)} aria-label={`${image.name}を削除`}>×</button></div>)}
            </div>
          )}
          <div className="privacy">名前・住所などの個人情報は入力しないでください。強い症状があるときは医療機関へご相談ください。</div>
        </div>
      </main>

      {historyReviewOpen && (
        <div className="history-review-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setHistoryReviewOpen(false); }}>
          <section className="history-review-dialog" role="dialog" aria-modal="true" aria-labelledby="history-review-title">
            <header className="history-review-header">
              <div>
                <div className="eyebrow">Consultation log</div>
                <h2 id="history-review-title">これまでの相談を見返す</h2>
                <p>相談内容と回答を、会話の流れのまま確認できます。</p>
              </div>
              <button type="button" className="close" onClick={() => setHistoryReviewOpen(false)} aria-label="相談ログを閉じる">×</button>
            </header>

            <div className="history-review-tools">
              <input type="search" value={historyReviewQuery} onChange={(event) => setHistoryReviewQuery(event.target.value)} placeholder="相談内容を検索" aria-label="相談ログを検索" />
              <div className="history-specialist-filters" aria-label="担当者で絞り込む">
                <button type="button" className={historySpecialistFilter === "all" ? "active" : ""} onClick={() => setHistorySpecialistFilter("all")}>すべて</button>
                {specialists.map((specialist) => <button type="button" key={specialist.id} className={historySpecialistFilter === specialist.id ? "active" : ""} onClick={() => setHistorySpecialistFilter(specialist.id)}>{specialist.name}</button>)}
              </div>
            </div>

            <div className="history-review-layout">
              <nav className="history-review-list" aria-label="保存済みの相談ログ">
                <div className="history-review-count">{reviewSessions.length}件の相談</div>
                {reviewSessions.length ? reviewSessions.map((session) => {
                  const specialist = specialists.find((item) => item.id === session.specialistId) ?? specialists[0];
                  const userTurns = session.messages.filter((message) => message.role === "user").length;
                  return <button type="button" key={session.id} className={reviewSession?.id === session.id ? "active" : ""} onClick={() => setReviewSessionId(session.id)} aria-pressed={reviewSession?.id === session.id}>
                    <span><b>{specialist.name}</b><time>{new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "short", day: "numeric" }).format(new Date(session.updatedAt))}</time></span>
                    <strong>{session.title}</strong>
                    <small>{userTurns}往復 · {session.messages.at(-1)?.text.replace(/\n/g, " ").slice(0, 46)}</small>
                  </button>;
                }) : <p className="history-review-empty">条件に合う相談ログはありません。</p>}
              </nav>

              <article className="history-transcript" aria-live="polite">
                {reviewSession ? <>
                  <div className="history-transcript-head">
                    <div>
                      <span>{specialists.find((item) => item.id === reviewSession.specialistId)?.name} · {specialists.find((item) => item.id === reviewSession.specialistId)?.role}</span>
                      <h3>{reviewSession.title}</h3>
                      <time>{new Intl.DateTimeFormat("ja-JP", { dateStyle: "long", timeStyle: "short" }).format(new Date(reviewSession.updatedAt))}</time>
                    </div>
                    <button type="button" onClick={resumeReviewedSession}>この相談を再開</button>
                  </div>
                  <div className="history-transcript-messages">
                    {reviewSession.messages.map((message) => <div className={`history-transcript-message ${message.role}`} key={message.id}>
                      <span>{message.role === "user" ? "あなた" : specialists.find((item) => item.id === reviewSession.specialistId)?.name}</span>
                      <div>{message.text}</div>
                      {!!message.recommendedProducts?.length && <section className="history-transcript-products" aria-label="この回答で提案した商品">
                        <b>この回答で提案した商品</b>
                        {message.recommendedProducts.map((product) => <button type="button" key={product.id} onClick={() => { setHistoryReviewOpen(false); openProductInsight(product.id); }}><span>{product.brand}</span>{product.name}</button>)}
                      </section>}
                      <time>{message.time}</time>
                    </div>)}
                  </div>
                </> : <div className="history-transcript-placeholder"><b>相談ログを選択してください</b><span>左の一覧から、読み返したい相談を選べます。</span></div>}
              </article>
            </div>
          </section>
        </div>
      )}

      {planOpen && (
        <aside className="catalog-panel daily-plan-panel" aria-label="今日のビューティープラン">
          <div className="catalog-head">
            <div>
              <div className="eyebrow">今日のプラン</div>
              <h2>今日やることは、これだけ</h2>
              <p>手持ち・天気・睡眠・これまでの相談をつないで、優先するケアを3つに絞りました。</p>
            </div>
            <button className="close" onClick={() => setPlanOpen(false)} aria-label="閉じる">×</button>
          </div>
          <div className="plan-signal-row" aria-label="プランに使った情報">
            <span>手持ち {selectedProducts.length}点</span>
            <span>記録 {conditions.length}件</span>
            <span>相談 {sessions.filter((session) => session.messages.some((message) => message.role === "user")).length}件</span>
          </div>
          <div className="daily-actions">
            {todayPlan.map((action, index) => {
              const specialist = specialists.find((item) => item.id === action.specialist) ?? specialists[0];
              return (
                <article key={`${action.specialist}-${action.title}`}>
                  <span>{String(index + 1).padStart(2, "0")} · {specialist.name}</span>
                  <h3>{action.title}</h3>
                  <p>{action.detail}</p>
                  <button type="button" onClick={() => { setPlanOpen(false); chooseSpecialist(action.specialist); }}>この担当に相談する</button>
                </article>
              );
            })}
          </div>
          <section className="plan-why">
            <span>CHIGIRIならでは</span>
            <p>肌・髪・ボディなどを別々に終わらせず、同じ日の天気や睡眠、手持ちを共通の手がかりとして使います。</p>
          </section>
          <button type="button" className="condition-save" onClick={() => { setPlanOpen(false); setConditionOpen(true); }}>今日の調子を記録する</button>
        </aside>
      )}

      {shelfOpen && (
        <aside className="catalog-panel" aria-label="マイアイテム">
          <div className="catalog-head">
            <div>
              <div className="eyebrow">マイアイテム</div>
              <h2>持っているもの</h2>
              <p>手持ちを先に使い、必要なものだけ追加できます。</p>
            </div>
            <button className="close" onClick={() => setShelfOpen(false)} aria-label="閉じる">×</button>
          </div>
          <section className="custom-item-section" aria-labelledby="custom-item-title">
            <div>
              <h3 id="custom-item-title">手元の商品を自分で追加</h3>
              <p>公式20商品にないものも登録できます。自己登録の商品情報は、AIが推測で補完しません。</p>
            </div>
            <div className="custom-item-form">
              <input value={customItemDraft.brand} onChange={(event) => setCustomItemDraft((current) => ({ ...current, brand: event.target.value }))} placeholder="ブランド（任意）" aria-label="ブランド名" />
              <input value={customItemDraft.name} onChange={(event) => setCustomItemDraft((current) => ({ ...current, name: event.target.value }))} placeholder="商品名" aria-label="商品名" />
              <select value={customItemDraft.category} onChange={(event) => setCustomItemDraft((current) => ({ ...current, category: event.target.value as ProductCategory }))} aria-label="商品カテゴリ">
                {Object.entries(categoryLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              </select>
              <input value={customItemDraft.note} onChange={(event) => setCustomItemDraft((current) => ({ ...current, note: event.target.value }))} placeholder="使い方・気になる点（任意）" aria-label="商品メモ" />
              <button type="button" onClick={() => void addCustomItem()} disabled={!customItemDraft.name.trim() || customItemSaving}>{customItemSaving ? "追加中…" : "マイアイテムに追加"}</button>
            </div>
            {customItems.length ? <div className="custom-item-list">
              {customItems.map((item) => <article key={item.id}>
                <div><span>{item.brand || "ブランド未入力"} · {categoryLabels[item.category]}</span><b>{item.name}</b>{item.note ? <small>{item.note}</small> : null}</div>
                <button type="button" onClick={() => void removeCustomItem(item.id)} aria-label={`${item.name}をマイアイテムから外す`}>外す</button>
              </article>)}
            </div> : null}
          </section>
          <div className="product-filters catalog-filters">
            <input
              type="search"
              value={productQuery}
              onChange={(event) => {
                setProductQuery(event.target.value);
                setCatalogLimit(60);
              }}
              placeholder="ブランド名・商品名で検索"
              aria-label="商品を検索"
            />
            <select
              value={marketFilter}
              onChange={(event) => {
                setMarketFilter(event.target.value as MarketFilter);
                setCatalogLimit(60);
              }}
              aria-label="ブランドの国を絞り込む"
            >
              <option value="all">日本・韓国</option>
              <option value="JP">日本コスメ</option>
              <option value="KR">韓国コスメ</option>
            </select>
            <select
              value={categoryFilter}
              onChange={(event) => {
                setCategoryFilter(event.target.value as CategoryFilter);
                setCatalogLimit(60);
              }}
              aria-label="商品カテゴリを絞り込む"
            >
              <option value="all">全カテゴリ</option>
              {Object.entries(categoryLabels).map(([value, label]) => (
                <option value={value} key={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="filter-summary">公式商品 {visibleProducts.length}件中 {displayedProducts.length}件を表示 · マイアイテム {selectedIds.length + customItems.length}件</div>
          <div className="catalog-list shelf-list">
            {displayedProducts.map((product) => (
              <article className={`catalog-item shelf-item ${selectedIds.includes(product.id) ? "selected" : ""}`} key={product.id}>
                <button type="button" className="shelf-toggle" onClick={() => toggleProduct(product.id)} aria-pressed={selectedIds.includes(product.id)}>
                  <div className="catalog-meta"><span>{product.brand} · {categoryLabels[product.category]}</span><span>{selectedIds.includes(product.id) ? "✓ 登録中" : "追加"}</span></div>
                  <h3>{product.name}</h3>
                </button>
                <button type="button" className="shelf-detail" onClick={() => openProductInsight(product.id)}>成分や使い方を確認</button>
              </article>
            ))}
            {!visibleProducts.length && (
              <p className="no-products">見つかりませんでした。別の名前で検索してみてください。</p>
            )}
            {displayedProducts.length < visibleProducts.length && (
              <button type="button" className="catalog-load-more" onClick={() => setCatalogLimit((current) => current + 60)}>
                さらに表示
              </button>
            )}
          </div>
        </aside>
      )}

      {conditionOpen && (
        <aside className="catalog-panel condition-panel" aria-label="今日のコンディション">
          <div className="catalog-head">
            <div>
              <div className="eyebrow">今日のコンディション</div>
              <h2>いまの調子をメモ</h2>
              <p>天気や睡眠と一緒に残すと、次の相談で変化を振り返りやすくなります。</p>
            </div>
            <button className="close" onClick={() => setConditionOpen(false)} aria-label="閉じる">×</button>
          </div>
          <div className="condition-form">
            <button type="button" className="weather-button" onClick={() => void fetchWeather()} disabled={conditionLoading}>
              {conditionLoading ? "天気を確認中…" : weatherDraft.weatherLabel ? `${weatherDraft.weatherLabel}・${weatherDraft.temperature ?? "--"}℃・湿度${weatherDraft.humidity ?? "--"}%` : "現在地から天気を追加"}
            </button>
            <small>位置情報は天気の取得だけに使い、緯度・経度は保存しません。</small>
            <label>睡眠時間
              <select value={sleepDraft} onChange={(event) => setSleepDraft(event.target.value)}>
                <option value="">記録しない</option>
                {[4, 5, 6, 7, 8, 9, 10].map((hours) => <option value={hours} key={hours}>{hours}時間くらい</option>)}
              </select>
            </label>
            <label>今日、気になること
              <textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value.slice(0, 160))} placeholder="例：夕方になると頬が乾く、湿気で髪が広がる" />
            </label>
            <button type="button" className="condition-save" onClick={() => void saveCondition()} disabled={!sleepDraft && !noteDraft.trim() && !weatherDraft.weatherLabel}>この内容を記録する</button>
          </div>
          <section className="care-forecast">
            <span>次のケアのヒント</span>
            <p>{careHint(specialistId, weatherDraft.weatherLabel ? { id: "draft", specialistId, recordedAt: new Date().toISOString(), ...weatherDraft } as ConditionEntry : latestCondition)}</p>
          </section>
          <section className="condition-history">
            <h3>{activeSpecialist.name}との記録</h3>
            {specialistConditions.length ? specialistConditions.map((entry) => (
              <article key={entry.id}>
                <div><time>{new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(entry.recordedAt))}</time><button type="button" onClick={() => void deleteCondition(entry.id)} aria-label="この記録を削除">削除</button></div>
                <p>{[entry.weatherLabel && `${entry.weatherLabel} ${entry.temperature ?? "--"}℃`, entry.sleepHours && `睡眠 ${entry.sleepHours}時間`, entry.note].filter(Boolean).join(" / ")}</p>
              </article>
            )) : <p className="no-condition">まだ記録はありません。</p>}
          </section>
        </aside>
      )}

      {detailProduct && detailInsight && (
        <div className="insight-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailProductId(null); }}>
          <aside className="insight-panel" role="dialog" aria-modal="true" aria-labelledby="product-insight-title">
            <div className="catalog-head">
              <div>
                <div className="eyebrow">このアイテムを知る</div>
                <h2 id="product-insight-title">{detailProduct.name}</h2>
                <p>{detailProduct.brand} · {categoryLabels[detailProduct.category]}</p>
              </div>
              <button className="close" onClick={() => setDetailProductId(null)} aria-label="閉じる">×</button>
            </div>

            <section className="insight-section">
              <h3>気になる成分と役割</h3>
              {detailInsight.ingredientNotes.length ? detailInsight.ingredientNotes.map((ingredient) => (
                <article className="ingredient-note" key={ingredient.name}>
                  <strong>{ingredient.name}</strong>
                  <p>{ingredient.role}</p>
                </article>
              )) : <p>商品ページに成分の詳しい記載がありません。全成分表示の写真を送ると、読み取れた範囲で確認できます。</p>}
              <p className="insight-caution">配合量や組み合わせも違うため、成分名だけで効果や不調の原因は決められません。</p>
            </section>

            <section className="insight-section">
              <h3>合わないと感じたら</h3>
              <p>いつ、どんな違和感が出たかを順に確認します。</p>
              <ul>{detailInsight.checkPoints.map((point) => <li key={point}>{point}</li>)}</ul>
              <button type="button" className="photo-ingredients" onClick={() => askFromIngredientPhoto(detailProduct)}>全成分表示を撮って相談する</button>
            </section>

            <section className="insight-section timing-card">
              <h3>使い心地を見直す時期</h3>
              <div className="timing-grid">
                <div><span>最初の確認</span><strong>{detailInsight.firstCheck}</strong></div>
                <div><span>見直す目安</span><strong>{detailInsight.nextCheck}</strong></div>
              </div>
              <p>{detailInsight.timingNote}</p>
              <small>期間は目安です。刺激や悪化があれば、すぐに使用を止めてください。</small>
            </section>

            <section className="insight-section">
              <h3>{comparisonProduct ? "手持ちとの違い" : "おすすめとの違い"}</h3>
              {comparisonProduct && comparison ? (
                <div className="comparison-card">
                  <div><span>今使っている・比較元</span><strong>{comparisonProduct.brand}<br />{comparisonProduct.name}</strong><p>{comparisonProduct.claims[0]}</p></div>
                  <div><span>確認中のアイテム</span><strong>{detailProduct.brand}<br />{detailProduct.name}</strong><p>{detailProduct.claims[0]}</p></div>
                  <p className="comparison-summary">{comparison.summary}{comparison.priceDifference == null ? "" : comparison.priceDifference === 0 ? " 価格は同程度です。" : comparison.priceDifference > 0 ? ` 候補の方が約${comparison.priceDifference.toLocaleString("ja-JP")}円高い設定です。` : ` 候補の方が約${Math.abs(comparison.priceDifference).toLocaleString("ja-JP")}円低い設定です。`}</p>
                </div>
              ) : (
                <p>マイアイテムを登録すると、役割・注目成分・価格・使い方の違いをここで並べて確認できます。</p>
              )}
            </section>

            <section className="insight-section review-section">
              <h3>口コミを確認する</h3>
              {reviewLoading ? <p>評価情報を確認しています…</p> : reviewData?.review?.status === "available" ? (
                <div className="review-score"><strong>{reviewData.review.average?.toFixed(1) ?? "--"}</strong><span> / 5　{reviewData.review.count?.toLocaleString("ja-JP") ?? 0}件</span><small>楽天市場の商品評価</small></div>
              ) : (
                <p>最新の評価は、各サイトで確認できます。</p>
              )}
              <div className="review-links">
                <a href={reviewData?.review?.reviewUrl ?? reviewData?.links?.rakuten ?? `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(`${detailProduct.brand} ${detailProduct.name}`)}/`} target="_blank" rel="noopener noreferrer">楽天市場で評価を見る ↗</a>
                <a href={reviewData?.links?.cosme ?? `https://www.cosme.net/search/?fw=${encodeURIComponent(`${detailProduct.brand} ${detailProduct.name}`)}`} target="_blank" rel="noopener noreferrer">@cosmeで口コミを見る ↗</a>
              </div>
              <small>肌質や髪質、使い方が近い人の感想を参考にしてください。</small>
            </section>

            <a className="official-detail-link" href={detailProduct.officialUrl} target="_blank" rel="noopener noreferrer">公式の商品情報を確認する ↗</a>
          </aside>
        </div>
      )}
    </div>
  );
}
