"use client";

import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { QuizResultsView } from "@/components/student/QuizResultsView";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { RichTextContent } from "@/lib/types/quizzes";

interface QuizResultsData {
  id: string;
  quizId: string;
  quizTitle: string;
  quizDescription: string | null;
  studentId: string;
  score: number | null;
  submittedAt: Date | string;
  answers: Array<{
    id: string;
    questionId: string;
    question: {
      id: string;
      text: string;
      richTextContent?: RichTextContent;
      type: 'multiple-choice' | 'short-answer' | 'true-false';
      imageUrl: string | null;
      order: number;
      options: Array<{
        id: string;
        text: string;
        isCorrect: boolean;
        order: number;
      }>;
    };
    answerText: string | null;
    optionId: string | null;
    isCorrect: boolean | null;
  }>;
}

export default function QuizResultsPage() {
  const params = useParams();
  const { data: session } = useSession();
  const classId = params.classId as string;
  const quizId = params.quizId as string;
  const studentId = session?.user?.id;

  const [quizResults, setQuizResults] = useState<QuizResultsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchQuizResults = async () => {
      if (!studentId || !quizId) return;

      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(`/api/student/quiz/${quizId}/results?studentId=${studentId}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            setError('Quiz results not found. Make sure you have submitted this quiz.');
          } else {
            throw new Error('Failed to fetch quiz results');
          }
          return;
        }

        const data = await response.json();
        setQuizResults(data);
      } catch (err) {
        console.error('Error fetching quiz results:', err);
        setError(err instanceof Error ? err.message : 'Failed to load quiz results');
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuizResults();
  }, [studentId, quizId]);

  if (!studentId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-xl text-center">
          <CardHeader>
            <CardTitle>Please sign in to view quiz results</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-emerald-100">
        <Card className="w-full max-w-xl text-center">
          <CardContent className="p-12">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-4" />
            <CardTitle>Loading Quiz Results...</CardTitle>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-emerald-100">
        <Card className="w-full max-w-xl text-center">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
            <p className="text-slate-600 mt-2">{error}</p>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!quizResults) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-emerald-100">
        <Card className="w-full max-w-xl text-center">
          <CardHeader>
            <CardTitle>No Results Found</CardTitle>
            <p className="text-slate-600 mt-2">Quiz results could not be loaded.</p>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return <QuizResultsView quizResults={quizResults} classId={classId} />;
}

