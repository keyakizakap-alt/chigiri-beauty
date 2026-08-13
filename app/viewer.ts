import { cookies } from "next/headers";
import { authCookieNames, viewerFromSessionValue } from "@/server/auth";

/** サーバーコンポーネントからGoogleログインのセッションを読む。 */
export async function viewerFromCookies() {
  const store = await cookies();
  return viewerFromSessionValue(store.get(authCookieNames.session)?.value ?? null);
}
