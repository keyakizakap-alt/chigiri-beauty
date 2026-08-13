import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { signOutToHome } from "@/app/auth-actions";

export const dynamic = "force-dynamic";

export default async function LogoutPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  return (
    <main className="auth-page">
      <section className="auth-card compact" aria-labelledby="logout-title">
        <Link className="auth-brand" href="/">
          <span className="brand-mark" aria-hidden="true" />
          <span>CHIGIRI Beauty</span>
        </Link>
        <p className="eyebrow">ACCOUNT</p>
        <h1 id="logout-title">ログアウトしますか？</h1>
        <p className="auth-lead">{session.user.name ?? session.user.email} としてログインしています。</p>
        <form action={signOutToHome}>
          <button className="google-login" type="submit">ログアウトする</button>
        </form>
        <Link className="auth-skip" href="/">相談画面へ戻る</Link>
      </section>
    </main>
  );
}
