import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const component = await readFile(new URL("../components/ChigiriApp.tsx", import.meta.url), "utf8");
const migration = await readFile(new URL("../app/api/account/migrate/route.ts", import.meta.url), "utf8");
const db = await readFile(new URL("../db/index.ts", import.meta.url), "utf8");

test("adds optional ChatGPT sign-in without replacing the existing app route", () => {
  assert.match(page, /getChatGPTUser/);
  assert.match(page, /<ChigiriApp/);
  assert.match(page, /dynamic = "force-dynamic"/);
  assert.match(component, /ログインして端末をまたいで履歴を残す/);
  assert.match(component, /viewer \? signOutPath : signInPath/);
});

test("migrates the current anonymous owner's records only after trusted authentication", () => {
  assert.match(migration, /oai-authenticated-user-email/);
  assert.match(migration, /migrateOwnerData\(guestKey, userKey\)/);
  assert.match(db, /UPDATE OR IGNORE/);
  for (const table of ["chat_sessions", "deleted_chat_sessions", "beauty_check_ins", "uploaded_assets"]) {
    assert.match(db, new RegExp(table));
  }
  assert.match(migration, /HttpOnly; SameSite=Lax; Max-Age=0/);
});
