import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { uploadedAssets } from "@/db/schema";
import { requestOwner } from "@/server/request-owner";

const idPattern = /^[0-9a-f-]{36}$/i;

function bytesToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 32_768) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 32_768));
  }
  return btoa(binary);
}

export async function ownedUploadDataUrl(request: Request, id: string) {
  if (!idPattern.test(id)) return null;
  const owner = await requestOwner(request);
  const rows = await (await getDb()).select({
    objectKey: uploadedAssets.objectKey,
    contentType: uploadedAssets.contentType,
  }).from(uploadedAssets)
    .where(and(eq(uploadedAssets.ownerKey, owner.key), eq(uploadedAssets.id, id)))
    .limit(1);
  if (!rows[0]) return null;
  const { env } = await import("cloudflare:workers");
  const object = await env.BUCKET?.get(rows[0].objectKey);
  if (!object) return null;
  return `data:${rows[0].contentType};base64,${bytesToBase64(await object.arrayBuffer())}`;
}
