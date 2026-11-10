"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { StudentQuizResponse } from './types';
import { CheckCircle2, XCircle } from 'lucide-react';

interface StudentQuizDetailModalProps {
  studentResponse: StudentQuizResponse;
  quizTitle: string;
  onClose: () => void;
}

export function StudentQuizDetailModal({
  studentResponse,
  quizTitle,
  onClose,
}: StudentQuizDetailModalProps) {
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
        correctAnswer: 'Manual grading required',
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
                </span>
              </>
            )}
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

                  {/* Answer summary */}
                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-4 text-sm">
                      <div>
                        <span className="text-slate-600 dark:text-slate-400">
                          Student answered:{' '}
                        </span>
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {answerDisplay.studentAnswer}
                        </span>
                      </div>
                      {answer.isCorrect !== null && (
                        <div
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            answer.isCorrect
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                          }`}
                        >
                          {answer.isCorrect ? 'Correct' : 'Incorrect'}
                        </div>
                      )}
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

