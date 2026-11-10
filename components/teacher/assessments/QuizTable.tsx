"use client";

import React from 'react';
import { Card } from '@/components/ui/card';
import { Quiz } from './types';
import { Edit, Eye, BarChart3, Lock, Unlock } from 'lucide-react';

interface QuizTableProps {
  quizzes: Quiz[];
  onToggleStatus: (quizId: string) => void;
  onViewResults: (quizId: string) => void;
  onEdit: (quizId: string) => void;
  onPreview: (quizId: string) => void;
}

export function QuizTable({
  quizzes,
  onToggleStatus,
  onViewResults,
  onEdit,
  onPreview,
}: QuizTableProps) {
  const getStatusColor = (status: Quiz['status']) => {
    switch (status) {
      case 'published':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'archived':
        return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300';
      case 'draft':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
    }
  };

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return '—';
    
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Check if date is valid
    if (isNaN(dateObj.getTime())) {
      return '—';
    }
    
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(dateObj);
  };

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 backdrop-blur-sm">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Quiz Title
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Submissions
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Grade Average
              </th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {quizzes.map((quiz) => (
              <tr
                key={quiz.id}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <td className="px-6 py-4">
                  <button
                    onClick={() => onEdit(quiz.id)}
                    className="text-left font-medium text-slate-900 dark:text-slate-100 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                  >
                    {quiz.title}
                  </button>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(quiz.status)}`}
                  >
                    {quiz.status.charAt(0).toUpperCase() + quiz.status.slice(1)}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                  {formatDate(quiz.createdAt)}
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => onViewResults(quiz.id)}
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                  >
                    {quiz.submissions}/{quiz.totalStudents}
                  </button>
                </td>
                <td className="px-6 py-4">
                  {quiz.gradeAverage !== undefined ? (
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        quiz.gradeAverage >= 90
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                          : quiz.gradeAverage >= 80
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                            : quiz.gradeAverage >= 70
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                      }`}
                    >
                      {quiz.gradeAverage}%
                    </span>
                  ) : (
                    <span className="text-sm text-slate-400 dark:text-slate-500">
                      —
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      onClick={() => onToggleStatus(quiz.id)}
                      className="p-1.5 text-slate-600 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 transition-colors"
                      title={quiz.status === 'published' ? 'Archive Quiz' : 'Publish Quiz'}
                    >
                      {quiz.status === 'published' ? (
                        <Lock size={18} />
                      ) : (
                        <Unlock size={18} />
                      )}
                    </button>
                    <button
                      onClick={() => onViewResults(quiz.id)}
                      className="p-1.5 text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors"
                      title="View Results"
                    >
                      <BarChart3 size={18} />
                    </button>
                    <button
                      onClick={() => onEdit(quiz.id)}
                      className="p-1.5 text-slate-600 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 transition-colors"
                      title="Edit Quiz"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => onPreview(quiz.id)}
                      className="p-1.5 text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors"
                      title="Preview as Student"
                    >
                      <Eye size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

