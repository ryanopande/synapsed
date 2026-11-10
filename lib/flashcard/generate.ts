// Flashcard generation helper functions

// Real Gemini client function for dynamic flashcard generation
export async function callGemini(nodeTitle: string, markdownContent: string): Promise<string> {
  try {
    const response = await fetch('/api/flashcard/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeTitle, markdownContent }),
    });

    if (!response.ok) {
      throw new Error(`AI API request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.content;
  } catch (error) {
    console.error('Gemini API error:', error);
    // Fallback to a more robust mock response based on content
    return generateFallbackCards(nodeTitle, markdownContent);
  }
}

// Fallback function for when AI is unavailable
export function generateFallbackCards(nodeTitle: string, markdownContent: string): string {
  const content = markdownContent.toLowerCase();
  
  // Extract key concepts from content
  const concepts = extractKeyConcepts(content, nodeTitle);
  
  const cards = [
    {
      question: `What is the main topic of "${nodeTitle}"?`,
      answer: `The main topic is ${nodeTitle}, which covers fundamental concepts and principles in this subject area.`,
      hint: "Look at the lesson title and introduction",
      tags: ["concept", "basics"],
      type: "concept"
    },
    {
      question: "What are the key learning objectives of this lesson?",
      answer: "The key objectives include understanding core concepts, applying theoretical knowledge to practical scenarios, and developing critical thinking skills.",
      hint: "Consider what you should be able to do after this lesson",
      tags: ["concept", "objectives"],
      type: "concept"
    }
  ];

  // Add content-specific cards based on detected concepts
  concepts.forEach((concept, index) => {
    cards.push({
      question: concept.question,
      answer: concept.answer,
      hint: concept.hint,
      tags: concept.tags,
      type: index % 2 === 0 ? "concept" : "quiz"
    });
  });

  // Add quiz-style application cards
  const applicationCards = [
    {
      question: "How would you apply the concepts from this lesson in a real-world scenario?",
      answer: "You would apply these concepts by connecting theoretical knowledge to practical situations, analyzing problems systematically, and using the learned principles to develop solutions.",
      hint: "Think about practical applications and problem-solving",
      tags: ["quiz", "application"],
      type: "quiz"
    },
    {
      question: "What are the practical implications of understanding this topic?",
      answer: "Understanding this topic enables you to make informed decisions, solve complex problems, and apply theoretical knowledge to real-world situations effectively.",
      hint: "Consider how this knowledge can be used in practice",
      tags: ["quiz", "implications"],
      type: "quiz"
    },
    {
      question: "How does this lesson connect to other subjects or topics?",
      answer: "This lesson builds upon foundational knowledge and creates connections to related subjects, providing a comprehensive understanding of the broader field.",
      hint: "Think about interdisciplinary connections",
      tags: ["quiz", "connections"],
      type: "quiz"
    }
  ];

  cards.push(...applicationCards);

  return JSON.stringify(cards.slice(0, 15));
}

// Helper function to extract meaningful concepts from content
function extractKeyConcepts(content: string, title: string): Array<{question: string, answer: string, hint: string, tags: string[]}> {
  const concepts: Array<{question: string, answer: string, hint: string, tags: string[]}> = [];
  
  // Extract key terms and create meaningful questions
  const keyTerms = extractKeyTerms(content);
  
  // Create concept-specific cards based on content analysis
  if (content.includes('process')) {
    concepts.push({
      question: "What is process management and why is it important?",
      answer: "Process management involves creating, scheduling, and terminating processes. It's crucial for efficient resource utilization and system performance.",
      hint: "Look for information about how the system handles multiple tasks",
      tags: ["concept", "process-management"]
    });
  }
  
  if (content.includes('memory')) {
    concepts.push({
      question: "What is memory management and what does it do?",
      answer: "Memory management allocates and deallocates memory space as needed by programs, ensuring efficient use of system resources.",
      hint: "Think about how the system handles storage and retrieval",
      tags: ["concept", "memory-management"]
    });
  }
  
  if (content.includes('file')) {
    concepts.push({
      question: "What is file system management and its purpose?",
      answer: "File system management provides a way to store, retrieve, and manage files on storage devices, organizing data efficiently.",
      hint: "Consider how data is organized and accessed",
      tags: ["concept", "file-system"]
    });
  }
  
  if (content.includes('device')) {
    concepts.push({
      question: "What is device management and why is it necessary?",
      answer: "Device management controls and coordinates hardware devices and their drivers, ensuring proper communication between software and hardware.",
      hint: "Think about how the system interacts with physical components",
      tags: ["concept", "device-management"]
    });
  }
  
  if (content.includes('multi')) {
    concepts.push({
      question: "What is the difference between single-user and multi-user systems?",
      answer: "Single-user systems serve one user at a time, while multi-user systems allow multiple users to access the computer simultaneously.",
      hint: "Compare the user access patterns",
      tags: ["quiz", "system-types"]
    });
  }
  
  if (content.includes('real-time')) {
    concepts.push({
      question: "What are real-time operating systems and when are they used?",
      answer: "Real-time operating systems process data as it comes in within strict time constraints, used in critical applications like medical devices and industrial control.",
      hint: "Consider timing requirements and critical applications",
      tags: ["quiz", "real-time"]
    });
  }
  
  // Add generic concept cards for remaining key terms
  keyTerms.slice(0, 5).forEach(term => {
    if (!concepts.some(c => c.question.includes(term))) {
      concepts.push({
        question: `What is ${term} and how does it relate to ${title}?`,
        answer: `${term} is an important concept in ${title} that contributes to understanding the overall system and its functionality.`,
        hint: "Look for definitions and explanations in the content",
        tags: ["concept", term.replace(/\s+/g, '-')]
      });
    }
  });
  
  return concepts;
}

// Helper function to extract key terms from content
function extractKeyTerms(content: string): string[] {
  const words = content
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 4 && !['about', 'with', 'from', 'this', 'that', 'they', 'have', 'been', 'will', 'would', 'could', 'should'].includes(word))
    .slice(0, 10);
  
  return [...new Set(words)];
} 