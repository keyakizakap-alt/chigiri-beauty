import {
  authCookieNames,
  callbackUrl,
  clearCookieHeader,
  cookieValue,
  createSessionCookie,
  exchangeGoogleCode,
  googleAuthConfigured,
  safeReturnPath,
  sessionCookieHeader,
} from "@/server/auth";

export const dynamic = "force-dynamic";

function failure(request: Request, returnTo: string, reason: string) {
  const destination = new URL(returnTo, "https://app.local");
  destination.searchParams.set("login", reason);
  const headers = new Headers({
    Location: `${destination.pathname}${destination.search}`,
    "Cache-Control": "private, no-store",
  });
  for (const name of [authCookieNames.state, authCookieNames.verifier, authCookieNames.returnTo]) {
    headers.append("Set-Cookie", clearCookieHeader(name, request));
  }
  return new Response(null, { status: 302, headers });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = safeReturnPath(cookieValue(request, authCookieNames.returnTo));

  if (!googleAuthConfigured()) return failure(request, returnTo, "unavailable");
  if (url.searchParams.get("error")) return failure(request, returnTo, "cancelled");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = cookieValue(request, authCookieNames.state);
  const verifier = cookieValue(request, authCookieNames.verifier);
  // stateとverifierはこのブラウザで開始した認可だけを受け付けるための対。
  // どちらかが欠けている場合は、途中で失効したCookieか別経路の呼び出し。
  if (!code || !state || !expectedState || state !== expectedState || !verifier) {
    return failure(request, returnTo, "expired");
  }

  let claims;
  try {
    claims = await exchangeGoogleCode(code, verifier, callbackUrl(request));
  } catch {
    return failure(request, returnTo, "failed");
  }
  if (!claims) return failure(request, returnTo, "failed");
  if (!claims.emailVerified) return failure(request, returnTo, "unverified");

  const session = await createSessionCookie(claims.email, claims.name);
  const headers = new Headers({ Location: returnTo, "Cache-Control": "private, no-store" });
  headers.append("Set-Cookie", sessionCookieHeader(session, request));
  for (const name of [authCookieNames.state, authCookieNames.verifier, authCookieNames.returnTo]) {
    headers.append("Set-Cookie", clearCookieHeader(name, request));
  }
  return new Response(null, { status: 302, headers });
}
