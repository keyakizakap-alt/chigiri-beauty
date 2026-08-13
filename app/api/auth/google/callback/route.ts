import { createSessionToken, sessionCookie, verifyGoogleCredential } from "@/server/account-auth";

function redirectToLogin(request: Request, error: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", error);
  return Response.redirect(url, 303);
}

export async function POST(request: Request) {
  let form: FormData;
  try { form = await request.formData(); } catch { return redirectToLogin(request, "invalid_request"); }
  const csrfFromBody = form.get("g_csrf_token");
  const csrfFromCookie = (request.headers.get("cookie") ?? "").split(";").map((part) => part.trim()).find((part) => part.startsWith("g_csrf_token="))?.slice("g_csrf_token=".length);
  const credential = form.get("credential");
  if (typeof csrfFromBody !== "string" || !csrfFromCookie || csrfFromBody !== decodeURIComponent(csrfFromCookie) || typeof credential !== "string") {
    return redirectToLogin(request, "csrf");
  }
  try {
    const user = await verifyGoogleCredential(credential);
    const token = await createSessionToken(user);
    const response = Response.redirect(new URL("/", request.url), 303);
    response.headers.set("Set-Cookie", sessionCookie(token, request.url));
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    return redirectToLogin(request, "verification_failed");
  }
}
