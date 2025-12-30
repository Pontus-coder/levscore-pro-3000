import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "./db"

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) {
        return false
      }

      const email = user.email.toLowerCase()

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true, isSuperAdmin: true, isBlocked: true },
      })

      // Allow super admin to always sign in
      if (existingUser?.isSuperAdmin) {
        return true
      }

      // Block blocked users
      if (existingUser?.isBlocked) {
        return false
      }

      // If user exists and has at least one organization membership, allow sign in
      if (existingUser) {
        const membership = await prisma.organizationMember.findFirst({
          where: { userId: existingUser.id },
        })
        if (membership) {
          return true
        }
      }

      // New users can only sign in if they have a pending invitation
      const invitation = await prisma.invitation.findFirst({
        where: {
          email: email,
          expiresAt: { gt: new Date() },
        },
      })

      return !!invitation
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
        
        // Add super admin status to session
        try {
          const user = await prisma.user.findUnique({
            where: { id: token.sub },
            select: { isSuperAdmin: true, isBlocked: true },
          })
          
          if (user) {
            (session.user as any).isSuperAdmin = user.isSuperAdmin
            (session.user as any).isBlocked = user.isBlocked
          }
        } catch (error) {
          console.error("Error fetching user in session callback:", error)
        }
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
  },
  pages: {
    signIn: "/",
  },
}

