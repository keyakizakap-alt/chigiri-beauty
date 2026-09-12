import { sql } from 'drizzle-orm';
import { ensureAppStorage, getDb } from '@/db';
import { requestOwner, privateJson } from '@/server/request-owner';
import { protectMutation } from '@/server/mutation-guard';
import { validPlanActions } from '@/server/care-plan.mjs';

const validDay = (day: unknown): day is string => typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0,10) === day;
export async function GET(request: Request) {
  const owner = await requestOwner(request);
  try {
    await ensureAppStorage();
    const rows = await (await getDb()).all<{day: string; payload_json: string; revision: number}>(sql`SELECT day, payload_json, revision FROM care_plans WHERE owner_key = ${owner.key} ORDER BY day DESC LIMIT 30`);
    return privateJson({plans: rows.map(row => ({day: row.day, revision: row.revision, actions: JSON.parse(row.payload_json)}))}, 200, owner.setCookie);
  } catch { return privateJson({error: 'プランを読み込めませんでした。'}, 503, owner.setCookie); }
}
export const POST = protectMutation(async request => {
  const owner = await requestOwner(request);
  const body = await request.json().catch(() => null);
  if (!body || !validDay(body.day) || !validPlanActions(body.actions)) return privateJson({error: 'プランの形式を確認してください。'}, 400, owner.setCookie);
  const actions = body.actions.map((a: {specialist: string; title: string; detail: string}) => ({specialist: a.specialist, title: a.title.trim(), detail: a.detail, done: false}));
  await ensureAppStorage();
  const rows = await (await getDb()).all(sql`INSERT INTO care_plans (owner_key, day, payload_json) VALUES (${owner.key}, ${body.day}, ${JSON.stringify(actions)}) ON CONFLICT(owner_key, day) DO NOTHING RETURNING day`);
  return privateJson(rows.length ? {saved: true} : {error: 'この日のプランは保存済みです。再読み込みしてください。'}, rows.length ? 201 : 409, owner.setCookie);
});
export const PATCH = protectMutation(async request => {
  const owner = await requestOwner(request);
  const body = await request.json().catch(() => null);
  if (!body || !validDay(body.day) || !Number.isInteger(body.index) || body.index < 0 || body.index >= 8 || typeof body.done !== 'boolean' || !Number.isInteger(body.revision)) return privateJson({error: '記録内容を確認してください。'}, 400, owner.setCookie);
  await ensureAppStorage();
  const db = await getDb();
  const rows = await db.all<{payload_json: string; revision: number}>(sql`SELECT payload_json, revision FROM care_plans WHERE owner_key = ${owner.key} AND day = ${body.day}`);
  if (!rows[0]) return privateJson({error: 'プランがありません。'}, 404, owner.setCookie);
  const actions = JSON.parse(rows[0].payload_json);
  if (!actions[body.index]) return privateJson({error: '項目がありません。'}, 400, owner.setCookie);
  actions[body.index].done = body.done;
  const updated = await db.all(sql`UPDATE care_plans SET payload_json = ${JSON.stringify(actions)}, revision = revision + 1 WHERE owner_key = ${owner.key} AND day = ${body.day} AND revision = ${body.revision} RETURNING revision`);
  return privateJson(updated.length ? {saved: true} : {error: '別の画面で更新されました。再読み込みしてください。'}, updated.length ? 200 : 409, owner.setCookie);
});
export const DELETE = protectMutation(async request => {
  const owner = await requestOwner(request);
  const day = new URL(request.url).searchParams.get('day');
  if (!validDay(day)) return privateJson({error: '日付を確認してください。'}, 400, owner.setCookie);
  await ensureAppStorage();
  await (await getDb()).run(sql`DELETE FROM care_plans WHERE owner_key = ${owner.key} AND day = ${day}`);
  return privateJson({deleted: true}, 200, owner.setCookie);
});
