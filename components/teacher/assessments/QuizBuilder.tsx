"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { QuizNavigation } from './QuizNavigation';
import { QuestionEditor } from './QuestionEditor';
import { OCRImportModal } from './OCRImportModal';
import { PublishQuizDialog } from './PublishQuizDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Question, SaveStatus } from './types';
import { AlertCircle, Check, Save, ArrowLeft, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { Question as QuestionType } from '@/lib/types/quizzes';

interface QuizBuilderProps {
  quizId?: string;
  classId: string;
  onBack?: () => void;
}

export function QuizBuilder({ 
  quizId, 
  classId, 
  onBack 
}: QuizBuilderProps) {
  // classId is used in API calls, keeping it for future use
  void classId;
  const [quizName, setQuizName] = useState('Untitled Quiz');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>('');
  const [showOCRModal, setShowOCRModal] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [isLoading, setIsLoading] = useState(false);
  const [currentQuizId, setCurrentQuizId] = useState<string | undefined>(quizId);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasInitialSaveRef = useRef(false);
  
  // Update selected question when questions change
  useEffect(() => {
    if (questions.length > 0) {
      if (!selectedQuestionId || !questions.find(q => q.id === selectedQuestionId)) {
        setSelectedQuestionId(questions[0].id);
      }
    } else {
      setSelectedQuestionId('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions]);

  // Load quiz data if quizId is provided
  useEffect(() => {
    const loadQuiz = async () => {
      if (!quizId) return;
      
      setIsLoading(true);
      try {
        const response = await fetch(`/api/professor/quiz/${quizId}`);
        if (!response.ok) {
          throw new Error('Failed to load quiz');
        }
        
        const data = await response.json();
        const quiz = data.quiz;
        
        setQuizName(quiz.title || 'Untitled Quiz');
        setCurrentQuizId(quiz.id);
        
        // Transform questions from API format to frontend format
        const transformedQuestions: Question[] = (quiz.questions || []).map((q: QuestionType) => ({
          id: q.id,
          text: q.text || '',
          richTextContent: q.richTextContent,
          type: (typeof q.type === 'string' && q.type.includes('_') 
            ? q.type.toLowerCase().replace('_', '-') 
            : q.type) as 'multiple-choice' | 'short-answer' | 'true-false',
          imageUrl: q.imageUrl || undefined,
          order: q.order || 0,
          options: (q.options || []).map((opt) => ({
            id: opt.id,
            text: opt.text || '',
            isCorrect: opt.isCorrect || false,
            order: opt.order || 0,
          })),
        }));
        
        setQuestions(transformedQuestions);
        setSaveStatus('saved');
      } catch (error) {
        console.error('Error loading quiz:', error);
        toast.error('Failed to load quiz');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadQuiz();
  }, [quizId]);

  const handleQuizNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuizName(e.target.value);
    setSaveStatus('unsaved');
  };

  const handleAddQuestion = () => {
    const timestamp = Date.now();
    const newQuestion: Question = {
      id: timestamp.toString(),
      text: 'New Question',
      type: 'multiple-choice',
      options: [
        { id: `${timestamp}-1`, text: 'Option 1', isCorrect: false },
        { id: `${timestamp}-2`, text: 'Option 2', isCorrect: false },
      ],
      order: questions.length + 1,
    };
    setQuestions([...questions, newQuestion]);
    setSelectedQuestionId(newQuestion.id);
    setSaveStatus('unsaved');
  };

  const handleUpdateQuestion = (updatedQuestion: Question) => {
    setQuestions(
      questions.map((q) => (q.id === updatedQuestion.id ? updatedQuestion : q)),
    );
    setSaveStatus('unsaved');
  };

  const handleReorderQuestions = (reorderedQuestions: Question[]) => {
    setQuestions(reorderedQuestions);
    setSaveStatus('unsaved');
  };

  const handleSave = async (isAutoSave = false) => {
    // For auto-save, skip validation if quiz doesn't have a title yet
    if (!isAutoSave) {
      if (!quizName.trim()) {
        toast.error('Please provide a quiz title');
        return;
      }

      if (questions.length === 0) {
        toast.error('Please add at least one question');
        return;
      }

      // Validate questions
      for (const q of questions) {
        if (!q.text.trim()) {
          toast.error('All questions must have text');
          return;
        }
        if ((q.type === 'multiple-choice' || q.type === 'true-false') && q.options.length < 2) {
          toast.error(`Question "${q.text}" needs at least 2 options`);
          return;
        }
        if ((q.type === 'multiple-choice' || q.type === 'true-false') && !q.options.some((opt) => opt.isCorrect)) {
          toast.error(`Question "${q.text}" needs at least one correct answer`);
          return;
        }
      }
    }

    // For auto-save, skip if no title and no questions
    if (isAutoSave && !quizName.trim() && questions.length === 0) {
      return;
    }

    // For auto-save, use a default title if empty
    const titleToSave = quizName.trim() || 'Untitled Quiz';

    if (isAutoSave) {
      setIsAutoSaving(true);
    } else {
      setSaveStatus('saving');
    }
    
    try {
      // Transform questions to API format
      const questionsForApi = questions.map((q) => ({
        text: q.text,
        richTextContent: q.richTextContent || null, // Ensure BlockNote JSON is included
        type: q.type,
        imageUrl: q.imageUrl,
        order: q.order || 0,
        options: q.options.map((opt) => ({
          text: opt.text,
          isCorrect: opt.isCorrect,
          order: opt.order || 0,
        })),
      }));

      let response;
      if (currentQuizId) {
        // Update existing quiz
        response = await fetch(`/api/professor/quiz/${currentQuizId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: titleToSave,
            questions: questionsForApi,
          }),
        });
      } else {
        // Create new quiz
        response = await fetch(`/api/professor/quizzes/${classId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: titleToSave,
            questions: questionsForApi,
          }),
        });
      }

      if (!response.ok) {
        let errorMessage = 'Failed to save quiz';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If response is not valid JSON, use status text
          errorMessage = response.statusText || `Server error (${response.status})`;
        }
        throw new Error(errorMessage);
      }

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error('Invalid response from server');
      }
      
      // If this was a new quiz, update the quizId
      if (!currentQuizId && data.quiz?.id) {
        setCurrentQuizId(data.quiz.id);
        hasInitialSaveRef.current = true;
      }

      setSaveStatus('saved');
      if (!isAutoSave) {
        toast.success('Quiz saved successfully');
      }
    } catch (error) {
      console.error('Error saving quiz:', error);
      if (!isAutoSave) {
        toast.error(error instanceof Error ? error.message : 'Failed to save quiz');
      }
      setSaveStatus('unsaved');
    } finally {
      if (isAutoSave) {
        setIsAutoSaving(false);
      }
    }
  };

  // Auto-save effect - triggers when quizName or questions change
  useEffect(() => {
    // Don't auto-save on initial load
    if (!hasInitialSaveRef.current && !currentQuizId) {
      // Auto-create quiz when user first makes a change
      if (quizName.trim() || questions.length > 0) {
        hasInitialSaveRef.current = true;
        // Set status to unsaved
        setSaveStatus('unsaved');
        // Clear existing timeout
        if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current);
        }
        // Set new timeout for auto-save (2 seconds delay)
        autoSaveTimeoutRef.current = setTimeout(() => {
          handleSave(true);
        }, 2000);
      }
      return;
    }

    // Skip auto-save if currently saving manually
    if (saveStatus === 'saving') {
      return;
    }

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set status to unsaved
    if (saveStatus === 'saved') {
      setSaveStatus('unsaved');
    }

    // Set new timeout for auto-save (2 seconds delay)
    autoSaveTimeoutRef.current = setTimeout(() => {
      handleSave(true);
    }, 2000);

    // Cleanup timeout on unmount or when dependencies change
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizName, questions]);

  const handlePublishClick = async () => {
    // First save the quiz
    await handleSave();
    
    // Wait a bit for save to complete
    if (saveStatus === 'saving') {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (!currentQuizId) {
      toast.error('Please save the quiz first');
      return;
    }

    // Show publish dialog
    setShowPublishDialog(true);
  };

  const handlePublish = async (dueDate: Date | undefined) => {
    if (!currentQuizId) {
      toast.error('Please save the quiz first');
      return;
    }

    setIsPublishing(true);
    try {
      const response = await fetch(`/api/professor/quiz/${currentQuizId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'publish',
          dueDate: dueDate ? dueDate.toISOString() : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to publish quiz');
      }

      toast.success('Quiz published successfully');
      setShowPublishDialog(false);
    } catch (error) {
      console.error('Error publishing quiz:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to publish quiz');
    } finally {
      setIsPublishing(false);
    }
  };

  const handlePreview = () => {
    // Navigate to preview page
    if (currentQuizId) {
      window.open(`/teacher/assessments/${currentQuizId}/preview`, '_blank');
    } else {
      // For new quizzes, show a message
      toast.info('Please save the quiz first before previewing');
    }
  };

  const selectedQuestion = useMemo(
    () => questions.find((q) => q.id === selectedQuestionId),
    [questions, selectedQuestionId]
  );

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-500">Loading quiz...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full">
      {/* Header */}
      <div className="glass rounded-2xl mx-4 my-4 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <Input
            type="text"
            value={quizName}
            onChange={handleQuizNameChange}
            className="text-xl font-semibold bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded px-2 py-1 w-auto min-w-[200px]"
            placeholder="Quiz Title"
          />
          <div className="flex items-center text-sm">
            {saveStatus === 'unsaved' && !isAutoSaving && (
              <span className="text-amber-500 flex items-center">
                <AlertCircle size={16} className="mr-1" /> Unsaved changes
              </span>
            )}
            {(saveStatus === 'saving' || isAutoSaving) && (
              <span className="text-blue-500 flex items-center">
                <svg
                  className="animate-spin h-4 w-4 mr-1"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                {isAutoSaving ? 'Auto-saving...' : 'Saving...'}
              </span>
            )}
            {saveStatus === 'saved' && !isAutoSaving && (
              <span className="text-emerald-500 flex items-center">
                <Check size={16} className="mr-1" /> All changes saved
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            variant="secondary"
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            onClick={handlePreview}
          >
            <Eye size={16} className="mr-2" />
            Preview as Student
          </Button>
          <Button variant="secondary" onClick={() => setShowOCRModal(true)}>
            Import via OCR
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleSave(false)}
            disabled={saveStatus === 'saved' || saveStatus === 'saving'}
          >
            <Save size={16} className="mr-2" />
            Save
          </Button>
          <Button variant="default" onClick={handlePublishClick}>
            Publish
          </Button>
          <PublishQuizDialog
            open={showPublishDialog}
            onOpenChange={setShowPublishDialog}
            onPublish={handlePublish}
            isLoading={isPublishing}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 pb-6 flex h-[calc(100vh-120px)]">
        <div className="grid grid-cols-12 gap-6 w-full max-w-full">
          {/* Quiz Navigation (Left Panel) */}
          <div className="col-span-4">
            <QuizNavigation
              questions={questions}
              selectedQuestionId={selectedQuestionId}
              onSelectQuestion={setSelectedQuestionId}
              onAddQuestion={handleAddQuestion}
              onReorderQuestions={handleReorderQuestions}
            />
          </div>

          {/* Question Editor (Right Panel) */}
          <div className="col-span-8">
            {selectedQuestion ? (
              <QuestionEditor
                question={selectedQuestion}
                onUpdateQuestion={handleUpdateQuestion}
                quizId={currentQuizId}
              />
            ) : (
              <div className="glass rounded-2xl p-12 flex items-center justify-center h-full">
                <div className="text-center">
                  <p className="text-slate-500 mb-4">
                    {questions.length === 0 
                      ? 'No questions yet. Click "Add Question" to get started.'
                      : 'Select a question to edit'}
                  </p>
                  {questions.length === 0 && (
                    <Button onClick={handleAddQuestion} variant="default">
                      Add Your First Question
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* OCR Import Modal */}
      <OCRImportModal
        open={showOCRModal}
        onClose={() => setShowOCRModal(false)}
        onImport={(importedQuestions) => {
          setQuestions([...questions, ...importedQuestions]);
          setShowOCRModal(false);
          setSaveStatus('unsaved');
        }}
      />
    </div>
  );
}

