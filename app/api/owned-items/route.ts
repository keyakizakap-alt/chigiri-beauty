import { and, desc, eq } from "drizzle-orm";
import { ensureOwnedItemStorage, getDb } from "@/db";
import { ownedItems } from "@/db/schema";
import { privateJson, requestOwner } from "@/server/request-owner";

const categories = new Set(["cleanser", "lotion", "serum", "moisturizer", "sunscreen", "haircare", "bodycare", "makeup", "nailcare"]);
const idPattern = /^[a-zA-Z0-9-]{8,80}$/;

type OwnedItemInput = { id?: unknown; brand?: unknown; name?: unknown; category?: unknown; note?: unknown };

function cleanItem(input: OwnedItemInput) {
  const id = typeof input.id === "string" && idPattern.test(input.id) ? input.id : crypto.randomUUID();
  const brand = typeof input.brand === "string" ? input.brand.trim().slice(0, 60) : "";
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 120) : "";
  const category = typeof input.category === "string" ? input.category : "";
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 240) : "";
  return name && categories.has(category) ? { id, brand, name, category, note: note || null } : null;
}

export async function GET(request: Request) {
  const owner = await requestOwner(request);
  try {
    await ensureOwnedItemStorage();
    const db = await getDb();
    const items = await db.select({ id: ownedItems.id, brand: ownedItems.brand, name: ownedItems.name, category: ownedItems.category, note: ownedItems.note })
      .from(ownedItems).where(eq(ownedItems.ownerKey, owner.key)).orderBy(desc(ownedItems.updatedAt));
    return privateJson({ items }, 200, owner.setCookie);
  } catch {
    return privateJson({ error: "マイアイテムを読み込めませんでした。" }, 503, owner.setCookie);
  }
}

export async function POST(request: Request) {
  const owner = await requestOwner(request);
  let body: OwnedItemInput;
  try { body = await request.json(); } catch { return privateJson({ error: "入力内容を確認してください。" }, 400, owner.setCookie); }
  const item = cleanItem(body);
  if (!item) return privateJson({ error: "商品名とカテゴリを確認してください。" }, 400, owner.setCookie);
  try {
    await ensureOwnedItemStorage();
    const db = await getDb();
    const updatedAt = new Date().toISOString();
    await db.insert(ownedItems).values({ ownerKey: owner.key, ...item, updatedAt }).onConflictDoUpdate({
      target: [ownedItems.ownerKey, ownedItems.id],
      set: { brand: item.brand, name: item.name, category: item.category, note: item.note, updatedAt },
    });
    return privateJson({ item }, 200, owner.setCookie);
  } catch {
    return privateJson({ error: "マイアイテムを保存できませんでした。" }, 503, owner.setCookie);
  }
}

export async function DELETE(request: Request) {
  const owner = await requestOwner(request);
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !idPattern.test(id)) return privateJson({ error: "削除するアイテムを確認できません。" }, 400, owner.setCookie);
  try {
    await ensureOwnedItemStorage();
    const db = await getDb();
    await db.delete(ownedItems).where(and(eq(ownedItems.ownerKey, owner.key), eq(ownedItems.id, id)));
    return privateJson({ deleted: true }, 200, owner.setCookie);
  } catch {
    return privateJson({ error: "マイアイテムを削除できませんでした。" }, 503, owner.setCookie);
  }
}
