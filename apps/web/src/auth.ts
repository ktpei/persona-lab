import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

const devMode = process.env.DEV_AUTH === "true";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: devMode
    ? [
        Credentials({
          id: "dev-admin",
          name: "Dev Admin",
          credentials: {},
          async authorize() {
            const email = process.env.DEV_ADMIN_EMAIL ?? "admin@dev.local";
            const name = process.env.DEV_ADMIN_NAME ?? "Dev Admin";
            const user = await prisma.user.upsert({
              where: { email },
              update: {},
              create: { email, name },
            });
            return user;
          },
        }),
      ]
    : [Google, GitHub],
  session: { strategy: devMode ? "jwt" : "database" },
  pages: { signIn: "/login" },
  callbacks: {
    session({ session, user, token }) {
      // database sessions provide `user`, JWT sessions provide `token`
      if (user?.id) session.user.id = user.id;
      if (token?.sub) session.user.id = token.sub;
      return session;
    },
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
  },
});
