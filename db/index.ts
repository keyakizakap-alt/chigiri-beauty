import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

let chatStorageReady: Promise<void> | null = null;

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

export async function ensureChatSessionStorage() {
  if (!chatStorageReady) {
    chatStorageReady = (async () => {
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
        d1.prepare(`CREATE TABLE IF NOT EXISTS deleted_chat_sessions (
          owner_key text NOT NULL,
          id text NOT NULL,
          deleted_at text DEFAULT CURRENT_TIMESTAMP NOT NULL,
          PRIMARY KEY(owner_key, id)
        )`),
      ]);
    })().catch((error) => {
      chatStorageReady = null;
      throw error;
    });
  }
  await chatStorageReady;
}
