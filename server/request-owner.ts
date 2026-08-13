import { authenticatedEmail, cookieValue } from "@/server/auth";

const ownerCookie = "chigiri_owner";

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * 保存データの所有者キー。Googleログイン中はアカウント、未ログイン時は
 * 端末のゲストCookieに紐づける。SIWCヘッダーがある環境でも同じ形になる。
 */
export async function requestOwner(request: Request) {
  const email = await authenticatedEmail(request);
  if (email) return { key: `user:${await sha256(email)}`, setCookie: null as string | null };

  const current = cookieValue(request, ownerCookie);
  const id = current && /^[0-9a-f-]{36}$/i.test(current) ? current : crypto.randomUUID();
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return {
    key: `guest:${id}`,
    setCookie: `${ownerCookie}=${encodeURIComponent(id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=34560000${secure}`,
  };
}

export function privateJson(data: unknown, status: number, setCookie: string | null) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  if (setCookie) headers.set("Set-Cookie", setCookie);
  return new Response(JSON.stringify(data), { status, headers });
}
