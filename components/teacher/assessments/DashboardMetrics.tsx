"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Users, CheckCircle, TrendingUp } from 'lucide-react';
import { Quiz } from './types';

interface DashboardMetricsProps {
  quizzes: Quiz[];
}

export function DashboardMetrics({ quizzes }: DashboardMetricsProps) {
  const publishedQuizzes = quizzes.filter((q) => q.status !== 'draft').length;
  const totalSubmissions = quizzes.reduce((sum, q) => sum + (q.submissions || 0), 0);
  const totalPossibleSubmissions = quizzes.reduce(
    (sum, q) => (q.status !== 'draft' ? sum + (q.totalStudents || 0) : sum),
    0,
  );
  const completionRate =
    totalPossibleSubmissions > 0
      ? Math.round((totalSubmissions / totalPossibleSubmissions) * 100)
      : 0;
  const gradedQuizzes = quizzes.filter((q) => q.gradeAverage !== undefined);
  const averageGrade =
    gradedQuizzes.length > 0
      ? Math.round(
          gradedQuizzes.reduce((sum, q) => sum + (q.gradeAverage || 0), 0) /
            gradedQuizzes.length,
        )
      : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Published Quizzes
              </p>
              <p className="text-2xl font-bold">{publishedQuizzes}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Total Submissions
              </p>
              <p className="text-2xl font-bold">{totalSubmissions}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Completion Rate
              </p>
              <p className="text-2xl font-bold">{completionRate}%</p>
            </div>
          </div>
          <div className="mt-3">
            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
              <div
                className="bg-amber-600 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${completionRate}%`,
                }}
              ></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {gradedQuizzes.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Average Grade
                </p>
                <p className="text-2xl font-bold">{averageGrade}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

