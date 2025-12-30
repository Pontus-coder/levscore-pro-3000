import "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      isSuperAdmin?: boolean
      isBlocked?: boolean
    }
  }

  interface User {
    id: string
    isSuperAdmin?: boolean
    isBlocked?: boolean
  }
}
