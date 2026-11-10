import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

function generateJoinToken() {
  const segment = (len: number) => Array.from({ length: len }, () => Math.floor(Math.random() * 36).toString(36)).join("").toUpperCase();
  return `${segment(6)}-${segment(6)}-${segment(4)}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const cls = await prisma.class.findUnique({
      where: { id },
      select: { id: true, title: true, description: true, joinToken: true, professorId: true }
    });

    if (!cls) return NextResponse.json({ message: "Class not found" }, { status: 404 });

    // Optional: ensure professor owns class
    // if (cls.professorId !== session.user.id) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    return NextResponse.json(cls);
  } catch (err) {
    console.error("[GET_CLASS_DETAILS]", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { title, description, regenerateJoinToken } = body as {
      title?: string;
      description?: string | null;
      regenerateJoinToken?: boolean;
    };

    const data: { title?: string; description?: string | null; joinToken?: string } = {};
    if (typeof title === "string") data.title = title;
    if (typeof description !== "undefined") data.description = description;
    if (regenerateJoinToken) data.joinToken = generateJoinToken();

    const updated = await prisma.class.update({ where: { id }, data, select: { id: true, title: true, description: true, joinToken: true } });
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH_CLASS_DETAILS]", err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

