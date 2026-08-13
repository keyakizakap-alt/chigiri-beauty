import { migrateOwnerData } from "@/db";
import { auth } from "@/auth";

const ownerCookie = "chigiri_owner";
const guestIdPattern = /^[0-9a-f-]{36}$/i;

function cookieValue(request: Request, name: string) {
  const cookies = request.headers.get("cookie") ?? "";
  for (const item of cookies.split(";")) {
    const [key, ...value] = item.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

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

export async function POST(request: Request) {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
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
