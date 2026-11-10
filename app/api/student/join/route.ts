import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser, hasRole } from "@/lib/auth";

// This function handles the POST request for a student to join a class
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    // Extracting the joinToken from the request body
    const { joinToken } = await req.json();

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    if (!hasRole(user, "STUDENT")) {
      return NextResponse.json({ message: "Only students can join a class" }, { status: 403 });
    }

    if (!joinToken) {
      // Returning an error response if the joinToken is missing
      return NextResponse.json({ message: "Missing joinToken" }, { status: 400 });
    }

    // Fetching the class with the provided joinToken from the database
    const targetClass = await prisma.class.findUnique({
      where: { joinToken },
      include: {
        enrollments: true
      }
    });

    // Validating if the class exists
    if (!targetClass) {
      // Returning an error response if the class does not exist
      return NextResponse.json({ message: "Invalid token" }, { status: 404 });
    }

    // Validating if the user has already joined the class
    if (targetClass.enrollments.some((enrollment) => enrollment.studentId === user.id)) {
      // Returning a success response if the user has already joined the class
      return NextResponse.json({ message: "You already joined this class" }, { status: 200 });
    }

    // Updating the class in the database to include the user as a student
    const updatedClass = await prisma.class.update({
      where: { joinToken },
      data: {
        enrollments: {
          create: {
            studentId: user.id
          }
        }
      },
      include: {
        enrollments: true
      }
    });

    // Returning a success response with the updated class
    return NextResponse.json({ message: "Successfully joined the class!", classId: updatedClass.id });
  } catch (error) {
    // Logging the error if something goes wrong during class joining
    console.error("[JOIN_CLASS_ERROR]", error);
    // Returning an error response if an internal server error occurs
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}