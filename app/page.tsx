import ChigiriApp from "@/components/ChigiriApp";
import { getAccountUser } from "@/server/account-auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getAccountUser();

  return (
    <ChigiriApp
      viewer={user ? { displayName: user.displayName } : null}
      signInPath="/login"
      signOutPath="/api/auth/logout"
    />
  );
}
