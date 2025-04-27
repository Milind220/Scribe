import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      accessToken?: string
      id?: string
      plan?: string
    } & DefaultSession["user"]
  }

  interface User {
    plan?: string
  }
}