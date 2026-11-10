import { Mistral } from '@mistralai/mistralai';

import { GoogleGenAI, Type } from '@google/genai';
import { GEMINI_MODEL } from '@/lib/gemini-model';

const mistralClient = new Mistral({ apiKey: process.env.MISTRAL_API_KEY! });
const geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface SyllabusContent {
  learningObjectives: string;
  courseSchedule: string;
  assessmentMethods: string;
  prerequisites: string;
  courseDescription: string;
  instructorInfo: string;
  gradingPolicy: string;
}

export interface ProcessingResult {
  success: boolean;
  content?: SyllabusContent;
  error?: string;
  processingTime?: number;
  confidence?: number;
}

/**
 * Process syllabus directly from R2 URL without downloading
 */
export async function processSyllabusFromUrl(
  fileUrl: string, 
  fileName: string,
  retryCount: number = 3
): Promise<ProcessingResult> {
  const startTime = Date.now();
  
  try {
    console.log(`🔄 Processing syllabus: ${fileName}`);
    
    // Step 1: Direct OCR processing from R2 URL
    const ocrResult = await processWithRetry(
      () => mistralClient.ocr.process({
        model: 'mistral-ocr-latest',
        document: {
          type: 'document_url',
          documentUrl: fileUrl,
        },
      }),
      retryCount
    );

    if (!ocrResult.pages || ocrResult.pages.length === 0) {
      throw new Error('No content extracted from document');
    }

    // Step 2: Combine all pages into single text
    const fullText = ocrResult.pages
      .map((page, index) => `--- Page ${(page.index ?? index) + 1} ---\n${page.markdown}`)
      .join('\n\n');

    console.log(`📄 Extracted ${ocrResult.pages.length} pages, ${fullText.length} characters`);

    // Step 3: AI-powered content parsing
    const parsedContent = await parseSyllabusWithAI(fullText);
    
    const processingTime = Date.now() - startTime;
    //console.log(`✅ Syllabus processed in ${processingTime}ms`);

    return {
      success: true,
      content: parsedContent,
      processingTime,
      confidence: calculateConfidence(parsedContent),
    };

  } catch (error) {
    console.error(`❌ Syllabus processing failed for ${fileName}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTime: Date.now() - startTime,
    };
  }
}

/**
 * AI-powered syllabus content parsing using Gemini
 */
async function parseSyllabusWithAI(text: string): Promise<SyllabusContent> {
  try {
    const extractSyllabusFunction = {
      name: "extractSyllabusContent",
      description: "Extract structured content from a course syllabus",
      parameters: {
        type: Type.OBJECT,
        properties: {
          learningObjectives: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "List of course learning objectives/outcomes (CLOs) also called PLOs"
          },
          courseSchedule: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                week: { type: Type.STRING },
                date: { type: Type.STRING },
                day: { type: Type.STRING },
                topic: { type: Type.STRING },
                reading: { type: Type.STRING }
              }
            },
            description: "Course schedule with topics, dates, and readings"
          },
          assessmentMethods: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Grading methods, assignments, exams, etc."
          },
          prerequisites: {
            type: Type.STRING,
            description: "Required prerequisites or recommended background"
          },
          courseDescription: {
            type: Type.STRING,
            description: "Course description and overview"
          },
          instructorInfo: {
            type: Type.OBJECT,
            description: "Instructor contact information and office hours"
          },
          gradingPolicy: {
            type: Type.OBJECT,
            description: "Grading scale, policies, and procedures"
          }
        },
        required: ["learningObjectives", "courseSchedule", "assessmentMethods", "prerequisites", "courseDescription"]
      }
    };

    const response = await geminiClient.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Analyze this course syllabus and extract the structured information. Focus on accuracy and completeness.

Syllabus text:
${text}`,
      config: {
        tools: [{
          functionDeclarations: [extractSyllabusFunction]
        }]
      }
    });
    
    // Check if function was called
    if (response.functionCalls && response.functionCalls.length > 0) {
      const functionCall = response.functionCalls[0];
      if (functionCall.name === 'extractSyllabusContent') {
        const extractedContent = functionCall.args;
        
        console.log('✅ Function calling successful');
        console.log('📊 Extracted content keys:', Object.keys(extractedContent || {}));
        
        // Validate and clean the extracted content
        const validatedContent = {
          learningObjectives: Array.isArray(extractedContent?.learningObjectives) 
            ? extractedContent.learningObjectives.join('\n')
            : "No learning objectives specified",
          courseSchedule: Array.isArray(extractedContent?.courseSchedule) 
            ? JSON.stringify(extractedContent.courseSchedule)
            : "No schedule specified",
          assessmentMethods: Array.isArray(extractedContent?.assessmentMethods) 
            ? extractedContent.assessmentMethods.join('\n')
            : "No assessment methods specified",
          prerequisites: extractedContent?.prerequisites || "No prerequisites specified",
          courseDescription: extractedContent?.courseDescription || "No description available",
          instructorInfo: typeof extractedContent?.instructorInfo === 'object'
            ? JSON.stringify(extractedContent.instructorInfo)
            : extractedContent?.instructorInfo || "No instructor info specified",
          gradingPolicy: typeof extractedContent?.gradingPolicy === 'object'
            ? JSON.stringify(extractedContent.gradingPolicy)
            : extractedContent?.gradingPolicy || "No grading policy specified"
        };

        return validatedContent as SyllabusContent;
      }
    }

    // Fallback if function calling fails
    console.warn('⚠️ Function calling failed, falling back to text parsing');
    return fallbackParsing(text);

  } catch (error) {
    console.error('Function calling failed, falling back to simple parsing:', error);
    return fallbackParsing(text);
  }
}

/**
 * Fallback parsing method using simple text analysis
 */
function fallbackParsing(text: string): SyllabusContent {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  let learningObjectives = "";
  let courseSchedule = "";
  let assessmentMethods = "";
  let prerequisites = "";
  let courseDescription = "";
  let instructorInfo = "";
  const gradingPolicy = "";
  
  let currentSection = "";
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    
    // Detect section headers
    if (line.includes('learning objectives') || line.includes('course outcomes')) {
      currentSection = 'objectives';
      continue;
    }
    if (line.includes('course schedule') || line.includes('tentative breakdown')) {
      currentSection = 'schedule';
      continue;
    }
    if (line.includes('assessment') || line.includes('grading') || line.includes('assignments')) {
      currentSection = 'assessment';
      continue;
    }
    if (line.includes('prerequisites') || line.includes('required background')) {
      currentSection = 'prerequisites';
      continue;
    }
    if (line.includes('course description') || line.includes('overview')) {
      currentSection = 'description';
      continue;
    }
    if (line.includes('instructor') || line.includes('professor') || line.includes('contact')) {
      currentSection = 'instructor';
      continue;
    }
    
    // Add content to appropriate section
    if (currentSection === 'objectives' && lines[i].length > 10) {
      learningObjectives += lines[i] + '\n';
    }
    if (currentSection === 'schedule' && lines[i].length > 5) {
      courseSchedule += lines[i] + '\n';
    }
    if (currentSection === 'assessment' && lines[i].length > 5) {
      assessmentMethods += lines[i] + '\n';
    }
    if (currentSection === 'prerequisites' && lines[i].length > 5) {
      prerequisites += lines[i] + '\n';
    }
    if (currentSection === 'description' && lines[i].length > 10) {
      courseDescription += lines[i] + '\n';
    }
    if (currentSection === 'instructor' && lines[i].length > 5) {
      instructorInfo += lines[i] + '\n';
    }
  }
  
  return {
    learningObjectives: learningObjectives.trim() || 'Not specified',
    courseSchedule: courseSchedule.trim() || 'Not specified',
    assessmentMethods: assessmentMethods.trim() || 'Not specified',
    prerequisites: prerequisites.trim() || 'Not specified',
    courseDescription: courseDescription.trim() || 'Not specified',
    instructorInfo: instructorInfo.trim() || 'Not specified',
    gradingPolicy: gradingPolicy.trim() || 'Not specified',
  };
}

/**
 * Retry logic for API calls
 */
async function processWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.warn(`⚠️ Attempt ${attempt}/${maxRetries} failed:`, error);
      
      if (attempt < maxRetries) {
        const waitTime = delay * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`⏳ Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  throw lastError!;
}

/**
 * Calculate confidence score based on content quality
 */
function calculateConfidence(content: SyllabusContent): number {
  let score = 0;
  //const maxScore = 100;
  
  // Weighted scoring based on field importance and quality
  const fieldWeights = {
    learningObjectives: 25,    // Most important for surveys
    prerequisites: 20,       // Critical for student assessment
    courseDescription: 15,   // Important for context
    assessmentMethods: 15,  // Important for survey questions
    courseSchedule: 10,     // Useful but less critical
    instructorInfo: 10,     // Nice to have
    gradingPolicy: 5        // Least important for surveys
  };
  
  // Check learning objectives quality
  if (content.learningObjectives && content.learningObjectives !== 'No learning objectives specified') {
    const objectives = content.learningObjectives.split('\n').filter(obj => obj.trim().length > 10);
    if (objectives.length >= 3) {
      score += fieldWeights.learningObjectives;
    } else if (objectives.length >= 1) {
      score += fieldWeights.learningObjectives * 0.6;
    }
  }
  
  // Check prerequisites quality
  if (content.prerequisites && content.prerequisites !== 'No prerequisites specified') {
    if (content.prerequisites.length > 50 && !content.prerequisites.includes('Not specified')) {
      score += fieldWeights.prerequisites;
    } else if (content.prerequisites.length > 20) {
      score += fieldWeights.prerequisites * 0.5;
    }
  }
  
  // Check course description quality
  if (content.courseDescription && content.courseDescription !== 'No description available') {
    if (content.courseDescription.length > 100) {
      score += fieldWeights.courseDescription;
    } else if (content.courseDescription.length > 50) {
      score += fieldWeights.courseDescription * 0.7;
    }
  }
  
  // Check assessment methods
  if (content.assessmentMethods && content.assessmentMethods !== 'No assessment methods specified') {
    const methods = content.assessmentMethods.split('\n').filter(method => method.trim().length > 5);
    if (methods.length >= 2) {
      score += fieldWeights.assessmentMethods;
    } else if (methods.length >= 1) {
      score += fieldWeights.assessmentMethods * 0.6;
    }
  }
  
  // Check course schedule
  if (content.courseSchedule && content.courseSchedule !== 'No schedule specified') {
    try {
      const schedule = JSON.parse(content.courseSchedule);
      if (Array.isArray(schedule) && schedule.length >= 5) {
        score += fieldWeights.courseSchedule;
      } else if (schedule.length >= 2) {
        score += fieldWeights.courseSchedule * 0.6;
      }
    } catch {
      // If not JSON, check if it's meaningful text
      if (content.courseSchedule.length > 100) {
        score += fieldWeights.courseSchedule * 0.5;
      }
    }
  }
  
  // Check instructor info
  if (content.instructorInfo && content.instructorInfo !== 'No instructor info specified') {
    try {
      const instructor = JSON.parse(content.instructorInfo);
      if (Object.keys(instructor).length > 0) {
        score += fieldWeights.instructorInfo;
      }
    } catch {
      if (content.instructorInfo.length > 30) {
        score += fieldWeights.instructorInfo * 0.5;
      }
    }
  }
  
  // Check grading policy
  if (content.gradingPolicy && content.gradingPolicy !== 'No grading policy specified') {
    try {
      const policy = JSON.parse(content.gradingPolicy);
      if (Object.keys(policy).length > 0) {
        score += fieldWeights.gradingPolicy;
      }
    } catch {
      if (content.gradingPolicy.length > 30) {
        score += fieldWeights.gradingPolicy * 0.5;
      }
    }
  }
  
  return Math.min(Math.round(score), 100);
}
