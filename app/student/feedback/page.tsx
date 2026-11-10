"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import ReactMarkdown from "react-markdown";
import { useSession } from "@/lib/auth/client";
import { ArrowRight, ChevronDown, ClipboardCheck, MessageSquare, Sparkles } from "lucide-react";
import Sidebar from "@/components/student/StudentSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { ClassFeedback, PopQuizFeedback } from "@/lib/students/feedback";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load feedback");
  return res.json();
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

function scoreClasses(score: number | null) {
  if (score === null) return "bg-gray-100 text-gray-700";
  if (score >= 80) return "bg-emerald-100 text-emerald-800";
  if (score >= 50) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

function ScoreBadge({ score }: { score: number | null }) {
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${scoreClasses(score)}`}>
      {score === null ? "Not scored" : `${score}%`}
    </span>
  );
}

function SectionTrigger({
  icon: Icon,
  label,
  count,
}: {
  icon: typeof MessageSquare;
  label: string;
  count: number;
}) {
  return (
    <AccordionTrigger className="py-3 hover:no-underline">
      <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
        <Icon className="h-4 w-4 text-emerald-600" />
        {label}
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{count}</span>
      </span>
    </AccordionTrigger>
  );
}

/** Compact pop quiz row: title, score and lesson; the tutor's full feedback opens on demand. */
function PopQuizCard({ quiz, classId }: { quiz: PopQuizFeedback; classId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-gray-200 px-4 py-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-gray-900">{quiz.topic}</p>
          <p className="text-xs text-gray-500">
            {quiz.lesson ? `Lesson: ${quiz.lesson.title} · ` : ""}
            {formatDate(quiz.submittedAt)}
          </p>
        </div>
        <ScoreBadge score={quiz.score} />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {quiz.feedback && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            {open ? "Hide feedback" : "View feedback"}
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        )}
        {quiz.lesson && (
          <Link
            href={`/class/${classId}/lesson/${quiz.lesson.nodeId}?nodeTitle=${encodeURIComponent(quiz.lesson.title)}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800"
          >
            Revisit lesson
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
      {open && quiz.feedback && (
        <div className="border-t border-gray-100 pt-2 text-sm text-gray-700 space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_li]:mt-1">
          <ReactMarkdown>{quiz.feedback}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}

function ClassFeedbackCard({ cls }: { cls: ClassFeedback }) {
  const isEmpty =
    cls.professorFeedback.length === 0 && cls.professorQuizzes.length === 0 && cls.popQuizzes.length === 0;

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div>
          <CardTitle>{cls.title}</CardTitle>
          {cls.professorName && <p className="text-sm text-gray-500 mt-1">{cls.professorName}</p>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Pathway</span>
              <span>
                {cls.lessons.total > 0
                  ? `${cls.lessons.completed}/${cls.lessons.total} lessons · ${cls.lessons.percent}%`
                  : "Awaiting approval"}
              </span>
            </div>
            <Progress value={cls.lessons.percent ?? 0} className="h-2 bg-emerald-100 [&>div]:bg-emerald-600" />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Quizzes submitted</span>
              <span>
                {cls.quizzes.total > 0
                  ? `${cls.quizzes.completed}/${cls.quizzes.total} · ${cls.quizzes.percent}%`
                  : "None yet"}
              </span>
            </div>
            <Progress value={cls.quizzes.percent ?? 0} className="h-2 bg-emerald-100 [&>div]:bg-emerald-600" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {isEmpty && (
          <p className="text-sm text-gray-500">
            No feedback yet. Work through your pathway and take the pop quizzes to get feedback here.
          </p>
        )}

        {!isEmpty && (
          <Accordion type="multiple" className="rounded-lg border border-gray-200 px-4">
            {cls.professorFeedback.length > 0 && (
              <AccordionItem value="professor">
                <SectionTrigger icon={MessageSquare} label="From your professor" count={cls.professorFeedback.length} />
                <AccordionContent className="space-y-3">
                  {cls.professorFeedback.map((note) => (
                    <div key={note.id} className="rounded-lg border-l-4 border-emerald-500 bg-emerald-50 p-4">
                      <p className="whitespace-pre-wrap text-gray-800">{note.message}</p>
                      <p className="mt-2 text-xs text-gray-500">
                        {note.professorName ?? "Professor"} · {formatDate(note.createdAt)}
                      </p>
                    </div>
                  ))}
                </AccordionContent>
              </AccordionItem>
            )}

            {cls.professorQuizzes.length > 0 && (
              <AccordionItem value="quizzes">
                <SectionTrigger icon={ClipboardCheck} label="Quiz results" count={cls.professorQuizzes.length} />
                <AccordionContent>
                  <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                    {cls.professorQuizzes.map((quiz) => (
                      <li key={quiz.quizId} className="flex items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{quiz.title}</p>
                          <p className="text-xs text-gray-500">Submitted {formatDate(quiz.submittedAt)}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <ScoreBadge score={quiz.score} />
                          <Link
                            href={`/class/${cls.classId}/quiz/${quiz.quizId}/results`}
                            className="text-sm text-emerald-700 hover:text-emerald-800"
                          >
                            Review
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            )}

            {cls.popQuizzes.length > 0 && (
              <AccordionItem value="pop-quizzes" className="border-b-0">
                <SectionTrigger icon={Sparkles} label="Pop quiz feedback from your AI tutor" count={cls.popQuizzes.length} />
                <AccordionContent className="space-y-3">
                  {cls.popQuizzes.map((quiz) => (
                    <PopQuizCard key={quiz.id} quiz={quiz} classId={cls.classId} />
                  ))}
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}

function FeedbackContent() {
  const { data: session } = useSession();
  const { data, error, isLoading } = useSWR<{ classes: ClassFeedback[] }>(
    session?.user?.id ? "/api/student/feedback" : null,
    fetcher,
    { revalidateOnFocus: true }
  );

  if (isLoading || !session?.user?.id) {
    return <p className="text-gray-500">Loading your feedback...</p>;
  }
  if (error || !data) {
    return <p className="text-red-600">Could not load your feedback. Please refresh the page.</p>;
  }
  if (data.classes.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-4">
          <p className="text-gray-600">Join a class to start receiving feedback.</p>
          <Button asChild className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Link href="/student/join">Join a class</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {data.classes.map((cls) => (
        <ClassFeedbackCard key={cls.classId} cls={cls} />
      ))}
    </div>
  );
}

export default function StudentFeedbackPage() {
  return (
    <div className="min-h-screen">
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <main className="flex-1 p-4 md:p-6 overflow-y-auto">
            <div className="space-y-6 max-w-4xl">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Feedback</h1>
                <p className="text-gray-600 mt-1">
                  Notes from your professor, quiz results and pop quiz feedback from your AI tutor
                </p>
              </div>
              <FeedbackContent />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
