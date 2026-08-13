import {
  authCookieNames,
  callbackUrl,
  googleAuthConfigured,
  googleAuthorizeEndpoint,
  googleClientId,
  pkceChallenge,
  randomToken,
  safeReturnPath,
  temporaryCookieHeader,
} from "@/server/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const returnTo = safeReturnPath(new URL(request.url).searchParams.get("return_to"));

  if (!googleAuthConfigured()) {
    return new Response(JSON.stringify({ error: "Googleログインが設定されていません。" }), {
      status: 503,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, no-store" },
    });
  }

  const state = randomToken();
  const verifier = randomToken(48);
  const redirectUri = callbackUrl(request);
  const authorize = new URL(googleAuthorizeEndpoint);
  authorize.searchParams.set("client_id", googleClientId());
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", "openid email profile");
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("code_challenge", await pkceChallenge(verifier));
  authorize.searchParams.set("code_challenge_method", "S256");
  authorize.searchParams.set("prompt", "select_account");

  const headers = new Headers({ Location: authorize.toString(), "Cache-Control": "private, no-store" });
  headers.append("Set-Cookie", temporaryCookieHeader(authCookieNames.state, state, request));
  headers.append("Set-Cookie", temporaryCookieHeader(authCookieNames.verifier, verifier, request));
  headers.append("Set-Cookie", temporaryCookieHeader(authCookieNames.returnTo, returnTo, request));
  return new Response(null, { status: 302, headers });
}
