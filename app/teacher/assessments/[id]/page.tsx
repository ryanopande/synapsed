"use client";

import { Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/teacher/SideBar';
import TopNav from '@/components/teacher/TopNav';
import { QuizBuilder } from '@/components/teacher/assessments/QuizBuilder';

function QuizBuilderContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const quizId = params.id as string;
  const classId: string = searchParams.get('classId') || 'default';

  const handleBack = () => {
    router.push('/teacher/assessments');
  };

  return <QuizBuilder quizId={quizId} classId={classId} onBack={handleBack} />;
}

export default function QuizBuilderPage() {
  return (
    <div className="min-h-screen">
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <TopNav />
          <main className="flex-1">
            <Suspense fallback={<div className="flex items-center justify-center h-full">Loading...</div>}>
              <QuizBuilderContent />
            </Suspense>
          </main>
        </div>
      </div>
    </div>
  );
}

