import { and, desc, eq, inArray, or, lt } from "drizzle-orm";
import { ensureAppStorage, getDb } from "@/db";
import { chatSessions, deletedChatSessions, uploadedAssets } from "@/db/schema";
import { deletePrivateImages } from "@/server/blob-store";
import { privateJson as json, requestOwner as ownerFor } from "@/server/request-owner";

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

/**
 * ページングは件数ではなく (updated_at, id) の位置で進める。相談中は現在の
 * セッションが数百ミリ秒ごとに更新されて並び順が変わるため、OFFSET方式だと
 * 取得済みの行が後ろへずれ、途中の相談ログが1件も返らないまま次のページへ
 * 飛んでしまう（履歴が歯抜けに見える原因）。
 */
function decodeCursor(value: string | null) {
  if (!value || value === "0") return null;
  const separator = value.indexOf("|");
  if (separator < 0) return null;
  const updatedAt = value.slice(0, separator);
  const id = value.slice(separator + 1);
  if (!updatedAt || Number.isNaN(Date.parse(updatedAt)) || !sessionIdPattern.test(id)) return null;
  return { updatedAt, id };
}

function encodeCursor(row: { updatedAt: string; id: string }) {
  return `${row.updatedAt}|${row.id}`;
}

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
  const owner = await ownerFor(request);
  const url = new URL(request.url);
  const specialist = url.searchParams.get("specialist");
  // specialist は任意。省略時は全担当の相談ログをまとめて返す。担当ごとに
  // 5本のリクエストを投げると、そのうち1本が落ちただけで画面の履歴が
  // すべて空になってしまうため、既定は1回の取得で済ませる。
  if (specialist !== null && !specialists.has(specialist)) {
    return json({ error: "担当コンシェルジュを確認できません。" }, 400, owner.setCookie);
  }
  const cursor = decodeCursor(url.searchParams.get("cursor"));

  try {
    await ensureAppStorage();
    const db = await getDb();
    const owned = specialist === null
      ? eq(chatSessions.ownerKey, owner.key)
      : and(eq(chatSessions.ownerKey, owner.key), eq(chatSessions.specialistId, specialist));
    const after = cursor
      ? or(
        lt(chatSessions.updatedAt, cursor.updatedAt),
        and(eq(chatSessions.updatedAt, cursor.updatedAt), lt(chatSessions.id, cursor.id)),
      )
      : undefined;
    const rows = await db.select({
      payloadJson: chatSessions.payloadJson,
      updatedAt: chatSessions.updatedAt,
      id: chatSessions.id,
    })
      .from(chatSessions)
      .where(after ? and(owned, after) : owned)
      .orderBy(desc(chatSessions.updatedAt), desc(chatSessions.id))
      .limit(pageSize + 1);
    const page = rows.slice(0, pageSize);
    const hasMore = rows.length > pageSize;
    const sessions = page.flatMap((row) => {
      try { return [JSON.parse(row.payloadJson)]; } catch { return []; }
    });
    const last = page[page.length - 1];
    return json({ sessions, nextCursor: hasMore && last ? encodeCursor(last) : null }, 200, owner.setCookie);
  } catch {
    return json({ error: "相談ログを読み込めませんでした。" }, 503, owner.setCookie);
  }
}

export async function POST(request: Request) {
  const owner = await ownerFor(request);
  let body: { sessions?: unknown[] };
  try { body = await request.json(); } catch { return json({ error: "保存内容を確認できません。" }, 400, owner.setCookie); }
  if (!Array.isArray(body.sessions) || body.sessions.length < 1 || body.sessions.length > 50) {
    return json({ error: "保存できる相談ログは1回につき50件までです。" }, 400, owner.setCookie);
  }
  const sessions = body.sessions.map(validateSession);
  if (sessions.some((session) => !session)) {
    return json({ error: "相談ログの形式を確認できません。" }, 400, owner.setCookie);
  }

  try {
    await ensureAppStorage();
    const db = await getDb();
    let saved = 0;
    for (const session of sessions as StoredSession[]) {
      const tombstone = await db.select({ id: deletedChatSessions.id })
        .from(deletedChatSessions)
        .where(and(eq(deletedChatSessions.ownerKey, owner.key), eq(deletedChatSessions.id, session.id)))
        .limit(1);
      if (tombstone.length) continue;
      const updatedAt = new Date(session.updatedAt).toISOString();
      await db.insert(chatSessions).values({
        ownerKey: owner.key,
        id: session.id,
        specialistId: session.specialistId,
        title: session.title.trim(),
        payloadJson: JSON.stringify(session),
        updatedAt,
      }).onConflictDoUpdate({
        target: [chatSessions.ownerKey, chatSessions.id],
        set: {
          specialistId: session.specialistId,
          title: session.title.trim(),
          payloadJson: JSON.stringify(session),
          updatedAt,
        },
      });
      saved += 1;
    }
    return json({ saved }, 200, owner.setCookie);
  } catch {
    return json({ error: "相談ログを保存できませんでした。" }, 503, owner.setCookie);
  }
}

function imageReferences(payloadJson: string) {
  try {
    const payload = JSON.parse(payloadJson) as StoredSession;
    const keys = new Set<string>();
    const ids = new Set<string>();
    for (const message of payload.messages ?? []) {
      if (!message || typeof message !== "object") continue;
      const images = (message as { images?: Array<{ url?: string }> }).images;
      for (const image of images ?? []) {
        if (!image.url?.startsWith("/api/uploads?")) continue;
        const url = new URL(image.url, "https://app.local");
        const key = url.searchParams.get("key");
        const id = url.searchParams.get("id");
        if (key?.startsWith("chat-images/")) keys.add(key);
        if (id && /^[0-9a-f-]{36}$/i.test(id)) ids.add(id);
      }
    }
    return { keys: [...keys], ids: [...ids] };
  } catch { return { keys: [], ids: [] }; }
}

export async function DELETE(request: Request) {
  const owner = await ownerFor(request);
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !sessionIdPattern.test(id)) return json({ error: "削除する相談ログを確認できません。" }, 400, owner.setCookie);

  try {
    await ensureAppStorage();
    const db = await getDb();
    const existing = await db.select({ payloadJson: chatSessions.payloadJson })
      .from(chatSessions)
      .where(and(eq(chatSessions.ownerKey, owner.key), eq(chatSessions.id, id)))
      .limit(1);
    await db.insert(deletedChatSessions).values({ ownerKey: owner.key, id }).onConflictDoNothing();
    await db.delete(chatSessions).where(and(eq(chatSessions.ownerKey, owner.key), eq(chatSessions.id, id)));

    const references = existing[0] ? imageReferences(existing[0].payloadJson) : { keys: [], ids: [] };
    if (references.ids.length) {
      const assets = await db.select({ objectKey: uploadedAssets.objectKey })
        .from(uploadedAssets)
        .where(and(eq(uploadedAssets.ownerKey, owner.key), inArray(uploadedAssets.id, references.ids)));
      references.keys.push(...assets.map((asset) => asset.objectKey));
      await db.delete(uploadedAssets).where(and(eq(uploadedAssets.ownerKey, owner.key), inArray(uploadedAssets.id, references.ids)));
    }
    if (references.keys.length) {
      try { await deletePrivateImages([...new Set(references.keys)]); }
      catch { /* The conversation is deleted even if an orphaned image needs later cleanup. */ }
    }
    return json({ deleted: true }, 200, owner.setCookie);
  } catch {
    return json({ error: "相談ログを削除できませんでした。" }, 503, owner.setCookie);
  }
}
