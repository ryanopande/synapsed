"use client";

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/teacher/SideBar';
import TopNav from '@/components/teacher/TopNav';
import { QuizDashboard } from '@/components/teacher/assessments/QuizDashboard';

function AssessmentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const classId = searchParams.get('classId') || 'default';

  const handleCreateQuiz = () => {
    const newQuizId = `quiz-${Date.now()}`;
    router.push(`/teacher/assessments/${newQuizId}`);
  };

  const handleEditQuiz = (quizId: string) => {
    router.push(`/teacher/assessments/${quizId}`);
  };

  return (
    <QuizDashboard
      classId={classId}
      onCreateQuiz={handleCreateQuiz}
      onEditQuiz={handleEditQuiz}
    />
  );
}

export default function AssessmentsPage() {
  return (
    <div className="min-h-screen">
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <TopNav />
          <main className="flex-1">
            <Suspense fallback={<div className="flex items-center justify-center h-full">Loading...</div>}>
              <AssessmentsContent />
            </Suspense>
          </main>
        </div>
      </div>
    </div>
  );
}

