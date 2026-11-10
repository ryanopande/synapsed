import { auth } from "@/auth" // Importing the auth function for session management
import { prisma } from "@/lib/prisma" // Importing prisma for database operations
import { NextResponse } from "next/server" // Importing NextResponse for handling HTTP responses
import { Role } from "@prisma/client" // Importing Role from Prisma client for role validation

// Function to handle POST requests for setting a user's role
export async function POST(req: Request) {
  // Attempting to authenticate the user session
  const session = await auth()
  // Extracting the role from the request body
  const { role } = await req.json()
  
  // Logging the received role for debugging purposes
  //console.log("Body receive in set-role:",role)

  // Validating if the user is authenticated and the role is valid
  if (!session?.user?.email || !Object.values(Role).includes(role)) {
    // Returning an error response if the user is not authenticated or the role is invalid
    return NextResponse.json({ error: "Unauthorized or invalid role" }, { status: 401 })
  }

  // Updating the user's role in the database
  const updatedUser = await prisma.user.update({
    where: { email: session.user.email },
    data: { role },
  })
 
  // Returning a success response with the updated role
  return NextResponse.json({ success: true, role:updatedUser.role })
}