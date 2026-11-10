interface QuizQuestion {
  question: string;
  answer: string;
  options?: string[];
}

export async function generateFlashcards(nodeId: string, nodeTitle: string, markdownContent: string, quizQuestions?: QuizQuestion[]) {
  const prompt = `You are QuizletGPT. Create 8 flash cards covering the following lesson. 
  
  Lesson Title: ${nodeTitle}
  Content: ${markdownContent}
  
  ${quizQuestions ? `Quiz Questions for reference: ${JSON.stringify(quizQuestions)}` : ''}
  
  Create a mix of concept cards and quiz preparation cards. Respond in pure JSON format:
  [
    {
      "question": "What is the main focus of this lesson?",
      "answer": "Understanding and applying the core concepts...",
      "hint": "Think about the primary learning objective",
      "tags": ["concept", "basics"],
      "type": "concept"
    },
    {
      "question": "Quiz-style question based on content",
      "answer": "Correct answer",
      "hint": "This question will appear in the quiz",
      "tags": ["quiz", "assessment"],
      "type": "quiz"
    }
  ]`;

  const response = await fetch('/api/flashcard/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      nodeId,
      nodeTitle, 
      markdownContent, 
      quizQuestions,
      prompt 
    }),
  });

  if (!response.ok) {
    throw new Error('Flashcard generation failed');
  }

  return response.json();
} 