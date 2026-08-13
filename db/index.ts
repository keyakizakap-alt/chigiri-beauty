import { createClient } from "@libsql/client";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

function createDb() {
  const client = createClient({
    url: databaseUrl(),
    authToken: process.env.TURSO_AUTH_TOKEN?.trim() || undefined,
  });
  return drizzle(client, { schema });
}

type AppDb = ReturnType<typeof createDb>;

let database: AppDb | null = null;
let appStorageReady: Promise<void> | null = null;

function databaseUrl() {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  if (!url) throw new Error("TURSO_DATABASE_URL is not configured");
  return url;
}

export async function getDb() {
  if (!database) database = createDb();
  return database;
}

/**
 * ルートが使うテーブルを実行時に用意する。マイグレーションを適用する仕組みが
 * デプロイ経路にないため、相談ログだけでなくコンディション記録とアップロード
 * 台帳も同じ方法で揃える。`drizzle/` のマイグレーションと定義を一致させること。
 */
export async function ensureAppStorage() {
  if (!appStorageReady) {
    appStorageReady = (async () => {
      const db = await getDb();
      const statements = [
        `CREATE TABLE IF NOT EXISTS chat_sessions (
          owner_key text NOT NULL,
          id text NOT NULL,
          specialist_id text NOT NULL,
          title text NOT NULL,
          payload_json text NOT NULL,
          created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
          PRIMARY KEY(owner_key, id)
        )`,
        "CREATE INDEX IF NOT EXISTS chat_sessions_owner_specialist_updated_idx ON chat_sessions (owner_key, specialist_id, updated_at)",
        `CREATE TABLE IF NOT EXISTS beauty_check_ins (
          owner_key text NOT NULL,
          id text NOT NULL,
          specialist_id text NOT NULL,
          payload_json text NOT NULL,
          recorded_at text NOT NULL,
          created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
          PRIMARY KEY(owner_key, id)
        )`,
        "CREATE INDEX IF NOT EXISTS beauty_check_ins_owner_specialist_recorded_idx ON beauty_check_ins (owner_key, specialist_id, recorded_at)",
        `CREATE TABLE IF NOT EXISTS uploaded_assets (
          owner_key text NOT NULL,
          id text NOT NULL,
          object_key text NOT NULL,
          file_name text NOT NULL,
          content_type text NOT NULL,
          byte_size integer NOT NULL,
          created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
          PRIMARY KEY(owner_key, id)
        )`,
        "CREATE INDEX IF NOT EXISTS uploaded_assets_owner_created_idx ON uploaded_assets (owner_key, created_at)",
        `CREATE TABLE IF NOT EXISTS deleted_chat_sessions (
          owner_key text NOT NULL,
          id text NOT NULL,
          deleted_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
          PRIMARY KEY(owner_key, id)
        )`,
      ];
      for (const statement of statements) await db.run(statement);
    })().catch((error) => {
      appStorageReady = null;
      throw error;
    });
  }
  await appStorageReady;
}

export async function migrateOwnerData(guestKey: string, userKey: string) {
  await ensureAppStorage();
  const db = await getDb();
  const tables = ["chat_sessions", "deleted_chat_sessions", "beauty_check_ins", "uploaded_assets"];
  await db.transaction(async (tx) => {
    for (const table of tables) {
      const tableName = sql.raw(table);
      await tx.run(sql`UPDATE OR IGNORE ${tableName} SET owner_key = ${userKey} WHERE owner_key = ${guestKey}`);
      await tx.run(sql`DELETE FROM ${tableName} WHERE owner_key = ${guestKey}`);
    }
  });
}
