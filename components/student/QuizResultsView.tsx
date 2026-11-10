"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, XCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { RichTextDisplay } from '@/components/richtext/RichTextDisplay';
import Image from 'next/image';
import { RichTextContent } from '@/lib/types/quizzes';

interface QuizAnswer {
  id: string;
  questionId: string;
  question: {
    id: string;
    text: string;
    richTextContent?: RichTextContent;
    type: 'multiple-choice' | 'short-answer' | 'true-false';
    imageUrl: string | null;
    order: number;
    options: Array<{
      id: string;
      text: string;
      isCorrect: boolean;
      order: number;
    }>;
  };
  answerText: string | null;
  optionId: string | null;
  isCorrect: boolean | null;
}

interface QuizResultsData {
  id: string;
  quizId: string;
  quizTitle: string;
  quizDescription: string | null;
  studentId: string;
  score: number | null;
  submittedAt: Date | string;
  answers: QuizAnswer[];
}

interface QuizResultsViewProps {
  quizResults: QuizResultsData;
  classId: string;
}

export function QuizResultsView({ quizResults, classId }: QuizResultsViewProps) {
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

  const getAnswerDisplay = (answer: QuizAnswer) => {
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

  const correctCount = quizResults.answers.filter(a => a.isCorrect === true).length;
  const totalQuestions = quizResults.answers.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-100">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <Link 
            href={`/class/${classId}/quizzes`}
            className="inline-flex items-center gap-2 text-emerald-700 hover:text-emerald-800 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Quizzes</span>
          </Link>
          
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-2xl font-bold">{quizResults.quizTitle}</CardTitle>
              {quizResults.quizDescription && (
                <p className="text-slate-600 mt-2">{quizResults.quizDescription}</p>
              )}
              <div className="flex items-center gap-4 text-sm text-slate-500 mt-4">
                <span>Submitted: {formatDate(quizResults.submittedAt)}</span>
                {quizResults.score !== null && (
                  <>
                    <span>•</span>
                    <span className="font-semibold text-slate-900">
                      Score: {quizResults.score.toFixed(1)}%
                    </span>
                  </>
                )}
                <span>•</span>
                <span>
                  {correctCount} of {totalQuestions} correct
                </span>
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Questions and Answers */}
        <div className="space-y-6 mb-6">
          {quizResults.answers.map((answer, index) => {
            const answerDisplay = getAnswerDisplay(answer);
            const question = answer.question;

            return (
              <Card
                key={answer.id}
                className="border-slate-200"
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-semibold text-sm">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <CardTitle className="text-lg">
                          <RichTextDisplay 
                            text={question.text} 
                            richTextContent={question.richTextContent} 
                          />
                        </CardTitle>
                        <span className="inline-block mt-2 px-2 py-0.5 text-xs font-medium rounded bg-slate-200 text-slate-700">
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
                          <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                        ) : (
                          <XCircle className="w-6 h-6 text-red-600" />
                        )}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Question Image */}
                  {question.imageUrl && (
                    <div className="mb-4">
                      <Image
                        src={question.imageUrl}
                        alt="Question"
                        width={800}
                        height={400}
                        className="w-full h-auto rounded-lg border border-slate-200"
                      />
                    </div>
                  )}

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
                                  ? 'border-emerald-500 bg-emerald-50'
                                  : 'border-red-500 bg-red-50'
                                : isCorrect
                                  ? 'border-emerald-300 bg-emerald-50/50'
                                  : 'border-slate-200 bg-white'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {isSelected && (
                                <span className="text-xs font-semibold">
                                  Your Answer
                                </span>
                              )}
                              {isCorrect && !isSelected && (
                                <span className="text-xs font-semibold text-emerald-700">
                                  Correct Answer
                                </span>
                              )}
                              <span
                                className={`flex-1 ${
                                  isSelected
                                    ? 'font-medium'
                                    : isCorrect
                                      ? 'text-emerald-700'
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
                        <label className="text-sm font-medium text-slate-700 mb-1 block">
                          Your Answer:
                        </label>
                        <div className="p-3 rounded-lg bg-white border border-slate-200">
                          <p className="text-slate-900 whitespace-pre-wrap">
                            {answerDisplay.studentAnswer}
                          </p>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700 mb-1 block">
                          Status:
                        </label>
                        <p className="text-sm text-slate-600">
                          {answerDisplay.correctAnswer}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Answer summary */}
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <div className="flex items-center gap-4 text-sm">
                      <div>
                        <span className="text-slate-600">
                          You answered:{' '}
                        </span>
                        <span className="font-medium text-slate-900">
                          {answerDisplay.studentAnswer}
                        </span>
                      </div>
                      {answer.isCorrect !== null && (
                        <div
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            answer.isCorrect
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {answer.isCorrect ? 'Correct' : 'Incorrect'}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Summary Card */}
        <Card className="bg-gradient-to-r from-emerald-50 to-blue-50 border-emerald-200">
          <CardHeader>
            <CardTitle className="text-xl">Quiz Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-3xl font-bold text-emerald-700">
                  {quizResults.score !== null ? quizResults.score.toFixed(1) : 'N/A'}%
                </div>
                <div className="text-sm text-slate-600 mt-1">Overall Score</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-blue-700">
                  {correctCount}
                </div>
                <div className="text-sm text-slate-600 mt-1">Correct Answers</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-slate-700">
                  {totalQuestions}
                </div>
                <div className="text-sm text-slate-600 mt-1">Total Questions</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

