import ChigiriApp from "@/components/ChigiriApp";
import { getAuthSession } from "@/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getAuthSession();
  const user = session?.user?.email ? session.user : null;

  return (
    <ChigiriApp
      viewer={user ? { displayName: user.name ?? user.email ?? "ユーザー" } : null}
      signInPath="/login"
      signOutPath="/logout"
    />
  );
}
