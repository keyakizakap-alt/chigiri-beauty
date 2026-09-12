import { sql } from 'drizzle-orm';
import { ensureAppStorage, getDb } from '@/db';
import { chatLimits } from '@/server/care-plan.mjs';

/** DB-backed atomic counters remain effective across serverless instances. */
export async function consumeChatQuota(owner: string) {
  await ensureAppStorage();
  const db = await getDb();
  return db.transaction(async tx => {
    const limits = chatLimits(owner, Date.now());
    for (const item of limits) {
      const rows = await tx.all<{used: number}>(sql`INSERT INTO api_quotas (key, window, used) VALUES (${item.key}, ${item.window}, 1)
        ON CONFLICT(key) DO UPDATE SET window = excluded.window, used = CASE WHEN api_quotas.window = excluded.window THEN api_quotas.used + 1 ELSE 1 END
        RETURNING used`);
      if (Number(rows[0]?.used) > item.limit) return false;
    }
    return true;
  });
}
