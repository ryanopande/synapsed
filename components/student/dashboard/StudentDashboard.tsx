"use client"
import { Calendar, FileText } from "lucide-react";
import CourseCard from "./CourseCard";
import { User } from "next-auth";
import { useMemo } from "react";
import { useSession } from "@/lib/auth/client";
import useSWR from 'swr';
import { Button } from "@/components/ui/button";
import { QuizCard } from "@/components/student/quizzes";
import { StudentQuiz } from "@/lib/types/quizzes";
import type { StudentAchievements } from "@/lib/students/achievements";

/** Academic term for a date: Spring (Jan–May), Summer (Jun–Jul), Fall (Aug–Dec). */
function academicTerm(date: Date) {
  const month = date.getMonth();
  const season = month <= 4 ? "Spring" : month <= 6 ? "Summer" : "Fall";
  return `${season} ${date.getFullYear()}`;
}

// This file defines the StudentDashboard component, which is a client-side component that displays the student's dashboard.
// It fetches the student's classes and displays them in a course card format. It also displays a task list and progress section.
// The component uses the useSession hook from next-auth/react to check if the user is authenticated and fetches the classes based on the user's session.

type ClassType = {
  id: string;
  title: string;
  professor: { name: string };
  progress?: number;
  link?: string;
};

const StudentDashboard = ({ user }: { user?: User }) => {
  const { data: session } = useSession();

  // Fetcher for student classes
  const classesFetcher = async (url: string) => {
    const res = await fetch(url);
    return res.json();
  };

  // Use SWR for student classes (cached and fast)
  const classesKey = session?.user?.id 
    ? `/api/student/classes?enrollmentId=${session.user.id}`
    : null;
  
  const { data: classes = [], isLoading: loading } = useSWR<ClassType[]>(
    classesKey,
    classesFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true, // Revalidate on reconnect to get latest classes
      dedupingInterval: 5000,
    }
  );

  // Fetch quizzes for all classes
  const quizzesFetcher = async (): Promise<StudentQuiz[]> => {
    if (!session?.user?.id) return [];
    try {
      const allQuizzes: StudentQuiz[] = [];
      for (const cls of classes) {
        const res = await fetch(`/api/student/quizzes/${cls.id}?studentId=${session.user.id}`);
        if (res.ok) {
          const data = await res.json();
          const classQuizzes = (data.quizzes || []).map((q: StudentQuiz) => ({
            ...q,
            classId: cls.id,
            className: cls.title,
          }));
          allQuizzes.push(...classQuizzes);
        }
      }
      return allQuizzes.slice(0, 6); // Show up to 6 recent quizzes
    } catch {
      return [];
    }
  };

  const { data: quizzes = [] } = useSWR(
    session?.user?.id && classes.length > 0 ? 'student-quizzes' : null,
    quizzesFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );

  const currentSemester = academicTerm(new Date());
  const currentClasses = useMemo(() => classes, [classes]);

  // Course card progress = share of pathway lessons completed in that class
  const { data: achievements } = useSWR<StudentAchievements>(
    session?.user?.id ? "/api/student/achievements" : null,
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load progress");
      return res.json();
    },
    { revalidateOnFocus: true }
  );
  const progressByClass = useMemo(
    () => new Map((achievements?.perClass ?? []).map((c) => [c.classId, c.lessons.percent ?? 0])),
    [achievements]
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900">Hi {user?.name || "there"}</h1>
          <p className="text-gray-600 mt-1 flex items-center justify-center gap-2">
            <Calendar size={18} className="text-[#006494]" />
            {currentSemester}
          </p>
        </div>

        {/* Current semester courses centered */}
        <div className="glass rounded-2xl p-8 shadow-sm">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 place-items-center">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="w-full max-w-sm">
                  <div className="animate-pulse rounded-2xl overflow-hidden border-0">
                    <div className="bg-gradient-to-br from-slate-100 via-white to-slate-200">
                      <div className="px-5 pt-5">
                        <div className="h-6 w-3/4 bg-slate-200 rounded mb-2" />
                        <div className="h-4 w-1/2 bg-slate-100 rounded" />
                        <div className="mt-4 h-2 w-1/3 bg-slate-100 rounded" />
                      </div>
                      <div className="px-5 py-5">
                        <div className="h-10 w-full bg-emerald-100 rounded" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : currentClasses.length === 0 ? (
            <div className="text-gray-500 text-sm border border-dashed border-gray-300 rounded-lg p-8 flex flex-col items-center justify-center">
              <p className="mb-3">No courses this semester yet.</p>
              <Button onClick={() => (window.location.href = "/student/join")} className="bg-emerald-600 hover:bg-emerald-700 text-white" variant="default">
                Join a Class
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 place-items-center">
              {currentClasses.map((cls) => (
                <div className="w-full max-w-sm" key={cls.id}>
                  <CourseCard
                    title={cls.title}
                    professor={cls.professor?.name || "Unknown"}
                    progress={progressByClass.get(cls.id) ?? 0}
                    link={`/class/${cls.id}`}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quizzes Section */}
        {quizzes.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-emerald-600" />
              <h2 className="text-xl font-semibold text-gray-900">Recent Quizzes</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {quizzes.map((quiz) => (
                <QuizCard
                  key={quiz.id}
                  id={quiz.id}
                  title={quiz.title}
                  description={quiz.description ?? undefined}
                  totalQuestions={quiz.totalQuestions}
                  status={quiz.status}
                  classId={quiz.classId || ''}
                  dueDate={quiz.dueDate === null ? undefined : quiz.dueDate}
                  isOverdue={quiz.isOverdue}
                />
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default StudentDashboard;
