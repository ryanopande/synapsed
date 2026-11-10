"use client";

import { QuizDashboard } from "./QuizDashboard";
import { QuizBuilder } from "./QuizBuilder";
import { useState } from "react";

interface ProfessorQuizResultsProps {
  classId: string;
}

export function ProfessorQuizResults({ classId }: ProfessorQuizResultsProps) {
  const [currentView, setCurrentView] = useState<'dashboard' | 'builder'>('dashboard');
  const [editingQuizId, setEditingQuizId] = useState<string | null>(null);

  const handleCreateQuiz = () => {
    setEditingQuizId(null);
    setCurrentView('builder');
  };

  const handleEditQuiz = (quizId: string) => {
    setEditingQuizId(quizId);
    setCurrentView('builder');
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
    setEditingQuizId(null);
  };

  if (currentView === 'builder') {
    return (
      <QuizBuilder 
        quizId={editingQuizId || undefined} 
        classId={classId}
        onBack={handleBackToDashboard} 
      />
    );
  }

  return (
    <QuizDashboard
      classId={classId}
      onCreateQuiz={handleCreateQuiz}
      onEditQuiz={handleEditQuiz}
    />
  );
}

