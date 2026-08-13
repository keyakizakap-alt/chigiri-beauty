import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

let appStorageReady: Promise<void> | null = null;

async function d1Binding() {
  const { env } = await import("cloudflare:workers");
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }
  return env.DB;
}

export async function getDb() {
  // Delay the Workers-only module until a request actually needs D1. This keeps
  // Node-based artifact verification from evaluating the `cloudflare:` scheme.
  return drizzle(await d1Binding(), { schema });
}

/**
 * ルートが使うテーブルを実行時に用意する。マイグレーションを適用する仕組みが
 * デプロイ経路にないため、相談ログだけでなくコンディション記録とアップロード
 * 台帳も同じ方法で揃える。`drizzle/` のマイグレーションと定義を一致させること。
 */
export async function ensureAppStorage() {
  if (!appStorageReady) {
    appStorageReady = (async () => {
      const d1 = await d1Binding();
      await d1.batch([
        d1.prepare(`CREATE TABLE IF NOT EXISTS chat_sessions (
          owner_key text NOT NULL,
          id text NOT NULL,
          specialist_id text NOT NULL,
          title text NOT NULL,
          payload_json text NOT NULL,
          created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
          PRIMARY KEY(owner_key, id)
        )`),
        d1.prepare("CREATE INDEX IF NOT EXISTS chat_sessions_owner_specialist_updated_idx ON chat_sessions (owner_key, specialist_id, updated_at)"),
        d1.prepare(`CREATE TABLE IF NOT EXISTS beauty_check_ins (
          owner_key text NOT NULL,
          id text NOT NULL,
          specialist_id text NOT NULL,
          payload_json text NOT NULL,
          recorded_at text NOT NULL,
          created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
          PRIMARY KEY(owner_key, id)
        )`),
        d1.prepare("CREATE INDEX IF NOT EXISTS beauty_check_ins_owner_specialist_recorded_idx ON beauty_check_ins (owner_key, specialist_id, recorded_at)"),
        d1.prepare(`CREATE TABLE IF NOT EXISTS uploaded_assets (
          owner_key text NOT NULL,
          id text NOT NULL,
          object_key text NOT NULL,
          file_name text NOT NULL,
          content_type text NOT NULL,
          byte_size integer NOT NULL,
          created_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
          PRIMARY KEY(owner_key, id)
        )`),
        d1.prepare("CREATE INDEX IF NOT EXISTS uploaded_assets_owner_created_idx ON uploaded_assets (owner_key, created_at)"),
        d1.prepare(`CREATE TABLE IF NOT EXISTS deleted_chat_sessions (
          owner_key text NOT NULL,
          id text NOT NULL,
          deleted_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
          PRIMARY KEY(owner_key, id)
        )`),
      ]);
    })().catch((error) => {
      appStorageReady = null;
      throw error;
    });
  }
  await appStorageReady;
}
