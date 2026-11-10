// This section of the code handles the creation of a new class by a professor and retrieval of classes created by a professor.

import { NextRequest, NextResponse } from "next/server"; // Importing NextRequest and NextResponse for handling HTTP requests and responses
import { prisma } from "@/lib/prisma"; // Importing prisma for database operations
import { nanoid } from "nanoid"; // Importing nanoid for generating unique identifiers

// Function to handle POST requests for creating a new class
export async function POST(req: NextRequest) {
  try {
    // Extracting the request body
    const body = await req.json();
    // Extracting required fields from the request body
    const { title, description, professorId } = body;

    // Validating required fields
    if (!title || !professorId) {
      // Returning an error response if required fields are missing
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
    }

    // Generating a unique join token for the class
    const joinToken = nanoid(10);

    // Creating a new class in the database
    const newClass = await prisma.class.create({
      data: {
        title,
        description,
        professorId,
        joinToken,
      },
    });

    // Returning the newly created class with a success status
    return NextResponse.json(newClass, { status: 201 });
  } catch (error) {
    // Logging the error if something goes wrong during class creation
    console.error("[CLASS_CREATE_ERROR]", error);
    // Returning an error response if an internal server error occurs
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

// Function to handle GET requests for retrieving classes created by a professor
export async function GET(req: NextRequest) {
  // Extracting the professorId from the URL search parameters
  const { searchParams } = new URL(req.url);
  const professorId = searchParams.get("professorId");

  // Validating if professorId is present
  if (!professorId) {
    // Returning an error response if professorId is missing
    return NextResponse.json({ message: "Missing professorId" }, { status: 400 });
  }

  try {
    // Fetching classes created by the professor from the database
    const classes = await prisma.class.findMany({
      where: { professorId },
      include: {
        enrollments: true, // Including students in the response to show the students enrolled in each class
      },
    });

    // Returning the list of classes created by the professor
    return NextResponse.json(classes);
  } catch (error) {
    // Logging the error if something goes wrong during class retrieval
    console.error("[CLASSES_FETCH_ERROR]", error);
    // Returning an error response if an internal server error occurs
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}