"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, FileText, CheckCircle2 } from "lucide-react";
import Link from "next/link";

type QuizCardProps = {
  id: string;
  title: string;
  description?: string;
  totalQuestions: number;
  dueDate?: Date | string;
  status: "not-started" | "in-progress" | "completed";
  classId: string;
  isOverdue?: boolean;
};

export function QuizCard({
  id,
  title,
  description,
  totalQuestions,
  dueDate,
  status,
  classId,
  isOverdue = false,
}: QuizCardProps) {
  const formatDate = (date: Date | string | undefined) => {
    if (!date) return null;
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return null;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(dateObj);
  };

  const getStatusColor = () => {
    switch (status) {
      case "completed":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";
      case "in-progress":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300";
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg text-slate-800">{title}</CardTitle>
            {description && (
              <p className="text-sm text-slate-600 mt-1 line-clamp-2">{description}</p>
            )}
          </div>
          {status === "completed" && (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 ml-2" />
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center gap-4 text-sm text-slate-600">
            <div className="flex items-center gap-1">
              <FileText className="w-4 h-4" />
              <span>{totalQuestions} questions</span>
            </div>
            {dueDate && (
              <div className={`flex items-center gap-1 ${isOverdue ? 'text-red-600 font-medium' : ''}`}>
                <Clock className="w-4 h-4" />
                <span>
                  {isOverdue ? 'Overdue: ' : 'Due '}
                  {formatDate(dueDate)}
                </span>
              </div>
            )}
          </div>
          
          <div className="flex items-center justify-between">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor()}`}>
              {status === "completed" ? "Completed" : status === "in-progress" ? "In Progress" : "Not Started"}
            </span>
            <Link href={status === "completed" ? `/class/${classId}/quiz/${id}/results` : `/class/${classId}/quiz/${id}`}>
              <Button
                variant={status === "completed" ? "outline" : "default"}
                className={status === "completed" ? "" : "bg-emerald-600 hover:bg-emerald-700"}
              >
                {status === "completed" ? "View Results" : status === "in-progress" ? "Continue" : "Start Quiz"}
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

