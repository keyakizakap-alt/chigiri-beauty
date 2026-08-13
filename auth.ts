import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const authConfigured = Boolean(
  process.env.AUTH_SECRET
  && process.env.AUTH_GOOGLE_ID
  && process.env.AUTH_GOOGLE_SECRET
);

const nextAuth = NextAuth({
  providers: [Google],
  pages: {
    signIn: "/login",
    signOut: "/logout",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 30,
  },
  trustHost: true,
});

export const { handlers, auth, signIn, signOut } = nextAuth;

export async function getAuthSession() {
  if (!authConfigured) return null;
  return auth();
}
