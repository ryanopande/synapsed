// Flashcard generation: asks Gemini for a deck of cards for a lesson, with a
// content-based fallback deck when the AI call fails.
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { GEMINI_MODEL } from "@/lib/ai/gemini";

/** Asks Gemini for flashcards and returns them as a JSON array string. Throws on failure. */
export async function requestAiFlashcards(nodeTitle: string, markdownContent: string): Promise<string> {
  const prompt = `You are an expert educational content creator specializing in creating engaging flashcards for students. 

Create 15-20 high-quality flashcards based on the following lesson content. The flashcards should be diverse, engaging, and cover different aspects of the material.

Lesson Title: ${nodeTitle}
Lesson Content:
${markdownContent}

Requirements:
1. Create 15-20 flashcards total
2. Mix of concept cards (60%) and quiz-style cards (40%)
3. Each card should have:
   - A clear, specific question
   - A comprehensive but concise answer
   - A helpful hint (optional but encouraged)
   - Relevant tags
   - Type: either "concept" or "quiz"

4. Concept cards should focus on:
   - Key definitions and terms
   - Important principles and concepts
   - Core ideas and theories
   - Fundamental relationships

5. Quiz cards should focus on:
   - Application scenarios
   - Problem-solving situations
   - Comparative analysis
   - Practical implications

6. Questions should be:
   - Specific and focused
   - Engaging and thought-provoking
   - Appropriate for college-level students
   - Varied in difficulty

7. Answers should be:
   - Accurate and comprehensive
   - Clear and well-structured
   - Educational and informative
   - 2-4 sentences maximum

Respond ONLY with valid JSON in this exact format (no markdown formatting, no code blocks):
[
  {
"question": "Specific question about the content",
"answer": "Clear, comprehensive answer",
"hint": "Optional helpful hint",
"tags": ["relevant", "tags"],
"type": "concept"
  }
]`;

  const model = new ChatGoogleGenerativeAI({
    model: GEMINI_MODEL,
    maxOutputTokens: 4000,
    temperature: 0.7,
    apiKey: process.env.GEMINI_API_KEY,
  });

  const response = await model.invoke([{ role: "human", content: prompt }]);

  // Strip markdown code fences if the model added them
  let cleanResponse = (response.content as string).trim();
  if (cleanResponse.startsWith("```json")) {
    cleanResponse = cleanResponse.replace(/^```json\n/, "").replace(/\n```$/, "");
  } else if (cleanResponse.startsWith("```")) {
    cleanResponse = cleanResponse.replace(/^```\n/, "").replace(/\n```$/, "");
  }

  JSON.parse(cleanResponse); // throws if the model did not return valid JSON
  return cleanResponse;
}

/** Flashcards for a lesson as a JSON array string; falls back to a generic deck if the AI call fails. */
export async function callGemini(nodeTitle: string, markdownContent: string): Promise<string> {
  try {
    return await requestAiFlashcards(nodeTitle, markdownContent);
  } catch (error) {
    console.error('Gemini API error:', error);
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