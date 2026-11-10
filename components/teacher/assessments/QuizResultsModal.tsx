"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Quiz, Student, StudentQuizResponse } from './types';
import { Download, Search, Loader2 } from 'lucide-react';
import { StudentQuizDetailModal } from './StudentQuizDetailModal';

interface QuizResultsModalProps {
  quiz: Quiz;
  onClose: () => void;
}

interface QuizResponsesData {
  students: Student[];
  responses: StudentQuizResponse[];
  quiz: {
    id: string;
    title: string;
    questions: Array<{
      id: string;
      text: string;
      type: string;
      options: Array<{
        id: string;
        text: string;
        isCorrect: boolean;
      }>;
    }>;
  };
}

export function QuizResultsModal({ quiz, onClose }: QuizResultsModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [responses, setResponses] = useState<StudentQuizResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedResponse, setSelectedResponse] = useState<StudentQuizResponse | null>(null);

  useEffect(() => {
    const fetchQuizResponses = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/professor/quiz/${quiz.id}/responses`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch quiz responses');
        }

        const data: QuizResponsesData = await response.json();
        setStudents(data.students);
        setResponses(data.responses);
      } catch (err) {
        console.error('Error fetching quiz responses:', err);
        setError(err instanceof Error ? err.message : 'Failed to load quiz responses');
      } finally {
        setLoading(false);
      }
    };

    fetchQuizResponses();
  }, [quiz.id]);

  const filteredStudents = students.filter(
    (student) =>
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.email.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleExport = () => {
    // Export functionality would go here
    console.log('Exporting results...');
  };

  const handleViewDetails = (studentId: string) => {
    const response = responses.find((r) => r.studentId === studentId);
    if (response) {
      setSelectedResponse(response);
    }
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return '—';
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  };

  const getStatusColor = (status: Student['status']) => {
    switch (status) {
      case 'submitted':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
      case 'in-progress':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
      case 'not-started':
        return 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300';
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{quiz.title}</DialogTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {quiz.submissions} of {quiz.totalStudents} students submitted
            {quiz.gradeAverage !== undefined &&
              ` • Average: ${quiz.gradeAverage}%`}
          </p>
        </DialogHeader>

        {/* Search and Export */}
        <div className="flex items-center space-x-3">
          <div className="flex-1 relative">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"
              size={18}
            />
            <Input
              type="text"
              placeholder="Search students..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="secondary" onClick={handleExport}>
            <Download size={18} className="mr-2" />
            Export
          </Button>
        </div>

        {/* Student List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filteredStudents.map((student) => (
                  <tr
                    key={student.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {student.name}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {student.email}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(student.status)}`}
                      >
                        {student.status === 'submitted'
                          ? 'Submitted'
                          : student.status === 'in-progress'
                            ? 'In Progress'
                            : 'Not Started'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                      {formatDate(student.submittedAt)}
                    </td>
                    <td className="px-6 py-4">
                      {student.score !== null && student.score !== undefined ? (
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            student.score >= 90
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                              : student.score >= 80
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                                : student.score >= 70
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                                  : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                          }`}
                        >
                          {student.score.toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-sm text-slate-400 dark:text-slate-500">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {student.status === 'submitted' && (
                        <button
                          onClick={() => handleViewDetails(student.id)}
                          className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                        >
                          View Details
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!loading && !error && filteredStudents.length === 0 && (
            <div className="text-center py-12">
              <p className="text-slate-500 dark:text-slate-400">
                No students found matching your search.
              </p>
            </div>
          )}
        </div>
      </DialogContent>

      {/* Student Detail Modal */}
      {selectedResponse && (
        <StudentQuizDetailModal
          studentResponse={selectedResponse}
          quizTitle={quiz.title}
          onClose={() => setSelectedResponse(null)}
        />
      )}
    </Dialog>
  );
}

