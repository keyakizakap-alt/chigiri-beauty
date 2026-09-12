import { protectMutation } from "@/server/mutation-guard";
import { authCookieNames, clearCookieHeader, safeReturnPath } from "@/server/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const returnTo = safeReturnPath(new URL(request.url).searchParams.get("return_to"));
  const headers = new Headers({ Location: returnTo, "Cache-Control": "private, no-store" });
  headers.append("Set-Cookie", clearCookieHeader(authCookieNames.session, request));
  return new Response(null, { status: 302, headers });
}

async function handlePOST(request: Request) {
  return GET(request);
}

export const POST = protectMutation(handlePOST, 131072);
