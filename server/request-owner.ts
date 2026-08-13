const ownerCookie = "chigiri_owner";

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

export async function requestOwner(request: Request) {
  const email = (await getAccountUserFromRequest(request))?.email;
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
import { getAccountUserFromRequest } from "@/server/account-auth";
