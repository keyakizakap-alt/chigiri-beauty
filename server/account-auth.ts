import { headers } from "next/headers";

export type AccountUser = {
  displayName: string;
  email: string;
  subject: string;
};

type SessionPayload = AccountUser & { exp: number };
type GoogleClaims = {
  iss?: string;
  aud?: string | string[];
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  exp?: number;
  iat?: number;
};

export const sessionCookieName = "chigiri_session";
const sessionMaxAge = 60 * 60 * 24 * 30;
const googleIssuers = new Set(["accounts.google.com", "https://accounts.google.com"]);
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function cookieValue(cookieHeader: string, name: string) {
  for (const item of cookieHeader.split(";")) {
    const [key, ...value] = item.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function authSecret() {
  const secret = process.env.AUTH_SECRET?.trim();
  return secret && secret.length >= 32 ? secret : null;
}

export function googleAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && authSecret());
}

export function googleClientId() {
  return process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
}

export async function createSessionToken(user: AccountUser) {
  const secret = authSecret();
  if (!secret) throw new Error("Authentication is not configured");
  const payload = base64Url(encoder.encode(JSON.stringify({ ...user, exp: Math.floor(Date.now() / 1000) + sessionMaxAge })));
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(payload)));
  return `${payload}.${base64Url(signature)}`;
}

async function parseSessionToken(token: string | null): Promise<AccountUser | null> {
  const secret = authSecret();
  if (!secret || !token) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  try {
    const valid = await crypto.subtle.verify("HMAC", await hmacKey(secret), decodeBase64Url(signature), encoder.encode(payload));
    if (!valid) return null;
    const parsed = JSON.parse(decoder.decode(decodeBase64Url(payload))) as SessionPayload;
    if (!parsed.email || !parsed.subject || !parsed.displayName || !parsed.exp || parsed.exp <= Date.now() / 1000) return null;
    return { email: parsed.email, subject: parsed.subject, displayName: parsed.displayName };
  } catch {
    return null;
  }
}

export async function getAccountUser() {
  const requestHeaders = await headers();
  return parseSessionToken(cookieValue(requestHeaders.get("cookie") ?? "", sessionCookieName));
}

export function getAccountUserFromRequest(request: Request) {
  return parseSessionToken(cookieValue(request.headers.get("cookie") ?? "", sessionCookieName));
}

export function sessionCookie(token: string, requestUrl: string) {
  const secure = new URL(requestUrl).protocol === "https:" ? "; Secure" : "";
  return `${sessionCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionMaxAge}${secure}`;
}

export function clearSessionCookie(requestUrl: string) {
  const secure = new URL(requestUrl).protocol === "https:" ? "; Secure" : "";
  return `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export async function verifyGoogleCredential(credential: string): Promise<AccountUser> {
  const clientId = googleClientId();
  if (!clientId || !authSecret()) throw new Error("Authentication is not configured");
  const [encodedHeader, encodedClaims, encodedSignature, extra] = credential.split(".");
  if (!encodedHeader || !encodedClaims || !encodedSignature || extra) throw new Error("Invalid credential");
  const header = JSON.parse(decoder.decode(decodeBase64Url(encodedHeader))) as { alg?: string; kid?: string };
  if (header.alg !== "RS256" || !header.kid) throw new Error("Unsupported credential");

  const response = await fetch("https://www.googleapis.com/oauth2/v3/certs", { cf: { cacheTtl: 3600 } } as RequestInit);
  if (!response.ok) throw new Error("Google keys unavailable");
  const keys = (await response.json()) as { keys?: Array<JsonWebKey & { kid?: string }> };
  const jwk = keys.keys?.find((key) => key.kid === header.kid);
  if (!jwk) throw new Error("Signing key not found");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    decodeBase64Url(encodedSignature),
    encoder.encode(`${encodedHeader}.${encodedClaims}`),
  );
  if (!valid) throw new Error("Invalid signature");

  const claims = JSON.parse(decoder.decode(decodeBase64Url(encodedClaims))) as GoogleClaims;
  const now = Math.floor(Date.now() / 1000);
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!claims.iss || !googleIssuers.has(claims.iss) || !audience.includes(clientId)) throw new Error("Invalid audience");
  if (!claims.exp || claims.exp <= now || !claims.iat || claims.iat > now + 120) throw new Error("Expired credential");
  if (!claims.sub || !claims.email || claims.email_verified !== true) throw new Error("Verified email required");
  const email = claims.email.trim().toLowerCase();
  return { subject: claims.sub, email, displayName: claims.name?.trim() || email };
}
