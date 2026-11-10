"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

type SurveyQuestion = {
  id: string;
  questionId?: string; // For backward compatibility
  text: string;
  type: "short-answer" | "multiple-choice" | "text" | "multiple_choice" | "rating" | "ranking";
  options?: string[];
};

type SurveyState = "intro" | "survey" | "submitted";

export default function StudentSurveyScreen() {
  const { data: session } = useSession();
  const router = useRouter();
  const { classId } = useParams();
  const studentId = session?.user?.id;

  const [state, setState] = useState<SurveyState>("intro");
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [current, setCurrent] = useState(0);

  // Load survey questions
  useEffect(() => {
    if (!classId) return;

    fetch(`/api/survey/${classId}`)
      .then(res => res.json())
      .then(data => setQuestions(data?.questions || []));
  }, [classId]);

  const handleAnswer = (value: string) => {
    const questionId = questions[current].id || questions[current].questionId;
    if (questionId) {
      setAnswers(prev => ({ ...prev, [questionId]: value }));
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

    console.log("survey response", await res.json());

    if (res.ok) {
      toast("Survey submitted", { description: "Thanks for your answers!" });
      setState("submitted");
    } else {
      toast("Error", { description: "Submission failed" });
    }
  };

  // UI states
  if (state === "intro") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-6">
        <div className="text-center max-w-2xl">
          <h1 className="text-4xl font-bold text-slate-800 mb-4">Welcome to Your Class!</h1>
          <p className="text-xl text-slate-600 mb-8">
            Let’s start with a short survey so we can customize your learning path.
          </p>
          <Button
            onClick={() => setState("survey")}
            className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-all duration-300 hover:scale-105"
          >
            Start Survey
          </Button>
        </div>
      </div>
    );
  }

  if (state === "submitted") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-purple-50 p-6">
        <Card className="text-center max-w-xl w-full">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-slate-800 mb-2">Thank You!</CardTitle>
            <p className="text-slate-600">Your answers have been recorded. Your personalized path is on the way 🚀</p>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push(`/class/${classId}`)} className="mt-6">
              Go to Class
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col items-center justify-center p-6">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl text-slate-800 mb-2">{q?.text}</CardTitle>
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
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
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
                        ? "border-indigo-500 bg-indigo-500 text-white"
                        : "border-slate-300 hover:border-indigo-400 hover:bg-indigo-50"
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
                Click to select your preference
              </div>
              <div className="space-y-2">
                {q.options?.map((opt, index) => (
                  <label
                    key={index}
                    className={`block border p-3 rounded-lg cursor-pointer ${
                      questionId && answers[questionId] === opt
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
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

          <div className="flex justify-between mt-6">
            <Button
              variant="outline"
              onClick={() => setCurrent((c) => c - 1)}
              disabled={current === 0}
            >
              Back
            </Button>

            {current < questions.length - 1 ? (
              <Button
                onClick={() => setCurrent((c) => c + 1)}
                disabled={!questionId || !answers[questionId]}
              >
                Next
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={!questionId || !answers[questionId]}>
                Submit Survey
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}