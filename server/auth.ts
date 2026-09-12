/**
 * Googleアカウントでのログインと、署名付きセッションCookieの発行・検証。
 *
 * ChatGPT Sites（SIWC）で配信する場合はプラットフォームが `oai-authenticated-user-email`
 * を注入するが、Vercelへデプロイした場合はそのヘッダーが存在せず、
 * `/signin-with-chatgpt` も解決されないためログインできない。この経路を
 * アプリ側で完結させるために、OpenID Connect（Google）の認可コードフローを実装する。
 */

const SESSION_COOKIE = "chigiri_session";
const STATE_COOKIE = "chigiri_oauth_state";
const VERIFIER_COOKIE = "chigiri_oauth_verifier";
const RETURN_COOKIE = "chigiri_oauth_return";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export const authCookieNames = {
  session: SESSION_COOKIE,
  state: STATE_COOKIE,
  verifier: VERIFIER_COOKIE,
  returnTo: RETURN_COOKIE,
};

export const googleAuthorizeEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";
export const googleTokenEndpoint = "https://oauth2.googleapis.com/token";
export const googleIssuers = new Set(["https://accounts.google.com", "accounts.google.com"]);

export type Viewer = {
  email: string;
  displayName: string;
  provider: "google" | "chatgpt";
};

type SessionPayload = {
  email: string;
  name?: string;
  exp: number;
};

export function googleClientId() {
  return process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
}

function googleClientSecret() {
  return process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
}

function sessionSecret() {
  // 署名鍵が無いままセッションを発行すると、Cookieを書き換えるだけで
  // 他人の相談ログを開ける状態になる。鍵が無い場合はログイン機能ごと無効にする。
  const secret = process.env.AUTH_SECRET?.trim() ?? "";
  return secret.length >= 32 ? secret : "";
}

/** ログイン導線を出してよいか。設定不足のまま導線だけ見せると、押しても失敗する。 */
export function googleAuthConfigured() {
  return Boolean(googleClientId() && googleClientSecret() && sessionSecret());
}

export function cookieValue(request: Request, name: string) {
  const cookies = request.headers.get("cookie") ?? "";
  for (const item of cookies.split(";")) {
    const [key, ...value] = item.trim().split("=");
    if (key === name) return safeDecode(value.join("="));
  }
  return null;
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodeText(value: string) {
  return base64UrlEncode(new TextEncoder().encode(value));
}

function decodeText(value: string) {
  return new TextDecoder().decode(base64UrlDecode(value));
}

async function signingKey() {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export async function pkceChallenge(verifier: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}

export async function createSessionCookie(email: string, name: string | null) {
  const payload: SessionPayload = {
    email,
    name: name ?? undefined,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  };
  const body = encodeText(JSON.stringify(payload));
  const signature = await crypto.subtle.sign("HMAC", await signingKey(), new TextEncoder().encode(body));
  return `${body}.${base64UrlEncode(new Uint8Array(signature))}`;
}

async function readSession(value: string | null): Promise<SessionPayload | null> {
  if (!value || !sessionSecret()) return null;
  if (value.split(".").length !== 2) return null;
  const [body, signature] = value.split(".");
  if (!body || !signature) return null;
  try {
    const expected = await crypto.subtle.sign("HMAC", await signingKey(), new TextEncoder().encode(body));
    if (!timingSafeEqual(base64UrlEncode(new Uint8Array(expected)), signature)) return null;
    const payload = JSON.parse(decodeText(body)) as SessionPayload;
    if (typeof payload.email !== "string" || !payload.email.includes("@")) return null;
    if (typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** 署名付きセッションCookieの値から利用者を復元する。改ざん・期限切れはnull。 */
export async function viewerFromSessionValue(value: string | null): Promise<Viewer | null> {
  const session = await readSession(value);
  if (!session) return null;
  return {
    email: session.email,
    displayName: session.name?.trim() || session.email,
    provider: "google",
  };
}

/** リクエストからログイン中の利用者を返す。Googleセッションが無ければSIWCヘッダーを見る。 */
export async function viewerFromRequest(request: Request): Promise<Viewer | null> {
  return (await viewerFromSessionValue(cookieValue(request, SESSION_COOKIE)))
    ?? viewerFromHeaders(request.headers);
}

/** SIWC（ChatGPT Sites）が注入する識別ヘッダーからの利用者。Vercelでは通常存在しない。 */
export function viewerFromHeaders(requestHeaders: Headers): Viewer | null {
  if (!trustedPlatformAuthEnabled()) return null;
  const email = requestHeaders.get("oai-authenticated-user-email")?.trim();
  if (!email) return null;
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName = encodedFullName
    && requestHeaders.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8"
    ? safeDecode(encodedFullName)
    : null;
  return { email, displayName: fullName ?? email, provider: "chatgpt" };
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/** ログイン中の利用者のメールアドレス。所有者キーの生成にだけ使う。 */
export async function authenticatedEmail(request: Request) {
  const viewer = await viewerFromRequest(request);
  return viewer?.email.toLowerCase() ?? null;
}

export function isSecureRequest(request: Request) {
  const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (forwarded) return forwarded === "https";
  return new URL(request.url).protocol === "https:";
}

export function sessionCookieHeader(value: string, request: Request, maxAge = SESSION_MAX_AGE) {
  const secure = isSecureRequest(request) ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearCookieHeader(name: string, request: Request) {
  const secure = isSecureRequest(request) ? "; Secure" : "";
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export function temporaryCookieHeader(name: string, value: string, request: Request) {
  const secure = isSecureRequest(request) ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${secure}`;
}

/**
 * 認可後の戻り先。オープンリダイレクトにならないよう、同一オリジンの
 * 相対パスだけを許可する。
 */
export function safeReturnPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const url = new URL(value, "https://app.local");
    if (url.origin !== "https://app.local") return "/";
    return `${url.pathname}${url.search}`;
  } catch {
    return "/";
  }
}

/**
 * Googleコンソールへ登録するリダイレクトURI。プロキシ配下では `request.url` の
 * ホストが内部名になることがあるため、転送ヘッダーを優先する。
 */
export function callbackUrl(request: Request) {
  const configured = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (configured) return configured;
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  const protocol = isSecureRequest(request) ? "https" : url.protocol.replace(":", "");
  return `${protocol}://${host}/api/auth/google/callback`;
}

export function signInPath(returnTo = "/") {
  return `/api/auth/google/start?return_to=${encodeURIComponent(safeReturnPath(returnTo))}`;
}

export function signOutPath(returnTo = "/") {
  return `/api/auth/signout?return_to=${encodeURIComponent(safeReturnPath(returnTo))}`;
}

export type GoogleTokenClaims = {
  email: string;
  emailVerified: boolean;
  name: string | null;
};

/**
 * 認可コードをトークンへ交換し、IDトークンのクレームを取り出す。
 * IDトークンはTLS上でGoogleのトークンエンドポイントから直接受け取るため、
 * OpenID Connect Core 3.1.3.7 に従い署名検証を省略できる。発行者・宛先・
 * 有効期限は明示的に確認する。
 */
export async function exchangeGoogleCode(code: string, verifier: string, redirectUri: string): Promise<GoogleTokenClaims | null> {
  const response = await fetch(googleTokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: googleClientId(),
      client_secret: googleClientSecret(),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { id_token?: string };
  if (!payload.id_token) return null;
  return readIdTokenClaims(payload.id_token, googleClientId());
}

export function readIdTokenClaims(idToken: string, expectedAudience: string): GoogleTokenClaims | null {
  const segments = idToken.split(".");
  if (segments.length !== 3) return null;
  try {
    const claims = JSON.parse(decodeText(segments[1])) as {
      iss?: string;
      aud?: string;
      exp?: number;
      email?: string;
      email_verified?: boolean | string;
      name?: string;
    };
    if (!claims.iss || !googleIssuers.has(claims.iss)) return null;
    if (claims.aud !== expectedAudience) return null;
    if (typeof claims.exp !== "number" || claims.exp * 1000 <= Date.now()) return null;
    if (typeof claims.email !== "string" || !claims.email.includes("@")) return null;
    return {
      email: claims.email.toLowerCase(),
      emailVerified: claims.email_verified === true || claims.email_verified === "true",
      name: typeof claims.name === "string" && claims.name.trim() ? claims.name.trim() : null,
    };
  } catch {
    return null;
  }
}

/** Only enable behind a gateway that strips client-supplied identity headers. */
export function trustedPlatformAuthEnabled() {
  return process.env.TRUST_PLATFORM_AUTH_HEADERS === "true" && process.env.VERCEL !== "1";
}
