import { clearSessionCookie } from "@/server/account-auth";

export async function GET(request: Request) {
  const response = Response.redirect(new URL("/", request.url), 303);
  response.headers.set("Set-Cookie", clearSessionCookie(request.url));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
