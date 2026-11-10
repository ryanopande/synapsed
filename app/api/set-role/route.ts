import { NextResponse } from "next/server"
import { Role } from "@prisma/client"
import { requireUser } from "@/lib/auth"
import { prisma } from "@/lib/db/prisma"

// Roles a user may pick for themselves on /choose-role. ADMIN is assigned
// directly in the database, never through this endpoint.
const SELF_ASSIGNABLE_ROLES: Role[] = [Role.STUDENT, Role.PROFESSOR]

// POST { role }: set the signed-in user's role after their first sign-in
export async function POST(req: Request) {
  const authResult = await requireUser()
  if (!authResult.ok) return authResult.response
  const { user } = authResult

  const { role } = await req.json()
  if (!SELF_ASSIGNABLE_ROLES.includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 })
  }

  // A role is chosen once; changing it later would bypass class ownership.
  const existing = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } })
  if (existing?.role && existing.role !== role) {
    return NextResponse.json({ error: "Role is already set" }, { status: 403 })
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { role },
  })

  return NextResponse.json({ success: true, role: updatedUser.role })
}
