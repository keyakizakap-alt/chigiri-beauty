import { consumeChatQuota } from "@/server/chat-quota";
import { requestOwner, privateJson } from "@/server/request-owner";
import { validChatBody } from "@/server/request-validation.mjs";
import { protectMutation } from "@/server/mutation-guard";
import { createChatReply } from "@/server/orca";
import { officialProducts } from "@/data/official-products";
import { ownedUploadDataUrl } from "@/server/upload-store";

const allowedStages = new Set(["concern", "skin", "inventory", "budget", "complete"]);
const allowedSpecialists = new Set(["skin", "hair", "body", "makeup", "nail"]);

async function handlePOST(request: Request) {
  let body: {
    stage?: string;
    specialist?: string;
    input?: string;
    images?: string[];
    ownedProductIds?: string[];
    conditions?: Array<{
      specialistId?: string;
      weatherLabel?: string;
      temperature?: number;
      humidity?: number;
      sleepHours?: number;
      note?: string;
    }>;
    history?: Array<{ role?: string; text?: string; images?: string[] }>;
    memory?: { facts?: unknown[]; knownKeys?: unknown[]; askedKeys?: unknown[] };
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "入力内容を確認してください。" }, { status: 400, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  }
  if (!validChatBody(body)) return Response.json({ error: "入力内容を確認してください。" }, { status: 400 });
  const stage = body.stage ?? "concern";
  const specialist = body.specialist ?? "skin";
  const input = body.input?.trim() ?? "";
  const history = (body.history ?? [])
    .filter((message) => (message.role === "assistant" || message.role === "user") && message.text?.trim())
    // 確認済みの条件はこの履歴から毎回導出するため、窓が狭いと古い発言の
    // 悩み・タイミング・好みが失われる。LLM へ渡すのは orca 側で直近12件に絞る。
    .slice(-60)
    .map((message) => ({
      role: message.role as "assistant" | "user",
      text: message.text!.trim().slice(0, 600),
      images: [] as string[],
    }));
  const memory = {
    facts: (body.memory?.facts ?? []).filter((value): value is string => typeof value === "string" && value.trim().length > 0).map((value) => value.trim().slice(0, 120)).slice(0, 20),
    knownKeys: (body.memory?.knownKeys ?? []).filter((value): value is string => typeof value === "string").map((value) => value.slice(0, 30)).slice(0, 12),
    askedKeys: (body.memory?.askedKeys ?? []).filter((value): value is string => typeof value === "string").map((value) => value.slice(0, 30)).slice(0, 12),
  };

  const imageIds = (body.images ?? []).flatMap((value) => {
    if (typeof value !== "string" || !value.startsWith("/api/uploads?")) return [];
    const id = new URL(value, request.url).searchParams.get("id");
    return id ? [id] : [];
  }).slice(0, 2);
  const images = (await Promise.all(imageIds.map((id) => ownedUploadDataUrl(request, id)))).filter((value): value is string => Boolean(value));
  const ownedIds = (body.ownedProductIds ?? []).filter((id): id is string => typeof id === "string").slice(0, 50);
  const ownedProducts = officialProducts.filter((product) => ownedIds.includes(product.id));
  const specialistLabels: Record<string, string> = { skin: "肌", hair: "髪・頭皮", body: "ボディ", makeup: "メイク", nail: "爪・手肌" };
  const conditionParts = (body.conditions ?? []).filter((condition) => condition?.specialistId === specialist).slice(0, 1).flatMap((condition) => {
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
  if (!allowedStages.has(stage) || !allowedSpecialists.has(specialist) || (!input && !imageIds.length) || input.length > 600 || images.length !== imageIds.length) {
    return Response.json({ error: "入力内容を確認してください。" }, { status: 400 });
  }

  const owner = await requestOwner(request);
  // The local guidance engine has no variable model cost. Keep the public demo
  // usable when OrcaRouter is intentionally not configured; persisted quotas
  // remain fail-closed whenever a paid upstream model is enabled.
  if (process.env.ORCAROUTER_API_KEY?.trim() && !await consumeChatQuota(owner.key)) {
    const response = privateJson({ error: "相談の利用上限に達しました。時間をおいて再試行してください。" }, 429, owner.setCookie);
    response.headers.set("Retry-After", "60");
    return response;
  }
  const reply = await createChatReply(
    stage as "concern" | "skin" | "inventory" | "budget" | "complete",
    specialist as "skin" | "hair" | "body" | "makeup" | "nail",
    input,
    history,
    images,
    ownedProducts,
    conditionParts.join("・"),
    memory,
  );
  return privateJson(reply, 200, owner.setCookie);
}

export const POST = protectMutation(handlePOST, 131072);
