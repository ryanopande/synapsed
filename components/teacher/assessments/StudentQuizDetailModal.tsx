"use client";

import React, { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { StudentQuizResponse } from './types';
import { Input } from '@/components/ui/input';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';

interface StudentQuizDetailModalProps {
  studentResponse: StudentQuizResponse;
  quizId: string;
  quizTitle: string;
  onClose: () => void;
  /** Called with the updated submission after the professor changes a grade. */
  onGraded?: (response: StudentQuizResponse) => void;
}

interface GradeResult {
  score: number | null;
  scoreOverridden: boolean;
  gradedAt: string | null;
  pendingCount: number;
  answers: { id: string; isCorrect: boolean | null }[];
}

export function StudentQuizDetailModal({
  studentResponse: initialResponse,
  quizId,
  quizTitle,
  onClose,
  onGraded,
}: StudentQuizDetailModalProps) {
  const [studentResponse, setStudentResponse] = useState(initialResponse);
  const [savingAnswerId, setSavingAnswerId] = useState<string | null>(null);
  const [scoreInput, setScoreInput] = useState('');
  const [savingScore, setSavingScore] = useState(false);
  const pendingCount = studentResponse.answers.filter((a) => a.isCorrect === null).length;

  const saveGrade = async (payload: { answers?: { answerId: string; isCorrect: boolean | null }[]; score?: number | null }) => {
    const res = await fetch(`/api/professor/quiz/${quizId}/responses/${studentResponse.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to save grade');
    const result = data as GradeResult;
    const grades = new Map(result.answers.map((a) => [a.id, a.isCorrect]));
    const updated: StudentQuizResponse = {
      ...studentResponse,
      score: result.score,
      scoreOverridden: result.scoreOverridden,
      gradedAt: result.gradedAt,
      answers: studentResponse.answers.map((a) => (grades.has(a.id) ? { ...a, isCorrect: grades.get(a.id) ?? null } : a)),
    };
    setStudentResponse(updated);
    onGraded?.(updated);
    return updated;
  };

  const handleMarkAnswer = async (answerId: string, isCorrect: boolean) => {
    setSavingAnswerId(answerId);
    try {
      await saveGrade({ answers: [{ answerId, isCorrect }] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save grade');
    } finally {
      setSavingAnswerId(null);
    }
  };

  const handleSetScore = async () => {
    const value = Number(scoreInput);
    if (scoreInput.trim() === '' || !Number.isFinite(value) || value < 0 || value > 100) {
      toast.error('Enter a score from 0 to 100');
      return;
    }
    setSavingScore(true);
    try {
      await saveGrade({ score: value });
      setScoreInput('');
      toast.success('Score updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update score');
    } finally {
      setSavingScore(false);
    }
  };

  const handleResetScore = async () => {
    setSavingScore(true);
    try {
      await saveGrade({ score: null });
      toast.success('Score recalculated from graded answers');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reset score');
    } finally {
      setSavingScore(false);
    }
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  };

  const getAnswerDisplay = (answer: StudentQuizResponse['answers'][0]) => {
    const question = answer.question;
    
    if (question.type === 'multiple-choice' || question.type === 'true-false') {
      // Find the selected option
      const selectedOption = question.options.find(
        (opt) => opt.id === answer.optionId
      );
      
      // Find the correct option
      const correctOption = question.options.find((opt) => opt.isCorrect);
      
      return {
        studentAnswer: selectedOption?.text || 'No answer selected',
        correctAnswer: correctOption?.text || 'N/A',
        isCorrect: answer.isCorrect,
      };
    } else {
      // Short answer
      return {
        studentAnswer: answer.answerText || 'No answer provided',
        correctAnswer:
          answer.isCorrect === null ? 'Needs grading' : answer.isCorrect ? 'Graded correct' : 'Graded incorrect',
        isCorrect: answer.isCorrect,
      };
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {studentResponse.studentName}&apos;s Quiz Response
          </DialogTitle>
          <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 mt-2">
            <span>{quizTitle}</span>
            <span>•</span>
            <span>{studentResponse.studentEmail}</span>
            {studentResponse.submittedAt && (
              <>
                <span>•</span>
                <span>Submitted: {formatDate(studentResponse.submittedAt)}</span>
              </>
            )}
            {studentResponse.score !== null && (
              <>
                <span>•</span>
                <span className="font-semibold">
                  Score: {studentResponse.score.toFixed(1)}%
                  {studentResponse.scoreOverridden && ' (set manually)'}
                </span>
              </>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            {pendingCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                <Clock className="h-3 w-3" />
                {pendingCount} answer{pendingCount === 1 ? '' : 's'} to grade
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                <CheckCircle2 className="h-3 w-3" />
                All answers graded
              </span>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <label htmlFor="score-override" className="text-sm text-slate-600 dark:text-slate-400">
                Set score
              </label>
              <Input
                id="score-override"
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={scoreInput}
                onChange={(e) => setScoreInput(e.target.value)}
                placeholder={studentResponse.score !== null ? studentResponse.score.toFixed(1) : '0-100'}
                className="w-24 h-8"
              />
              <span className="text-sm text-slate-500">%</span>
              <Button size="sm" onClick={handleSetScore} disabled={savingScore}>
                Save
              </Button>
              {studentResponse.scoreOverridden && (
                <Button size="sm" variant="outline" onClick={handleResetScore} disabled={savingScore}>
                  Use calculated score
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
          <div className="space-y-6">
            {studentResponse.answers.map((answer, index) => {
              const answerDisplay = getAnswerDisplay(answer);
              const question = answer.question;

              return (
                <div
                  key={answer.id}
                  className="border border-slate-200 dark:border-slate-700 rounded-lg p-6 bg-slate-50 dark:bg-slate-800/50"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold text-sm">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                          {question.text}
                        </h3>
                        <span className="inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {question.type === 'multiple-choice'
                            ? 'Multiple Choice'
                            : question.type === 'true-false'
                              ? 'True/False'
                              : 'Short Answer'}
                        </span>
                      </div>
                    </div>
                    {answer.isCorrect !== null && (
                      <div className="flex-shrink-0">
                        {answer.isCorrect ? (
                          <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Options for multiple choice/true-false */}
                  {(question.type === 'multiple-choice' ||
                    question.type === 'true-false') && (
                    <div className="mb-4 space-y-2">
                      {question.options.map((option) => {
                        const isSelected = option.id === answer.optionId;
                        const isCorrect = option.isCorrect;

                        return (
                          <div
                            key={option.id}
                            className={`p-3 rounded-lg border-2 ${
                              isSelected
                                ? isCorrect
                                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                                  : 'border-red-500 bg-red-50 dark:bg-red-900/20'
                                : isCorrect
                                  ? 'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-900/10'
                                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {isSelected && (
                                <span className="text-xs font-semibold">
                                  Your Answer
                                </span>
                              )}
                              {isCorrect && !isSelected && (
                                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                  Correct Answer
                                </span>
                              )}
                              <span
                                className={`flex-1 ${
                                  isSelected
                                    ? 'font-medium'
                                    : isCorrect
                                      ? 'text-emerald-700 dark:text-emerald-300'
                                      : ''
                                }`}
                              >
                                {option.text}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Short answer display */}
                  {question.type === 'short-answer' && (
                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">
                          Student Answer:
                        </label>
                        <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                          <p className="text-slate-900 dark:text-slate-100 whitespace-pre-wrap">
                            {answerDisplay.studentAnswer}
                          </p>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">
                          Status:
                        </label>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {answerDisplay.correctAnswer}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Answer summary and grading */}
                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <div className="flex-1 min-w-0">
                        <span className="text-slate-600 dark:text-slate-400">
                          Student answered:{' '}
                        </span>
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {answerDisplay.studentAnswer}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {answer.isCorrect === null && (
                          <span className="text-xs font-medium text-amber-700">Needs grading</span>
                        )}
                        <Button
                          size="sm"
                          variant={answer.isCorrect === true ? 'default' : 'outline'}
                          className={answer.isCorrect === true ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}
                          disabled={savingAnswerId === answer.id}
                          onClick={() => handleMarkAnswer(answer.id, true)}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Correct
                        </Button>
                        <Button
                          size="sm"
                          variant={answer.isCorrect === false ? 'default' : 'outline'}
                          className={answer.isCorrect === false ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
                          disabled={savingAnswerId === answer.id}
                          onClick={() => handleMarkAnswer(answer.id, false)}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Incorrect
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

