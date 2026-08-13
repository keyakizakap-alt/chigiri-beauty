import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { signInWithGoogle } from "@/app/auth-actions";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.email) redirect("/");

  const googleReady = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET && process.env.AUTH_SECRET);

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-title">
        <Link className="auth-brand" href="/" aria-label="CHIGIRI Beautyへ戻る">
          <span className="brand-mark" aria-hidden="true" />
          <span>CHIGIRI Beauty</span>
        </Link>
        <p className="eyebrow">YOUR BEAUTY, REMEMBERED</p>
        <h1 id="login-title">相談の続きを、<br />いつでもここから。</h1>
        <p className="auth-lead">Googleアカウントでログインすると、5人の美容コンシェルジュとの相談履歴を端末をまたいで見返せます。</p>
        {googleReady ? (
          <form action={signInWithGoogle}>
            <button className="google-login" type="submit">
              <span aria-hidden="true">G</span>
              Googleで続ける
            </button>
          </form>
        ) : (
          <div className="auth-config-notice" role="status">
            Googleログインの環境変数が未設定です。Vercelに <code>AUTH_SECRET</code>、<code>AUTH_GOOGLE_ID</code>、<code>AUTH_GOOGLE_SECRET</code> を登録すると利用できます。
          </div>
        )}
        <p className="auth-note">ログインしなくても相談できます。未ログイン時の履歴はこの端末に保存されます。</p>
        <Link className="auth-skip" href="/">ログインせずに相談する</Link>
      </section>
    </main>
  );
}
