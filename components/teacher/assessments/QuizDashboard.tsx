"use client";

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QuizTable } from './QuizTable';
import { QuizResultsModal } from './QuizResultsModal';
import { DashboardMetrics } from './DashboardMetrics';
import { Quiz } from './types';
import { Plus } from 'lucide-react';

interface QuizDashboardProps {
  classId: string;
  onCreateQuiz: () => void;
  onEditQuiz: (quizId: string) => void;
}

export function QuizDashboard({
  classId,
  onCreateQuiz,
  onEditQuiz,
}: QuizDashboardProps) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedQuizForResults, setSelectedQuizForResults] = useState<
    string | null
  >(null);
  const [confirmationDialog, setConfirmationDialog] = useState<{
    quizId: string;
    action: 'publish' | 'archive';
  } | null>(null);

  // Load quizzes on mount
  useEffect(() => {
    const loadQuizzes = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/professor/quizzes/${classId}`);
        if (!response.ok) {
          throw new Error('Failed to load quizzes');
        }
        
        const data = await response.json();
        setQuizzes(data.quizzes || []);
      } catch (error) {
        console.error('Error loading quizzes:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadQuizzes();
  }, [classId]);

  const handleToggleStatus = (quizId: string) => {
    const quiz = quizzes.find((q) => q.id === quizId);
    if (!quiz) return;

    if (quiz.status === 'draft' || quiz.status === 'archived') {
      setConfirmationDialog({
        quizId,
        action: 'publish',
      });
    } else {
      setConfirmationDialog({
        quizId,
        action: 'archive',
      });
    }
  };

  const confirmToggleStatus = async () => {
    if (!confirmationDialog) return;

    try {
      const response = await fetch(
        `/api/professor/quiz/${confirmationDialog.quizId}/publish`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: confirmationDialog.action }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update quiz status');
      }

      // Update local state
      setQuizzes(
        quizzes.map((quiz) =>
          quiz.id === confirmationDialog.quizId
            ? {
                ...quiz,
                status:
                  confirmationDialog.action === 'publish'
                    ? 'published'
                    : 'archived',
              }
            : quiz,
        ),
      );

      setConfirmationDialog(null);
    } catch (error) {
      console.error('Error updating quiz status:', error);
      alert(error instanceof Error ? error.message : 'Failed to update quiz status');
    }
  };

  const handleViewResults = (quizId: string) => {
    setSelectedQuizForResults(quizId);
  };

  const handlePreview = (quizId: string) => {
    // Navigate to preview page
    window.open(`/teacher/assessments/${quizId}/preview`, '_blank');
  };

  const selectedQuiz = quizzes.find((q) => q.id === selectedQuizForResults);

  return (
    <div className="min-h-screen w-full">
      {/* Header */}
      <div className="glass rounded-2xl mx-4 my-4 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Your Quizzes</h1>
          <p className="text-slate-600 mt-1">Create and manage your quizzes and assessments.</p>
        </div>
        <Button onClick={onCreateQuiz} variant="default">
          <Plus size={20} className="mr-2" />
          Create New Quiz
        </Button>
      </div>

      {/* Main Content */}
      <div className="px-4 pb-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin h-12 w-12 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-slate-500">Loading quizzes...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-6">
            {/* Metrics Panel */}
            <div className="col-span-12 lg:col-span-3">
              <DashboardMetrics quizzes={quizzes} />
            </div>

            {/* Quiz Table */}
            <div className="col-span-12 lg:col-span-9">
              {quizzes.length === 0 ? (
              <Card className="p-12 text-center">
                <div className="flex flex-col items-center">
                  <div className="h-24 w-24 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
                    <Plus className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h2 className="text-2xl font-semibold mb-2">No quizzes yet</h2>
                  <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md">
                    Get started by creating your first quiz. You can build
                    assessments with multiple choice, short answer, and
                    true/false questions.
                  </p>
                  <Button onClick={onCreateQuiz} variant="default">
                    <Plus size={20} className="mr-2" />
                    Create Your First Quiz
                  </Button>
                </div>
              </Card>
            ) : (
              <QuizTable
                quizzes={quizzes}
                onToggleStatus={handleToggleStatus}
                onViewResults={handleViewResults}
                onEdit={onEditQuiz}
                onPreview={handlePreview}
              />
            )}
          </div>
        </div>
        )}
      </div>

      {/* Results Modal */}
      {selectedQuiz && (
        <QuizResultsModal
          quiz={selectedQuiz}
          onClose={() => setSelectedQuizForResults(null)}
        />
      )}

      {/* Confirmation Dialog */}
      {confirmationDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">
              {confirmationDialog.action === 'publish'
                ? 'Publish Quiz'
                : 'Archive Quiz'}
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              {confirmationDialog.action === 'publish'
                ? 'Are you sure you want to publish this quiz? Students will be able to access and submit their answers.'
                : 'Are you sure you want to archive this quiz? Students will no longer be able to submit answers.'}
            </p>
            <div className="flex justify-end space-x-3">
              <Button
                variant="secondary"
                onClick={() => setConfirmationDialog(null)}
              >
                Cancel
              </Button>
              <Button variant="default" onClick={confirmToggleStatus}>
                {confirmationDialog.action === 'publish'
                  ? 'Publish Quiz'
                  : 'Archive Quiz'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

