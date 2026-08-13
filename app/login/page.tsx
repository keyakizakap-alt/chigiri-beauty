import Link from "next/link";
import GoogleSignInButton from "./GoogleSignInButton";
import { googleAuthConfigured, googleClientId } from "@/server/account-auth";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const configured = googleAuthConfigured();
  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <Link href="/" className="login-brand">CHIGIRI</Link>
        <p className="eyebrow">あなた専用の美容相談室</p>
        <h1 id="login-title">相談の続きを、どの端末からでも。</h1>
        <p>Googleアカウントでログインすると、5人のコンシェルジュとの相談履歴やマイアイテムをメールアドレス単位で安全に引き継げます。</p>
        {configured ? <GoogleSignInButton clientId={googleClientId()} /> : <p className="login-error">Googleログインは現在準備中です。設定完了後に利用できます。</p>}
        <p className="login-privacy">GoogleのパスワードやアクセストークンはCHIGIRI Beautyに保存しません。</p>
        <Link href="/" className="login-back">ログインせずに使う</Link>
      </section>
    </main>
  );
}
