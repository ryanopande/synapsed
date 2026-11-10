
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ArrowRight, CheckCircle } from "lucide-react";

type SurveyQuestion = {
  id: string;
  questionId?: string; // For backward compatibility
  text: string;
  type: "short-answer" | "multiple-choice" | "text" | "multiple_choice" | "rating" | "ranking";
  options?: string[];
};

type SurveyState = "intro" | "survey" | "submitted";

export default function StudentSurveyPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { classId } = useParams();
  const studentId = session?.user?.id;

  const [state, setState] = useState<SurveyState>("intro");
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!classId) return;

    fetch(`/api/survey/${classId}`)
      .then((res) => res.json())
      .then((data) => {
        console.log('🔍 Survey questions fetched:', {
          questionsCount: data?.questions?.length,
          firstQuestion: data?.questions?.[0],
          firstQuestionKeys: data?.questions?.[0] ? Object.keys(data.questions[0]) : [],
          allQuestionTypes: data?.questions?.map((q: SurveyQuestion) => ({ id: q.questionId, type: q.type, text: q.text?.substring(0, 50) }))
        });
        setQuestions(data?.questions || []);
      });
  }, [classId]);

  const handleAnswer = (value: string) => {
    const questionId = questions[current].id || questions[current].questionId;
    if (questionId) {
      setAnswers((prev) => ({ ...prev, [questionId]: value }));
    }
  };

  const handleSubmit = async () => {
    const payload = {
      studentId,
      classId,
      answers: Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer })),
    };

    const res = await fetch("/api/survey/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      toast("Survey submitted", { description: "Thanks for your answers!" });
      setState("submitted");
    } else {
      toast("Error", { description: "Submission failed" });
    }
  };

  if (state === "intro") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-100 flex items-center justify-center p-6">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-3xl text-slate-800 mb-2">Class Personalization Survey</CardTitle>
            <p className="text-slate-600 text-lg">
              Help us tailor your experience by answering a few quick questions.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-emerald-800 text-sm">
              This quick survey helps your professor and our AI understand how to best support your learning.
            </div>

            <div className="flex justify-center space-x-4">
              <Button variant="outline" className="text-emerald-700 border-emerald-300 hover:bg-emerald-50" onClick={() => router.push("/student/dashboard")}>
                Back to Dashboard
              </Button>
              <Button
                onClick={() => setState("survey")}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Start Survey <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state === "submitted") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-emerald-50 p-6">
        <Card className="text-center max-w-xl w-full">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-slate-800 mb-2">Thank You!</CardTitle>
            <p className="text-slate-600">
              Your answers have been recorded. A personalized learning path will be available soon 🚀
            </p>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push(`/class/${classId}`)} className="mt-6 bg-emerald-600 hover:bg-emerald-700">
              Go to Class
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handle case where no questions exist
  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-6">
        <Card className="w-full max-w-xl text-center">
          <CardHeader>
            <CardTitle className="text-2xl text-slate-800">No Survey Available</CardTitle>
            <p className="text-slate-600">This class doesn&apos;t have a survey set up yet. Please contact your professor.</p>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push(`/class/${classId}`)} className="mt-4">
              Go Back to Class
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const q = questions[current];
  const questionId = q?.id || q?.questionId;
  const isTextQuestion = q?.type === "short-answer" || q?.type === "text";
  const isMultipleChoice = q?.type === "multiple-choice" || q?.type === "multiple_choice";
  const isRating = q?.type === "rating";
  const isRanking = q?.type === "ranking";
  
  // Handle case where current question is undefined
  if (!q) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-6">
        <Card className="w-full max-w-xl text-center">
          <CardHeader>
            <CardTitle className="text-2xl text-slate-800">Survey Error</CardTitle>
            <p className="text-slate-600">There was an issue loading the survey questions.</p>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push(`/class/${classId}`)} className="mt-4">
              Go Back to Class
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const progress = ((current + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-100 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-6 shadow-sm">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-slate-800">Survey</h1>
            <span className="text-sm text-slate-600">
              Question {current + 1} of {questions.length}
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
              <CardTitle className="text-xl text-slate-800">{q?.text}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isTextQuestion && (
                <textarea
                  value={questionId ? (answers[questionId] || "") : ""}
                  onChange={(e) => handleAnswer(e.target.value)}
                  placeholder="Type your answer..."
                  className="w-full p-3 border rounded-md"
                  rows={4}
                />
              )}

              {isMultipleChoice && (
                <div className="space-y-2">
                  {q.options?.map((opt, index) => (
                    <label
                      key={index}
                      className={`block border p-3 rounded-lg cursor-pointer ${
                        questionId && answers[questionId] === opt
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                          : "border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name={questionId || ""}
                        value={opt}
                        className="mr-2"
                        checked={questionId ? answers[questionId] === opt : false}
                        onChange={() => handleAnswer(opt)}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              )}

              {isRating && (
                <div className="space-y-4">
                  <div className="text-sm text-slate-600 mb-4">
                    Rate from 1 (not comfortable) to 5 (very comfortable)
                  </div>
                  <div className="flex space-x-4 justify-center">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <label
                        key={rating}
                        className={`w-12 h-12 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all ${
                          questionId && answers[questionId] === rating.toString()
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-slate-300 hover:border-emerald-400 hover:bg-emerald-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name={questionId || ""}
                          value={rating.toString()}
                          className="sr-only"
                          checked={questionId ? answers[questionId] === rating.toString() : false}
                          onChange={() => handleAnswer(rating.toString())}
                        />
                        <span className="font-semibold">{rating}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Not comfortable</span>
                    <span>Very comfortable</span>
                  </div>
                </div>
              )}

              {isRanking && (
                <div className="space-y-3">
                  <div className="text-sm text-slate-600 mb-4">
                    Drag to reorder or click to select your preference
                  </div>
                  <div className="space-y-2">
                    {q.options?.map((opt, index) => (
                      <label
                        key={index}
                        className={`block border p-3 rounded-lg cursor-pointer ${
                          questionId && answers[questionId] === opt
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                            : "border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name={questionId || ""}
                          value={opt}
                          className="mr-2"
                          checked={questionId ? answers[questionId] === opt : false}
                          onChange={() => handleAnswer(opt)}
                        />
                        <span className="font-medium">{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Fallback for unknown question types */}
              {!isTextQuestion && !isMultipleChoice && !isRating && !isRanking && (
                <div className="p-4 border border-yellow-200 bg-yellow-50 rounded-lg">
                  <p className="text-yellow-800 text-sm">
                    <strong>Unknown question type:</strong> {q?.type}
                  </p>
                  <p className="text-yellow-700 text-xs mt-1">
                    This question type is not yet supported. Please contact your professor.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="bg-white border-t border-slate-200 p-6 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Button variant="outline" className="text-emerald-700 border-emerald-300 hover:bg-emerald-50" onClick={() => setCurrent((c) => c - 1)} disabled={current === 0}>
            Previous
          </Button>

          <div className="flex space-x-2">
            {questions.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrent(index)}
                className={`w-10 h-10 rounded-full text-sm font-medium transition-colors ${
                  index === current
                    ? "bg-emerald-600 text-white"
                    : (() => {
                        const questionId = questions[index]?.id || questions[index]?.questionId;
                        return questionId && answers[questionId];
                      })()
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>

          {current === questions.length - 1 ? (
            <Button
              onClick={handleSubmit}
              disabled={!questionId || !answers[questionId]}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300"
            >
              Submit Survey
            </Button>
          ) : (
            <Button onClick={() => setCurrent((c) => c + 1)} disabled={!questionId || !answers[questionId]} className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300">
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
