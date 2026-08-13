"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(options: { client_id: string; login_uri: string; ux_mode: "redirect"; context: "signin" }): void;
          renderButton(element: HTMLElement, options: Record<string, string | number>): void;
        };
      };
    };
  }
}

export default function GoogleSignInButton({ clientId }: { clientId: string }) {
  const target = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (!window.google || !target.current) return setFailed(true);
      window.google.accounts.id.initialize({
        client_id: clientId,
        login_uri: `${window.location.origin}/api/auth/google/callback`,
        ux_mode: "redirect",
        context: "signin",
      });
      window.google.accounts.id.renderButton(target.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "pill",
        logo_alignment: "left",
        width: 300,
      });
    };
    script.onerror = () => setFailed(true);
    document.head.appendChild(script);
    return () => script.remove();
  }, [clientId]);

  return failed ? <p className="login-error">Googleログインを読み込めませんでした。通信環境を確認して再読み込みしてください。</p> : <div ref={target} className="google-signin" />;
}
