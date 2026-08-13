import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { beautyCheckIns } from "@/db/schema";
import { requestOwner } from "@/server/request-owner";

const specialists = new Set(["skin", "hair", "body", "makeup", "nail"]);
const idPattern = /^[a-zA-Z0-9-]{8,80}$/;

type CheckIn = {
  id: string;
  specialistId: string;
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

function json(data: unknown, status: number, setCookie: string | null) {
  const headers = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, no-store" });
  if (setCookie) headers.set("Set-Cookie", setCookie);
  return new Response(JSON.stringify(data), { status, headers });
}

function validOptionalNumber(value: unknown, min: number, max: number) {
  return value == null || (typeof value === "number" && Number.isFinite(value) && value >= min && value <= max);
}

function validate(value: unknown): CheckIn | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Partial<CheckIn>;
  if (
    typeof entry.id !== "string" || !idPattern.test(entry.id)
    || typeof entry.specialistId !== "string" || !specialists.has(entry.specialistId)
    || typeof entry.recordedAt !== "string" || Number.isNaN(Date.parse(entry.recordedAt))
    || (entry.weatherLabel != null && (typeof entry.weatherLabel !== "string" || entry.weatherLabel.length > 30))
    || (entry.tomorrowLabel != null && (typeof entry.tomorrowLabel !== "string" || entry.tomorrowLabel.length > 30))
    || (entry.note != null && (typeof entry.note !== "string" || entry.note.length > 160))
    || !validOptionalNumber(entry.temperature, -50, 60)
    || !validOptionalNumber(entry.humidity, 0, 100)
    || !validOptionalNumber(entry.tomorrowTempMax, -50, 60)
    || !validOptionalNumber(entry.tomorrowHumidity, 0, 100)
    || !validOptionalNumber(entry.sleepHours, 0, 24)
  ) return null;
  return entry as CheckIn;
}

export async function GET(request: Request) {
  const owner = await requestOwner(request);
  try {
    const db = await getDb();
    const rows = await db.select({ payloadJson: beautyCheckIns.payloadJson })
      .from(beautyCheckIns)
      .where(eq(beautyCheckIns.ownerKey, owner.key))
      .orderBy(desc(beautyCheckIns.recordedAt))
      .limit(200);
    const entries = rows.flatMap((row) => {
      try { return [JSON.parse(row.payloadJson)]; } catch { return []; }
    });
    return json({ entries }, 200, owner.setCookie);
  } catch {
    return json({ error: "コンディション記録を読み込めませんでした。" }, 503, owner.setCookie);
  }
}

export async function POST(request: Request) {
  const owner = await requestOwner(request);
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "記録内容を確認できません。" }, 400, owner.setCookie); }
  const entry = validate(body);
  if (!entry) return json({ error: "記録内容を確認してください。" }, 400, owner.setCookie);
  try {
    const db = await getDb();
    await db.insert(beautyCheckIns).values({
      ownerKey: owner.key,
      id: entry.id,
      specialistId: entry.specialistId,
      payloadJson: JSON.stringify(entry),
      recordedAt: new Date(entry.recordedAt).toISOString(),
    }).onConflictDoUpdate({
      target: [beautyCheckIns.ownerKey, beautyCheckIns.id],
      set: { specialistId: entry.specialistId, payloadJson: JSON.stringify(entry), recordedAt: new Date(entry.recordedAt).toISOString() },
    });
    return json({ saved: true }, 200, owner.setCookie);
  } catch {
    return json({ error: "コンディション記録を保存できませんでした。" }, 503, owner.setCookie);
  }
}

export async function DELETE(request: Request) {
  const owner = await requestOwner(request);
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !idPattern.test(id)) return json({ error: "削除する記録を確認できません。" }, 400, owner.setCookie);
  try {
    const db = await getDb();
    await db.delete(beautyCheckIns).where(and(eq(beautyCheckIns.ownerKey, owner.key), eq(beautyCheckIns.id, id)));
    return json({ deleted: true }, 200, owner.setCookie);
  } catch {
    return json({ error: "記録を削除できませんでした。" }, 503, owner.setCookie);
  }
}
