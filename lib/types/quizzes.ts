import { PartialBlock } from "@blocknote/core";

/**
 * Quiz and Assessment Type Definitions
 */

// BlockNote content type
export type RichTextContent = PartialBlock[] | null | undefined;

// Question Type
export type QuestionType = 'multiple-choice' | 'short-answer' | 'true-false';

// Question and Option Types
export interface QuestionOptionInput {
  text: string;
  isCorrect: boolean;
  order?: number;
}

export interface QuestionOption extends QuestionOptionInput {
  id: string;
}

export interface QuestionInput {
  text: string;
  richTextContent?: RichTextContent;
  type: 'multiple-choice' | 'short-answer' | 'true-false' | 'MULTIPLE_CHOICE' | 'SHORT_ANSWER' | 'TRUE_FALSE';
  imageUrl?: string | null;
  order?: number;
  options?: QuestionOptionInput[];
}

export interface Question extends Omit<QuestionInput, 'type' | 'options'> {
  id: string;
  type: 'multiple-choice' | 'short-answer' | 'true-false';
  options: QuestionOption[];
  hasError?: boolean;
}

// Quiz Types
export type QuizStatus = 'draft' | 'published' | 'archived' | 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface QuizInput {
  title: string;
  description?: string | null;
  status?: QuizStatus;
  dueDate?: string | Date | null;
  questions?: QuestionInput[];
}

export interface Quiz {
  id: string;
  title: string;
  description?: string | null;
  status: QuizStatus;
  createdAt: Date | string;
  updatedAt?: Date | string;
  publishedAt?: Date | string | null;
  dueDate?: Date | string | null;
  submissions?: number;
  totalStudents?: number;
  gradeAverage?: number;
  questions?: Question[];
  totalQuestions?: number;
}

// API Request/Response Types
export interface CreateQuestionRequest {
  text: string;
  richTextContent?: RichTextContent;
  type: string;
  imageUrl?: string | null;
  order?: number;
  options?: QuestionOptionInput[];
}

export interface UpdateQuestionRequest extends Partial<CreateQuestionRequest> {
  id?: string;
}

export interface CreateQuizRequest {
  title: string;
  description?: string | null;
  questions?: QuestionInput[];
}

export interface UpdateQuizRequest {
  title?: string;
  description?: string | null;
  status?: QuizStatus;
  questions?: QuestionInput[];
}

export interface PublishQuizRequest {
  action: 'publish' | 'archive';
  dueDate?: string | null;
}

export interface QuizSubmitRequest {
  studentId: string;
  classId: string;
  answers: Array<{
    questionId: string;
    answerText: string;
  }>;
}

export interface QuizSubmitResponse {
  success: boolean;
  responseId: string;
  score: number;
  totalQuestions: number;
  correctCount: number;
}

// OCR Types
export interface OCRQuestionOption {
  text: string;
  isCorrect: boolean;
}

export interface OCRQuestion {
  text: string;
  type: 'multiple-choice' | 'short-answer' | 'true-false';
  options?: OCRQuestionOption[];
}

export interface OCRResponse {
  success: boolean;
  questions: Array<{
    id: string;
    text: string;
    type: string;
    options: Array<{
      id: string;
      text: string;
      isCorrect: boolean;
    }>;
    order: number;
  }>;
  pagesProcessed: number;
}

// Student Quiz Types
export interface StudentQuiz {
  id: string;
  title: string;
  description?: string | null;
  totalQuestions: number;
  dueDate?: Date | string | null;
  status: 'not-started' | 'in-progress' | 'completed';
  score?: number | null;
  submittedAt?: Date | string | null;
  isOverdue?: boolean;
  classId?: string;
  className?: string;
}

export interface StudentQuizListResponse {
  quizzes: StudentQuiz[];
}

export interface StudentQuizResponse {
  quiz: {
    id: string;
    title: string;
    description?: string | null;
    dueDate?: Date | string | null;
    questions: Question[];
    hasSubmitted: boolean;
  };
}

// Professor Quiz Types
export interface ProfessorQuizListResponse {
  quizzes: Array<{
    id: string;
    title: string;
    description?: string | null;
    status: QuizStatus;
    createdAt: Date | string;
    updatedAt?: Date | string;
    submissions: number;
    totalStudents: number;
    totalQuestions: number;
    gradeAverage?: number;
  }>;
}

export interface ProfessorQuizResponse {
  quiz: Quiz;
}

