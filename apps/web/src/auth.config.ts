import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";

const devMode = process.env.DEV_AUTH === "true";

// Edge-safe config — NO Prisma, NO adapter.
// Used by middleware for JWT validation only.
export const authConfig = {
  secret: process.env.AUTH_SECRET,
  providers: devMode
    ? [
        Credentials({
          id: "dev-admin",
          name: "Dev Admin",
          credentials: {},
          // Real authorize (with Prisma upsert) lives in auth.ts.
          // This placeholder is only needed so NextAuth registers the provider
          // for JWT signature validation in Edge middleware.
          authorize: () => null,
        }),
      ]
    : [Google, GitHub],
  pages: { signIn: "/login" },
} satisfies NextAuthConfig;
