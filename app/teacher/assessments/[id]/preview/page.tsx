"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, ArrowLeft } from "lucide-react";
import Image from "next/image";
import { RichTextDisplay } from "@/components/richtext/RichTextDisplay";
import { Question, Quiz as QuizType } from "@/lib/types/quizzes";

type QuizQuestion = Question;

type Quiz = {
  id: string;
  title: string;
  description?: string;
  questions: QuizQuestion[];
};

export default function QuizPreviewPage() {
  const router = useRouter();
  const params = useParams();
  const quizId = params.id as string;
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (!quizId) {
      console.log('No quizId found in params:', params);
      return;
    }

    console.log('Loading quiz with ID:', quizId);

    const loadQuiz = async () => {
      try {
        const response = await fetch(`/api/professor/quiz/${quizId}`);
        console.log('Quiz API response status:', response.status);
        if (!response.ok) {
          const errorData = await response.json();
          console.error('Failed to load quiz:', errorData);
          throw new Error('Failed to load quiz');
        }
        
        const data = await response.json();
        const quizData: QuizType = data.quiz;
        
        // Transform questions from API format
        const transformedQuestions: QuizQuestion[] = (quizData.questions || []).map((q) => ({
          id: q.id,
          text: q.text || '',
          richTextContent: q.richTextContent,
          type: (typeof q.type === 'string' && q.type.includes('_')
            ? q.type.toLowerCase().replace('_', '-')
            : q.type) as "multiple-choice" | "short-answer" | "true-false",
          imageUrl: q.imageUrl || undefined,
          order: q.order || 0,
          options: (q.options || []).map((opt) => ({
            id: opt.id,
            text: opt.text || '',
            isCorrect: opt.isCorrect || false,
          })),
        }));

        setQuiz({
          id: quizData.id,
          title: quizData.title || 'Untitled Quiz',
          description: quizData.description || undefined,
          questions: transformedQuestions.sort((a, b) => (a.order || 0) - (b.order || 0)),
        });
      } catch (error) {
        console.error('Error loading quiz:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadQuiz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId]);

  const handleAnswer = (value: string) => {
    const questionId = quiz?.questions[current]?.id;
    if (questionId) {
      setAnswers((prev) => ({ ...prev, [questionId]: value }));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-100 flex items-center justify-center p-6">
        <Card className="w-full max-w-xl text-center">
          <CardHeader>
            <CardTitle className="text-2xl text-slate-800">Loading Quiz...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!quiz || quiz.questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-100 flex items-center justify-center p-6">
        <Card className="w-full max-w-xl text-center">
          <CardHeader>
            <CardTitle className="text-2xl text-slate-800">Quiz Not Found</CardTitle>
            <p className="text-slate-600">This quiz doesn&apos;t exist or has no questions.</p>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.back()} className="mt-4">
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const q = quiz.questions[current];
  const questionId = q?.id;
  const isTextQuestion = q?.type === "short-answer";
  const isMultipleChoice = q?.type === "multiple-choice";
  const isTrueFalse = q?.type === "true-false";
  const progress = ((current + 1) / quiz.questions.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-100 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-6 shadow-sm">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">{quiz.title}</h1>
              {quiz.description && (
                <p className="text-sm text-slate-600 mt-1">{quiz.description}</p>
              )}
            </div>
            <span className="text-sm text-slate-600">
              Question {current + 1} of {quiz.questions.length}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      {/* Question Content */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-xl text-slate-800">
                <RichTextDisplay 
                  text={q?.text || ''} 
                  richTextContent={q?.richTextContent} 
                />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Question Image */}
              {q?.imageUrl && (
                <div className="my-4">
                  <Image
                    src={q.imageUrl}
                    alt="Question"
                    width={800}
                    height={400}
                    className="w-full h-auto rounded-lg border border-slate-200"
                  />
                </div>
              )}

              {isTextQuestion && (
                <textarea
                  value={questionId ? (answers[questionId] || "") : ""}
                  onChange={(e) => handleAnswer(e.target.value)}
                  placeholder="Type your answer..."
                  className="w-full p-3 border rounded-md"
                  rows={4}
                />
              )}

              {(isMultipleChoice || isTrueFalse) && (
                <div className="space-y-2">
                  {q.options?.map((opt) => (
                    <label
                      key={opt.id}
                      className={`block border p-3 rounded-lg cursor-pointer transition-colors ${
                        questionId && answers[questionId] === opt.text
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                          : "border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name={questionId || ""}
                        value={opt.text}
                        className="mr-2"
                        checked={questionId ? answers[questionId] === opt.text : false}
                        onChange={() => handleAnswer(opt.text)}
                      />
                      {opt.text}
                    </label>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="bg-white border-t border-slate-200 p-6 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Button 
            variant="outline" 
            className="text-emerald-700 border-emerald-300 hover:bg-emerald-50" 
            onClick={() => setCurrent((c) => c - 1)} 
            disabled={current === 0}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>

          <div className="flex space-x-2">
            {quiz.questions.map((question, index) => {
              const qId = question.id;
              const hasAnswer = qId && answers[qId];
              return (
                <button
                  key={index}
                  onClick={() => setCurrent(index)}
                  className={`w-10 h-10 rounded-full text-sm font-medium transition-colors ${
                    index === current
                      ? "bg-emerald-600 text-white"
                      : hasAnswer
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                  }`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>

          {current === quiz.questions.length - 1 ? (
            <Button
              onClick={() => {
                // In preview mode, just show a message
                alert('This is a preview. Answers are not submitted.');
              }}
              disabled={!questionId || !answers[questionId]}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300"
            >
              Preview Submit
            </Button>
          ) : (
            <Button 
              onClick={() => setCurrent((c) => c + 1)} 
              disabled={!questionId || !answers[questionId]} 
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300"
            >
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

