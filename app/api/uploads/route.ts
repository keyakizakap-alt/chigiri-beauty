import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { chatSessions, uploadedAssets } from "@/db/schema";
import { privateJson, requestOwner } from "@/server/request-owner";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxBytes = 5 * 1024 * 1024;
const idPattern = /^[0-9a-f-]{36}$/i;

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "image";
}

async function getBucket() {
  const { env } = await import("cloudflare:workers");
  if (!env.BUCKET) throw new Error("R2 binding unavailable");
  return env.BUCKET;
}

export async function POST(request: Request) {
  const owner = await requestOwner(request);
  try {
    const form = await request.formData();
    const image = form.get("image");
    if (!(image instanceof File) || !allowedTypes.has(image.type) || image.size <= 0 || image.size > maxBytes) {
      return privateJson({ error: "JPEG・PNG・WebP形式で、5MB以下の画像を選択してください。" }, 400, owner.setCookie);
    }
    const id = crypto.randomUUID();
    const fileName = safeFileName(image.name);
    const key = `chat-images/${new Date().toISOString().slice(0, 10)}/${id}-${fileName}`;
    const bucket = await getBucket();
    await bucket.put(key, await image.arrayBuffer(), {
      httpMetadata: { contentType: image.type, cacheControl: "private, no-store" },
      customMetadata: { originalName: fileName },
    });
    try {
      await (await getDb()).insert(uploadedAssets).values({
        ownerKey: owner.key,
        id,
        objectKey: key,
        fileName,
        contentType: image.type,
        byteSize: image.size,
      });
    } catch (error) {
      await bucket.delete(key);
      throw error;
    }
    return privateJson({ id, name: fileName, url: `/api/uploads?id=${encodeURIComponent(id)}` }, 200, owner.setCookie);
  } catch {
    return privateJson({ error: "画像を保存できませんでした。" }, 503, owner.setCookie);
  }
}

export async function GET(request: Request) {
  const owner = await requestOwner(request);
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const legacyKey = url.searchParams.get("key");
  if ((!id || !idPattern.test(id)) && (!legacyKey || !legacyKey.startsWith("chat-images/") || legacyKey.length > 220)) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const db = await getDb();
    let objectKey: string | null = null;
    if (id && idPattern.test(id)) {
      const rows = await db.select({ objectKey: uploadedAssets.objectKey })
        .from(uploadedAssets)
        .where(and(eq(uploadedAssets.ownerKey, owner.key), eq(uploadedAssets.id, id)))
        .limit(1);
      objectKey = rows[0]?.objectKey ?? null;
    } else if (legacyKey) {
      const sessions = await db.select({ payloadJson: chatSessions.payloadJson })
        .from(chatSessions)
        .where(eq(chatSessions.ownerKey, owner.key));
      const owned = sessions.some((session) => {
        try {
          const payload = JSON.parse(session.payloadJson) as { messages?: Array<{ images?: Array<{ url?: string }> }> };
          return (payload.messages ?? []).some((message) => (message.images ?? []).some((image) => {
            if (!image.url?.startsWith("/api/uploads?")) return false;
            return new URL(image.url, "https://app.local").searchParams.get("key") === legacyKey;
          }));
        } catch { return false; }
      });
      if (owned) objectKey = legacyKey;
    }
    if (!objectKey) return new Response("Not found", { status: 404 });
    const object = await (await getBucket()).get(objectKey);
    if (!object) return new Response("Not found", { status: 404 });
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Cache-Control", "private, no-store");
    headers.set("X-Content-Type-Options", "nosniff");
    if (owner.setCookie) headers.set("Set-Cookie", owner.setCookie);
    return new Response(object.body, { headers });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

export async function DELETE(request: Request) {
  const owner = await requestOwner(request);
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !idPattern.test(id)) return privateJson({ error: "削除する画像を確認できません。" }, 400, owner.setCookie);
  try {
    const db = await getDb();
    const rows = await db.select({ objectKey: uploadedAssets.objectKey })
      .from(uploadedAssets)
      .where(and(eq(uploadedAssets.ownerKey, owner.key), eq(uploadedAssets.id, id)))
      .limit(1);
    if (!rows[0]) return privateJson({ deleted: true }, 200, owner.setCookie);
    await (await getBucket()).delete(rows[0].objectKey);
    await db.delete(uploadedAssets).where(and(eq(uploadedAssets.ownerKey, owner.key), eq(uploadedAssets.id, id)));
    return privateJson({ deleted: true }, 200, owner.setCookie);
  } catch {
    return privateJson({ error: "画像を削除できませんでした。" }, 503, owner.setCookie);
  }
}
