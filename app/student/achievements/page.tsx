"use client";

import Link from "next/link";
import useSWR from "swr";
import { useSession } from "@/lib/auth/client";
import { BookOpen, ClipboardCheck, GraduationCap, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Sidebar from "@/components/student/StudentSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import type { ProgressCount, StudentAchievements } from "@/lib/students/achievements";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load achievements");
  return res.json();
};

/** Encouraging message for a completion percentage. */
function getEncouragement(percent: number | null): string {
  if (percent === null) return "Nothing here yet. Check back soon!";
  if (percent === 0) return "Every expert started at zero. Let's go!";
  if (percent < 25) return "Nice start! Keep it going.";
  if (percent < 50) return "Great work! You're building momentum.";
  if (percent < 75) return "Amazing! You're past the halfway mark.";
  if (percent < 100) return "So close! Finish strong.";
  return "You have cooked! 🔥";
}

function ProgressBar({ percent }: { percent: number | null }) {
  return (
    <Progress
      value={percent ?? 0}
      className="h-2.5 bg-emerald-100 [&>div]:bg-emerald-600"
    />
  );
}

function StatCard({
  title,
  icon: Icon,
  progress,
  unit,
  emptyText,
}: {
  title: string;
  icon: LucideIcon;
  progress: ProgressCount;
  unit: string;
  emptyText: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-gray-700">
          <Icon className="h-5 w-5 text-emerald-600" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-4xl font-bold text-gray-900">
          {progress.percent === null ? "–" : `${progress.percent}%`}
        </p>
        <ProgressBar percent={progress.percent} />
        <p className="text-sm text-gray-600">
          {progress.total > 0 ? `${progress.completed} of ${progress.total} ${unit}` : emptyText}
        </p>
        <p className="text-sm font-medium text-emerald-700">{getEncouragement(progress.percent)}</p>
      </CardContent>
    </Card>
  );
}

function AchievementsContent() {
  const { data: session } = useSession();
  const { data, error, isLoading } = useSWR<StudentAchievements>(
    session?.user?.id ? "/api/student/achievements" : null,
    fetcher,
    { revalidateOnFocus: true }
  );

  if (isLoading || !session?.user?.id) {
    return <p className="text-gray-500">Loading your achievements...</p>;
  }
  if (error || !data) {
    return <p className="text-red-600">Could not load your achievements. Please refresh the page.</p>;
  }

  if (data.perClass.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-4">
          <p className="text-gray-600">Join a class to start earning achievements.</p>
          <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Link href="/student/join">Join a class</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Headline: the average of the categories that have something to complete.
  const tracked = [data.lessons.percent, data.quizzes.percent, data.classes.percent].filter(
    (p): p is number => p !== null
  );
  const overall = tracked.length
    ? Math.round(tracked.reduce((a, b) => a + b, 0) / tracked.length)
    : null;

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200">
        <CardContent className="py-6 flex items-center gap-4">
          <Trophy className="h-12 w-12 text-emerald-600 shrink-0" />
          <div>
            <p className="text-2xl font-bold text-gray-900">{getEncouragement(overall)}</p>
            <p className="text-gray-600">
              {overall === null ? "Your progress will show here." : `Overall progress: ${overall}%`}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Pathway lessons"
          icon={BookOpen}
          progress={data.lessons}
          unit="lessons completed"
          emptyText="No approved pathways yet"
        />
        <StatCard
          title="Quizzes"
          icon={ClipboardCheck}
          progress={data.quizzes}
          unit="quizzes submitted"
          emptyText="No quizzes published yet"
        />
        <StatCard
          title="Classes"
          icon={GraduationCap}
          progress={data.classes}
          unit="classes completed"
          emptyText="No classes yet"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>By class</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-gray-100">
            {data.perClass.map((cls) => (
              <li key={cls.classId} className="py-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{cls.title}</p>
                    {cls.professorName && (
                      <p className="text-sm text-gray-500 truncate">{cls.professorName}</p>
                    )}
                  </div>
                  {cls.completed ? (
                    <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                      Completed 🔥
                    </span>
                  ) : (
                    <Link
                      href={`/class/${cls.classId}/pathway`}
                      className="shrink-0 text-sm text-emerald-700 hover:text-emerald-800"
                    >
                      Continue
                    </Link>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Pathway</span>
                      <span>
                        {cls.hasPathway
                          ? `${cls.lessons.completed}/${cls.lessons.total} · ${cls.lessons.percent ?? 0}%`
                          : "Awaiting approval"}
                      </span>
                    </div>
                    <ProgressBar percent={cls.lessons.percent} />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Quizzes</span>
                      <span>
                        {cls.quizzes.total > 0
                          ? `${cls.quizzes.completed}/${cls.quizzes.total} · ${cls.quizzes.percent}%`
                          : "None yet"}
                      </span>
                    </div>
                    <ProgressBar percent={cls.quizzes.percent} />
                  </div>
                </div>
                <p className="text-sm text-emerald-700">
                  {cls.completed ? getEncouragement(100) : getEncouragement(cls.lessons.percent)}
                </p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

export default function StudentAchievementsPage() {
  return (
    <div className="min-h-screen">
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <main className="flex-1 p-4 md:p-6 overflow-y-auto">
            <div className="space-y-6 max-w-5xl">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Achievements</h1>
                <p className="text-gray-600 mt-1">Track your progress across pathways, quizzes and classes</p>
              </div>
              <AchievementsContent />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
