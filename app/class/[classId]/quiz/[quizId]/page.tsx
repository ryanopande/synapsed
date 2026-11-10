"use client";

import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { QuizView } from "@/components/assessments/QuizView";
import { useRouter } from "next/navigation";

export default function StudentQuizPage() {
  const params = useParams();
  const { data: session } = useSession();
  const router = useRouter();
  const classId = params.classId as string;
  const quizId = params.quizId as string;
  const studentId = session?.user?.id;

  if (!studentId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Please sign in to take the quiz</p>
      </div>
    );
  }

  return (
    <QuizView
      quizId={quizId}
      classId={classId}
      studentId={studentId}
      redirectToResults={true}
      onComplete={() => {
        router.push(`/class/${classId}/quizzes`);
      }}
    />
  );
}

