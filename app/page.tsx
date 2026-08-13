import ChigiriApp from "@/components/ChigiriApp";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();
  const user = session?.user?.email ? session.user : null;

  return (
    <ChigiriApp
      viewer={user ? { displayName: user.name ?? user.email ?? "ユーザー" } : null}
      signInPath="/login"
      signOutPath="/logout"
    />
  );
}
