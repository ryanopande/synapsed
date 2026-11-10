"use client";

import { useEffect, useState } from "react";
import { QuizCard } from "./QuizCard";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type Quiz = {
  id: string;
  title: string;
  description?: string;
  totalQuestions: number;
  dueDate?: Date | string;
  status: "not-started" | "in-progress" | "completed";
  isOverdue?: boolean;
};

type QuizListProps = {
  classId: string;
  studentId: string;
};

export function QuizList({ classId, studentId }: QuizListProps) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadQuizzes = async () => {
      try {
        const response = await fetch(`/api/student/quizzes/${classId}?studentId=${studentId}`);
        if (!response.ok) {
          throw new Error('Failed to load quizzes');
        }
        const data = await response.json();
        setQuizzes(data.quizzes || []);
      } catch (error) {
        console.error('Error loading quizzes:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (classId && studentId) {
      loadQuizzes();
    }
  }, [classId, studentId]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (quizzes.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-slate-500">
          <p>No quizzes available for this class.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {quizzes.map((quiz) => (
        <QuizCard
          key={quiz.id}
          {...quiz}
          classId={classId}
          isOverdue={quiz.isOverdue}
        />
      ))}
    </div>
  );
}

