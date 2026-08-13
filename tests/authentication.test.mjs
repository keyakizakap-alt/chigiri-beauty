import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const component = await readFile(new URL("../components/ChigiriApp.tsx", import.meta.url), "utf8");
const migration = await readFile(new URL("../app/api/account/migrate/route.ts", import.meta.url), "utf8");
const auth = await readFile(new URL("../server/account-auth.ts", import.meta.url), "utf8");
const callback = await readFile(new URL("../app/api/auth/google/callback/route.ts", import.meta.url), "utf8");

test("adds optional Google sign-in without replacing the existing app route", () => {
  assert.match(page, /getAccountUser/);
  assert.match(page, /<ChigiriApp/);
  assert.match(page, /dynamic = "force-dynamic"/);
  assert.match(component, /Googleでログインして端末をまたいで履歴を残す/);
  assert.match(component, /viewer \? signOutPath : signInPath/);
  assert.match(auth, /email_verified !== true/);
  assert.match(auth, /RSASSA-PKCS1-v1_5/);
  assert.match(auth, /HttpOnly; SameSite=Lax/);
  assert.match(callback, /g_csrf_token/);
});

test("migrates the current anonymous owner's records only after trusted authentication", () => {
  assert.match(migration, /getAccountUserFromRequest/);
  assert.match(migration, /UPDATE OR IGNORE/);
  for (const table of ["chat_sessions", "deleted_chat_sessions", "beauty_check_ins", "uploaded_assets"]) {
    assert.match(migration, new RegExp(table));
  }
  assert.match(migration, /HttpOnly; SameSite=Lax; Max-Age=0/);
});
