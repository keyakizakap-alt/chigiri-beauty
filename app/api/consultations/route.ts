import { and, desc, eq } from "drizzle-orm";
import { ensureAppStorage, getDb } from "@/db";
import { chatSessions } from "@/db/schema";
import { privateJson, requestOwner } from "@/server/request-owner";
const specialists = new Set(["skin", "hair", "body", "makeup", "nail"]);
const sessionIdPattern = /^[a-zA-Z0-9-]{8,80}$/;
const pageSize = 40;

type StoredSession = {
  id: string;
  title: string;
  updatedAt: string;
  specialistId: string;
  messages: unknown[];
  [key: string]: unknown;
};

function validateSession(value: unknown): StoredSession | null {
  if (!value || typeof value !== "object") return null;
  const session = value as Partial<StoredSession>;
  if (
    typeof session.id !== "string" || !sessionIdPattern.test(session.id)
    || typeof session.title !== "string" || !session.title.trim() || session.title.length > 80
    || typeof session.updatedAt !== "string" || Number.isNaN(Date.parse(session.updatedAt))
    || typeof session.specialistId !== "string" || !specialists.has(session.specialistId)
    || !Array.isArray(session.messages)
  ) return null;
  return session as StoredSession;
}

export async function GET(request: Request) {
  const owner = await requestOwner(request);
  const url = new URL(request.url);
  const specialist = url.searchParams.get("specialist");
  // specialist は任意。省略時は全担当の相談ログをまとめて返す。担当ごとに
  // 5本のリクエストを投げると、そのうち1本が落ちただけで画面の履歴が
  // すべて空になってしまうため、既定は1回の取得で済ませる。
  if (specialist !== null && !specialists.has(specialist)) {
    return privateJson({ error: "担当コンシェルジュを確認できません。" }, 400, owner.setCookie);
  }
  const parsedCursor = Number(url.searchParams.get("cursor") ?? "0");
  const offset = Number.isSafeInteger(parsedCursor) && parsedCursor >= 0 ? parsedCursor : 0;

  try {
    await ensureAppStorage();
    const db = await getDb();
    const owned = specialist === null
      ? eq(chatSessions.ownerKey, owner.key)
      : and(eq(chatSessions.ownerKey, owner.key), eq(chatSessions.specialistId, specialist));
    const rows = await db.select({ payloadJson: chatSessions.payloadJson })
      .from(chatSessions)
      .where(owned)
      .orderBy(desc(chatSessions.updatedAt))
      .limit(pageSize + 1)
      .offset(offset);
    const hasMore = rows.length > pageSize;
    const sessions = rows.slice(0, pageSize).flatMap((row) => {
      try { return [JSON.parse(row.payloadJson)]; } catch { return []; }
    });
    return privateJson({ sessions, nextCursor: hasMore ? String(offset + pageSize) : null }, 200, owner.setCookie);
  } catch {
    return privateJson({ error: "相談ログを読み込めませんでした。" }, 503, owner.setCookie);
  }
}

function mergeMessages(previous: unknown[], incoming: unknown[]) {
  const merged = new Map<string, unknown>();
  for (const [index, message] of [...previous, ...incoming].entries()) {
    const value = message && typeof message === "object" ? message as { id?: unknown; role?: unknown } : null;
    const key = value && (typeof value.id === "number" || typeof value.id === "string")
      ? `${String(value.role)}:${String(value.id)}`
      : `legacy:${index}:${JSON.stringify(message)}`;
    merged.set(key, message);
  }
  return [...merged.values()].sort((a, b) => {
    const left = a && typeof a === "object" ? Number((a as { id?: unknown }).id) : Number.NaN;
    const right = b && typeof b === "object" ? Number((b as { id?: unknown }).id) : Number.NaN;
    return Number.isFinite(left) && Number.isFinite(right) ? left - right : 0;
  });
}

export async function POST(request: Request) {
  const owner = await requestOwner(request);
  let body: { sessions?: unknown[] };
  try { body = await request.json(); } catch { return privateJson({ error: "保存内容を確認できません。" }, 400, owner.setCookie); }
  if (!Array.isArray(body.sessions) || body.sessions.length < 1 || body.sessions.length > 50) {
    return privateJson({ error: "保存できる相談ログは1回につき50件までです。" }, 400, owner.setCookie);
  }
  const sessions = body.sessions.map(validateSession);
  if (sessions.some((session) => !session)) {
    return privateJson({ error: "相談ログの形式を確認できません。" }, 400, owner.setCookie);
  }

  try {
    await ensureAppStorage();
    const db = await getDb();
    let saved = 0;
    for (const session of sessions as StoredSession[]) {
      const existing = await db.select({ payloadJson: chatSessions.payloadJson })
        .from(chatSessions)
        .where(and(eq(chatSessions.ownerKey, owner.key), eq(chatSessions.id, session.id)))
        .limit(1);
      let storedSession = session;
      if (existing[0]) {
        try {
          const previous = JSON.parse(existing[0].payloadJson) as StoredSession;
          storedSession = { ...previous, ...session, messages: mergeMessages(previous.messages ?? [], session.messages) };
        } catch { /* Replace unreadable legacy data with the validated current payload. */ }
      }
      const updatedAt = new Date(session.updatedAt).toISOString();
      await db.insert(chatSessions).values({
        ownerKey: owner.key,
        id: session.id,
        specialistId: session.specialistId,
        title: session.title.trim(),
        payloadJson: JSON.stringify(storedSession),
        updatedAt,
      }).onConflictDoUpdate({
        target: [chatSessions.ownerKey, chatSessions.id],
        set: {
          specialistId: session.specialistId,
          title: session.title.trim(),
          payloadJson: JSON.stringify(storedSession),
          updatedAt,
        },
      });
      saved += 1;
    }
    return privateJson({ saved }, 200, owner.setCookie);
  } catch {
    return privateJson({ error: "相談ログを保存できませんでした。" }, 503, owner.setCookie);
  }
}
