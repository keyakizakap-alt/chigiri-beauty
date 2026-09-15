import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const component = await readFile(new URL("../components/ChigiriApp.tsx", import.meta.url), "utf8");
const migration = await readFile(new URL("../app/api/account/migrate/route.ts", import.meta.url), "utf8");
const db = await readFile(new URL("../db/index.ts", import.meta.url), "utf8");
const auth = await readFile(new URL("../server/auth.ts", import.meta.url), "utf8");
const start = await readFile(new URL("../app/api/auth/google/start/route.ts", import.meta.url), "utf8");
const callback = await readFile(new URL("../app/api/auth/google/callback/route.ts", import.meta.url), "utf8");
const signOut = await readFile(new URL("../app/api/auth/signout/route.ts", import.meta.url), "utf8");
const loginPage = await readFile(new URL("../app/login/page.tsx", import.meta.url), "utf8");
const owner = await readFile(new URL("../server/request-owner.ts", import.meta.url), "utf8");

test("signs in with Google through the app's own OpenID Connect routes", () => {
  // Vercelには /signin-with-chatgpt が存在しないため、ログイン経路をアプリ側に持つ。
  assert.match(start, /accounts\.google\.com|googleAuthorizeEndpoint/);
  assert.match(start, /code_challenge_method", "S256/);
  assert.match(start, /scope", "openid email profile/);
  assert.match(callback, /state !== expectedState/);
  assert.match(callback, /exchangeGoogleCode/);
  assert.match(callback, /claims\.emailVerified/);
  assert.match(signOut, /clearCookieHeader\(authCookieNames\.session/);
  assert.match(page, /signInPath\("\/"\)/);
  assert.match(page, /signOutPath\("\/"\)/);
  assert.match(page, /"\/login"/);
  assert.match(loginPage, /Googleで続ける/);
  assert.match(loginPage, /signInPath\("\/"\)/);
  assert.match(component, /viewer \? signOutPath : signInPath/);
  assert.match(component, /Googleでログイン/);
  assert.match(component, /ログインして端末をまたいで履歴を残す/);
});

test("keeps sessions tamper-proof and scoped to the signed-in account", () => {
  assert.match(auth, /HMAC/);
  assert.match(auth, /AUTH_SECRET/);
  assert.match(auth, /googleAuthConfigured/);
  // 署名鍵・クライアント設定が欠けている環境では、押しても失敗する導線を出さない。
  assert.match(page, /signInAvailable=\{googleAuthConfigured\(\)\}/);
  assert.match(auth, /HttpOnly; SameSite=Lax/);
  assert.match(owner, /authenticatedEmail/);
  assert.match(owner, /user:\$\{await sha256\(email\)\}/);
});

test("keeps the optional ChatGPT sign-in path without replacing the existing app route", () => {
  assert.match(page, /getChatGPTUser/);
  assert.match(page, /<ChigiriApp/);
  assert.match(page, /dynamic = "force-dynamic"/);
  assert.match(auth, /oai-authenticated-user-email/);
});

test("migrates the current anonymous owner's records only after trusted authentication", () => {
  assert.match(migration, /authenticatedEmail\(request\)/);
  assert.match(migration, /migrateOwnerData\(guestKey, userKey\)/);
  assert.match(db, /UPDATE OR IGNORE/);
  for (const table of ["chat_sessions", "deleted_chat_sessions", "beauty_check_ins", "uploaded_assets"]) {
    assert.match(db, new RegExp(table));
  }
  assert.match(migration, /HttpOnly; SameSite=Lax; Max-Age=0/);
});
