// Import Question type for use in this file
import type { Question } from '@/lib/types/quizzes';

// Re-export types from lib/types/quizzes for backward compatibility
export type {
  QuizStatus,
  QuestionType,
  Question,
  Quiz,
  RichTextContent,
  QuestionOption as AnswerOption,
  QuestionOptionInput,
} from '@/lib/types/quizzes';

export type SaveStatus = 'unsaved' | 'saving' | 'saved';

export type Student = {
  id: string;
  name: string;
  email: string;
  submittedAt?: Date | null;
  score?: number | null;
  status: 'submitted' | 'in-progress' | 'not-started';
  responseId?: string | null;
};

export type StudentQuizAnswer = {
  id: string;
  questionId: string;
  question: Question;
  answerText: string | null;
  optionId: string | null;
  isCorrect: boolean | null;
};

export type StudentQuizResponse = {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  score: number | null;
  submittedAt: Date | string;
  answers: StudentQuizAnswer[];
};

