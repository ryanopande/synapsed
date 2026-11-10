import NextAuth from "next-auth"

// authOptions so we can use GetServerSession
import { authOptions } from "./lib/authOptions"


 
export const { handlers, signIn, signOut, auth } = NextAuth(authOptions)