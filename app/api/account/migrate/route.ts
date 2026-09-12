import { protectMutation } from "@/server/mutation-guard";
import { migrateOwnerData } from "@/db";
import { authenticatedEmail, cookieValue } from "@/server/auth";

const ownerCookie = "chigiri_owner";
const guestIdPattern = /^[0-9a-f-]{36}$/i;

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function response(data: unknown, status = 200, clearGuest = false) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  if (clearGuest) headers.set("Set-Cookie", `${ownerCookie}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return new Response(JSON.stringify(data), { status, headers });
}

async function handlePOST(request: Request) {
  // 署名済みセッション（Googleログイン）か、SIWCの `oai-authenticated-user-email`
  // ヘッダーで本人確認できた場合だけ、端末のゲストデータをアカウントへ移す。
  const email = await authenticatedEmail(request);
  if (!email) return response({ error: "ログイン状態を確認できません。" }, 401);

  const guestId = cookieValue(request, ownerCookie);
  if (!guestId || !guestIdPattern.test(guestId)) return response({ migrated: false });

  const guestKey = `guest:${guestId}`;
  const userKey = `user:${await sha256(email)}`;

  try {
    await migrateOwnerData(guestKey, userKey);
    return response({ migrated: true }, 200, true);
  } catch {
    return response({ error: "端末内の相談データをアカウントへ移行できませんでした。" }, 503);
  }
}

export const POST = protectMutation(handlePOST, 131072);
