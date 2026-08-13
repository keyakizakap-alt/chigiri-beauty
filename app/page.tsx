import ChigiriApp from "@/components/ChigiriApp";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { googleAuthConfigured, signInPath, signOutPath } from "@/server/auth";
import { viewerFromCookies } from "@/app/viewer";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Googleログインのセッションを優先し、ChatGPT Sites（SIWC）で配信された場合は
  // プラットフォームが注入する識別ヘッダーへフォールバックする。
  const viewer = (await viewerFromCookies()) ?? (await getChatGPTUser());

  return (
    <ChigiriApp
      viewer={viewer ? { displayName: viewer.displayName } : null}
      signInPath={googleAuthConfigured() ? "/login" : signInPath("/")}
      signOutPath={signOutPath("/")}
      signInAvailable={googleAuthConfigured()}
    />
  );
}
