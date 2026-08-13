import { createChatReply } from "@/server/orca";
import { officialProducts } from "@/data/official-products";
import { ownedUploadDataUrl } from "@/server/upload-store";

const allowedStages = new Set(["concern", "skin", "inventory", "budget", "complete"]);
const allowedSpecialists = new Set(["skin", "hair", "body", "makeup", "nail"]);
const allowedReplyModes = new Set(["quick", "balanced", "deep"]);
const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

function badRequest() {
  return Response.json({ error: "入力内容を確認してください。" }, { status: 400, headers: privateHeaders });
}

export async function POST(request: Request) {
  let body: {
    stage?: string;
    specialist?: string;
    input?: string;
    images?: string[];
    ownedProductIds?: string[];
    replyMode?: string;
    customOwnedItems?: Array<{ brand?: unknown; name?: unknown; category?: unknown; note?: unknown }>;
    conditions?: Array<{
      specialistId?: string;
      weatherLabel?: string;
      temperature?: number;
      humidity?: number;
      sleepHours?: number;
      note?: string;
    }>;
    history?: Array<{ role?: string; text?: string; images?: string[] }>;
    memory?: { knownKeys?: unknown[]; askedKeys?: unknown[] };
  };
  try {
    body = await request.json();
  } catch {
    return badRequest();
  }
  const stage = body.stage ?? "concern";
  const specialist = body.specialist ?? "skin";
  const input = body.input?.trim() ?? "";
  const history = (body.history ?? [])
    .filter((message) => (message.role === "assistant" || message.role === "user") && message.text?.trim())
    .slice(-20)
    .map((message) => ({
      role: message.role as "assistant" | "user",
      text: message.text!.trim().slice(0, 600),
      images: [] as string[],
    }));
  // facts は受け取らない。会話から確認済みの条件はサーバー側で毎回導出する。
  // knownKeys / askedKeys は担当ごとの既知キーに照合してから使う。
  const memory = {
    knownKeys: (body.memory?.knownKeys ?? []).filter((value): value is string => typeof value === "string").map((value) => value.slice(0, 30)).slice(0, 12),
    askedKeys: (body.memory?.askedKeys ?? []).filter((value): value is string => typeof value === "string").map((value) => value.slice(0, 30)).slice(0, 12),
  };

  const imageIds = (body.images ?? []).flatMap((value) => {
    if (typeof value !== "string" || !value.startsWith("/api/uploads?")) return [];
    const id = new URL(value, request.url).searchParams.get("id");
    return id ? [id] : [];
  }).slice(0, 2);
  // R2 から画像を読み出す前に、扱える入力かどうかを先に確かめる。
  if (!allowedStages.has(stage) || !allowedSpecialists.has(specialist) || (!input && !imageIds.length) || input.length > 600) {
    return badRequest();
  }
  const images = (await Promise.all(imageIds.map((id) => ownedUploadDataUrl(request, id)))).filter((value): value is string => Boolean(value));
  if (images.length !== imageIds.length) return badRequest();
  const ownedIds = (body.ownedProductIds ?? []).filter((id): id is string => typeof id === "string").slice(0, 50);
  const ownedProducts = officialProducts.filter((product) => ownedIds.includes(product.id));
  const replyMode = allowedReplyModes.has(body.replyMode ?? "") ? body.replyMode as "quick" | "balanced" | "deep" : "balanced";
  const customOwnedItems = (body.customOwnedItems ?? []).slice(0, 50).flatMap((item) => {
    if (!item || typeof item !== "object" || typeof item.name !== "string" || !item.name.trim()) return [];
    return [{
      brand: typeof item.brand === "string" ? item.brand.trim().slice(0, 60) : "",
      name: item.name.trim().slice(0, 120),
      category: typeof item.category === "string" ? item.category.slice(0, 30) : "未分類",
      note: typeof item.note === "string" ? item.note.trim().slice(0, 240) : "",
    }];
  });
  const specialistLabels: Record<string, string> = { skin: "肌", hair: "髪・頭皮", body: "ボディ", makeup: "メイク", nail: "爪・手肌" };
  const conditionParts = (body.conditions ?? []).slice(0, 5).flatMap((condition) => {
    if (!condition || typeof condition !== "object") return [];
    const parts: string[] = [];
    if (typeof condition.weatherLabel === "string" && condition.weatherLabel.length <= 30) parts.push(condition.weatherLabel);
    if (typeof condition.temperature === "number" && condition.temperature >= -50 && condition.temperature <= 60) parts.push(`${condition.temperature}℃`);
    if (typeof condition.humidity === "number" && condition.humidity >= 0 && condition.humidity <= 100) parts.push(`湿度${condition.humidity}%`);
    if (typeof condition.sleepHours === "number" && condition.sleepHours >= 0 && condition.sleepHours <= 24) parts.push(`睡眠${condition.sleepHours}時間`);
    if (typeof condition.note === "string" && condition.note.trim() && condition.note.length <= 160) parts.push(condition.note.trim());
    if (!parts.length) return [];
    return [`${specialistLabels[condition.specialistId ?? ""] ?? "美容"}: ${parts.join("・")}`];
  });
  const reply = await createChatReply(
    stage as "concern" | "skin" | "inventory" | "budget" | "complete",
    specialist as "skin" | "hair" | "body" | "makeup" | "nail",
    input,
    history,
    images,
    ownedProducts,
    conditionParts.join("・"),
    memory,
    replyMode,
    customOwnedItems,
  );
  return Response.json(reply, { headers: privateHeaders });
}
