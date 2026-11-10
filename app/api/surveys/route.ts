import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const QuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  type: z.enum(['multiple_choice', 'text', 'rating', 'ranking']),
  options: z.array(z.string()).optional(),
  required: z.boolean().default(true),
  order: z.number(),
  duplicatedFrom: z.string().optional(),
});

const CreateSurveySchema = z.object({
  classId: z.string(),
  title: z.string(),
  questions: z.array(QuestionSchema).optional().default([]),
});

const UpdateSurveySchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  questions: z.array(QuestionSchema).optional(),
});

// GET /api/surveys?classId={id} - List all surveys for a class
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const classId = searchParams.get("classId");

    if (!classId) {
      return NextResponse.json({ error: "classId is required" }, { status: 400 });
    }

    const surveys = await prisma.survey.findMany({
      where: { classId },
      include: {
        _count: {
          select: {
            responses: true,
          },
        },
      },
      orderBy: [
        { status: 'asc' }, // DRAFT, ACTIVE, ARCHIVED
        { createdAt: 'desc' },
      ],
    });

    return NextResponse.json({ surveys });
  } catch (error) {
    console.error("[GET_SURVEYS]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST /api/surveys - Create or update a survey
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Check if it's an update (has id) or create (no id)
    if (body.id) {
      const parseResult = UpdateSurveySchema.safeParse(body);
      if (!parseResult.success) {
        return NextResponse.json(
          { error: "Invalid input", details: parseResult.error },
          { status: 400 }
        );
      }

      const { id, title, questions } = parseResult.data;

      // Check if survey exists and is a draft
      const existingSurvey = await prisma.survey.findUnique({
        where: { id },
      });

      if (!existingSurvey) {
        return NextResponse.json({ error: "Survey not found" }, { status: 404 });
      }

      if (existingSurvey.status !== 'DRAFT') {
        return NextResponse.json(
          { error: "Only draft surveys can be edited" },
          { status: 400 }
        );
      }

      // Build update data dynamically
      const updatedSurvey = await prisma.survey.update({
        where: { id },
        data: {
          ...(title && { title }),
          ...(questions && { questions }),
        },
      });

      return NextResponse.json({ success: true, survey: updatedSurvey });
    } else {
      // Create new survey
      const parseResult = CreateSurveySchema.safeParse(body);
      if (!parseResult.success) {
        return NextResponse.json(
          { error: "Invalid input", details: parseResult.error },
          { status: 400 }
        );
      }

      const { classId, title, questions } = parseResult.data;

      const survey = await prisma.survey.create({
        data: {
          classId,
          title,
          questions,
          status: 'DRAFT',
        },
      });

      return NextResponse.json({ success: true, survey });
    }
  } catch (error) {
    console.error("[CREATE_UPDATE_SURVEY]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE /api/surveys?id={id} - Delete a draft survey
export async function DELETE(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const survey = await prisma.survey.findUnique({
      where: { id },
    });

    if (!survey) {
      return NextResponse.json({ error: "Survey not found" }, { status: 404 });
    }

    if (survey.status !== 'DRAFT') {
      return NextResponse.json(
        { error: "Only draft surveys can be deleted" },
        { status: 400 }
      );
    }

    await prisma.survey.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE_SURVEY]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

