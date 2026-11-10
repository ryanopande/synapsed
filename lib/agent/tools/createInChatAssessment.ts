import { DynamicStructuredTool } from "@langchain/core/tools";
import * as z from "zod";
import { GoogleGenAI, Type } from "@google/genai";
import { prisma } from "@/lib/prisma";
import { GEMINI_MODEL } from "@/lib/gemini-model";

export const createInChatAssessment = new DynamicStructuredTool({
  name: "createInChatAssessment",
  description: "Create an in-chat assessment form to evaluate student understanding of a topic. Returns Formedible field configuration with questions, schema, and correct answers.",
  schema: z.object({
    topic: z.string().describe("The topic or concept being assessed"),
    nodeTitle: z.string().optional().describe("The title of the learning node/topic"),
    questionCount: z.number().min(1).max(10).default(3).describe("Number of questions to generate (1-10)"),
    difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("intermediate").describe("Difficulty level of the assessment"),
    conversationId: z.string().optional().describe("The conversation ID to associate this assessment with"),
    classId: z.string().optional().describe("The class ID"),
    lessonId: z.string().optional().describe("The lesson/node ID"),
  }),
  func: async (input) => {
    const { topic, nodeTitle, questionCount, difficulty, conversationId, lessonId } = input as {
      topic: string;
      nodeTitle?: string;
      questionCount: number;
      difficulty: "beginner" | "intermediate" | "advanced";
      conversationId?: string;
      classId?: string;
      lessonId?: string;
    };

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

      // Define function declaration for assessment generation
      const generateAssessmentFunction = {
        name: 'create_in_chat_assessment',
        description: 'Create an in-chat assessment form with Formedible-compatible fields and correct answers',
        parameters: {
          type: Type.OBJECT,
          properties: {
            fields: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { 
                    type: Type.STRING,
                    description: "Unique field name (e.g., 'question1', 'question2')"
                  },
                  type: {
                    type: Type.STRING,
                    enum: ['text', 'textarea', 'select', 'radio', 'multiselect', 'number', 'checkbox'],
                    description: "Field type: 'text' for short answer, 'textarea' for longer explanations, 'select' for dropdown multiple choice, 'radio' for radio button multiple choice, 'multiselect' for multiple selection, 'number' for numeric answers, 'checkbox' for true/false questions"
                  },
                  label: {
                    type: Type.STRING,
                    description: "The question text to display to the student"
                  },
                  placeholder: {
                    type: Type.STRING,
                    description: "Placeholder text for the input"
                  },
                  options: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        value: { type: Type.STRING },
                        label: { type: Type.STRING }
                      },
                      required: ['value', 'label']
                    },
                    description: "Required for 'select', 'radio', and 'multiselect' types. Array of option objects with value and label"
                  },
                  rows: {
                    type: Type.NUMBER,
                    description: "Number of rows for textarea (default: 3-4)"
                  },
                  min: {
                    type: Type.NUMBER,
                    description: "Minimum value for number field"
                  },
                  max: {
                    type: Type.NUMBER,
                    description: "Maximum value for number field"
                  },
                  step: {
                    type: Type.NUMBER,
                    description: "Step value for number field"
                  }
                },
                required: ['name', 'type', 'label']
              }
            },
            correctAnswers: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  fieldName: {
                    type: Type.STRING,
                    description: "The field name this answer corresponds to"
                  },
                  value: {
                    type: Type.STRING,
                    description: "The correct answer value as a string. For numbers, convert to string. For booleans, use 'true' or 'false'. For arrays (multiselect), use JSON array string like '[\"value1\",\"value2\"]'."
                  }
                },
                required: ['fieldName', 'value']
              },
              description: "Array of correct answers, one per field"
            }
          },
          required: ['fields', 'correctAnswers']
        }
      };

      const prompt = `You are creating an in-chat assessment form using Formedible for the topic: "${topic}"${nodeTitle ? ` (Node: ${nodeTitle})` : ""}.

Generate ${questionCount} assessment questions at ${difficulty} difficulty level.

**IMPORTANT - FORMEDIBLE API FORMAT:**

According to Formedible API documentation (https://formedible.dev/docs/api), fields use this structure:

**FIELD TYPES AVAILABLE:**
1. **"text"** - Short answer (single line text input)
2. **"textarea"** - Longer explanations (multi-line text)
3. **"select"** - Dropdown multiple choice (single answer)
4. **"radio"** - Radio button multiple choice (single answer, better UX for assessments)
5. **"multiselect"** - Multiple selection (multiple answers)
6. **"number"** - Numeric answers
7. **"checkbox"** - True/false questions

**EXACT FORMEDIBLE FIELD STRUCTURE:**

For TEXT fields:
{
  "name": "question1",
  "type": "text",
  "label": "What is the capital of France?",
  "placeholder": "Enter your answer..."
}

For TEXTAREA fields (longer answers):
{
  "name": "question2",
  "type": "textarea",
  "label": "Explain the concept of photosynthesis:",
  "placeholder": "Provide a detailed explanation...",
  "rows": 4
}

For SELECT fields (dropdown):
{
  "name": "question3",
  "type": "select",
  "label": "Which of the following is a prime number?",
  "options": [
    { "value": "4", "label": "4" },
    { "value": "5", "label": "5" },
    { "value": "6", "label": "6" },
    { "value": "8", "label": "8" }
  ],
  "placeholder": "Select an option"
}

For RADIO fields (radio buttons - preferred for multiple choice):
{
  "name": "question4",
  "type": "radio",
  "label": "What is 2 + 2?",
  "options": [
    { "value": "3", "label": "3" },
    { "value": "4", "label": "4" },
    { "value": "5", "label": "5" }
  ]
}

For MULTISELECT fields (multiple selection):
{
  "name": "question5",
  "type": "multiselect",
  "label": "Select all programming languages:",
  "options": [
    { "value": "python", "label": "Python" },
    { "value": "java", "label": "Java" },
    { "value": "html", "label": "HTML" },
    { "value": "css", "label": "CSS" }
  ]
}

For NUMBER fields:
{
  "name": "question6",
  "type": "number",
  "label": "What is 15 multiplied by 3?",
  "min": 0,
  "max": 100,
  "step": 1,
  "placeholder": "Enter a number"
}

For CHECKBOX fields (true/false):
{
  "name": "question7",
  "type": "checkbox",
  "label": "JavaScript is a compiled language."
}

**CORRECT ANSWERS FORMAT:**
Return correctAnswers as an array of objects, one per field:
[
  { "fieldName": "question1", "value": "Paris" },
  { "fieldName": "question2", "value": "Photosynthesis is the process..." },
  { "fieldName": "question3", "value": "5" },
  { "fieldName": "question4", "value": "4" },
  { "fieldName": "question5", "value": ["python", "java"] },
  { "fieldName": "question6", "value": 45 },
  { "fieldName": "question7", "value": false }
]

- For "text" fields: Use string value
- For "textarea" fields: Use string value (key phrases or full answer)
- For "select" fields: Use string value (option value)
- For "radio" fields: Use string value (option value)
- For "multiselect" fields: Use array of strings
- For "number" fields: Use number value
- For "checkbox" fields: Use boolean value

**GUIDELINES:**
- **PRIORITIZE GRADABLE QUESTION TYPES**: For grading purposes, prioritize questions that are easy to automatically grade:
  - **PRIMARY**: Use "radio" (multiple choice) for single-answer questions - this is the preferred type for most questions
  - **PRIMARY**: Use "multiselect" for questions where multiple correct answers are possible
  - **SECONDARY**: Use "checkbox" for true/false questions when appropriate
  - **MINIMIZE**: Avoid "text" and "textarea" (short answer) questions - they are harder to grade automatically since users can type anything. Only use these when absolutely necessary for the assessment topic
  - **LIMITED USE**: Use "number" only for mathematical or quantitative questions that require numeric answers
- Use "radio" instead of "select" for multiple choice (better UX)
- For select/radio/multiselect: Provide 3-5 options with clear, distinct choices
- Make questions clear and specific to the topic
- Ensure questions test understanding, not just memorization
- When possible, convert short answer questions into multiple choice or multiselect format

Return the assessment structure by calling the function \`create_in_chat_assessment\` with the fields and correctAnswers arrays.`;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          tools: [{
            functionDeclarations: [generateAssessmentFunction]
          }]
        }
      });

      // Extract function call result
      const functionCall = response.functionCalls?.[0];
      if (!functionCall || functionCall.name !== 'create_in_chat_assessment' || !functionCall.args) {
        throw new Error("Failed to generate assessment: Function was not called or returned invalid data");
      }

      const assessmentData = functionCall.args;
      if (!assessmentData || typeof assessmentData !== 'object') {
        throw new Error("Invalid assessment data: args is not an object");
      }
      if (!assessmentData.fields || !Array.isArray(assessmentData.fields)) {
        throw new Error("Invalid assessment data: fields array is missing");
      }
      if (!assessmentData.correctAnswers || !Array.isArray(assessmentData.correctAnswers)) {
        throw new Error("Invalid assessment data: correctAnswers array is missing");
      }

      // Convert correctAnswers array to object format for easier use
      // Parse string values back to their proper types based on field type
      const correctAnswersObj: Record<string, string | number | boolean | string[]> = {};
      const fieldTypeMap = new Map(assessmentData.fields.map((f: { name: string; type: string }) => [f.name, f.type]));
      
      assessmentData.correctAnswers.forEach((answer: { fieldName: string; value: unknown }) => {
        const fieldType = fieldTypeMap.get(answer.fieldName);
        let parsedValue: string | number | boolean | string[] = String(answer.value);
        
        // Parse based on field type
        if (fieldType === 'number' && typeof answer.value === 'string') {
          const num = parseFloat(answer.value);
          parsedValue = isNaN(num) ? answer.value : num;
        } else if (fieldType === 'checkbox') {
          if (answer.value === 'true' || answer.value === true) {
            parsedValue = true;
          } else if (answer.value === 'false' || answer.value === false) {
            parsedValue = false;
          } else {
            parsedValue = Boolean(answer.value);
          }
        } else if (fieldType === 'multiselect') {
          // Try to parse JSON array
          if (typeof answer.value === 'string' && answer.value.startsWith('[')) {
            try {
              parsedValue = JSON.parse(answer.value);
            } catch {
              // If parsing fails, treat as single-item array
              parsedValue = [answer.value];
            }
          } else if (Array.isArray(answer.value)) {
            parsedValue = answer.value;
          } else {
            parsedValue = [String(answer.value)];
          }
        } else {
          // For text, textarea, select, radio - keep as string
          parsedValue = String(answer.value);
        }
        
        correctAnswersObj[answer.fieldName] = parsedValue;
      });
      
      // Ensure all fields have corresponding answers
      const fieldNames = new Set(assessmentData.fields.map((f: { name: string }) => f.name));
      for (const fieldName of fieldNames) {
        if (!(fieldName in correctAnswersObj)) {
          console.warn(`Warning: No correct answer provided for field "${fieldName}"`);
        }
      }

      // Build Zod schema for validation
      const zodSchemaShape: Record<string, z.ZodTypeAny> = {};
      assessmentData.fields.forEach((field: { name: string; type: string; label: string; min?: number; max?: number }) => {
        if (field.type === "text" || field.type === "textarea") {
          zodSchemaShape[field.name] = z.string().min(1, `${field.label} is required`);
        } else if (field.type === "select" || field.type === "radio") {
          zodSchemaShape[field.name] = z.string().min(1, `${field.label} is required`);
        } else if (field.type === "multiselect") {
          zodSchemaShape[field.name] = z.array(z.string()).min(1, `Please select at least one option for ${field.label}`);
        } else if (field.type === "number") {
          zodSchemaShape[field.name] = z.number();
          if (field.min !== undefined) {
            zodSchemaShape[field.name] = (zodSchemaShape[field.name] as z.ZodNumber).min(field.min);
          }
          if (field.max !== undefined) {
            zodSchemaShape[field.name] = (zodSchemaShape[field.name] as z.ZodNumber).max(field.max);
          }
        } else if (field.type === "checkbox") {
          zodSchemaShape[field.name] = z.boolean();
        }
      });
      const zodSchema = z.object(zodSchemaShape);

      // Prepare Formedible fields array matching API format
      const formedibleFields = assessmentData.fields.map((field: { name: string; type: string; label: string; placeholder?: string; options?: Array<{ value: string; label: string }>; rows?: number; min?: number; max?: number; step?: number }) => {
        const baseField: {
          name: string;
          type: string;
          label: string;
          placeholder?: string;
          options?: Array<{ value: string; label: string }>;
          textareaConfig?: { rows: number };
          numberConfig?: { min?: number; max?: number; step?: number };
          multiSelectConfig?: { maxSelections: number; searchable?: boolean };
        } = {
          name: field.name,
          type: field.type,
          label: field.label,
        };

        if (field.placeholder) {
          baseField.placeholder = field.placeholder;
        }

        // Add options for select, radio, and multiselect
        if (field.type === "select" || field.type === "radio" || field.type === "multiselect") {
          if (field.options) {
            baseField.options = field.options;
          }
        }

        // Add textarea config
        if (field.type === "textarea") {
          baseField.textareaConfig = {
            rows: field.rows || 4,
          };
        }

        // Add number config
        if (field.type === "number") {
          baseField.numberConfig = {};
          if (field.min !== undefined) baseField.numberConfig.min = field.min;
          if (field.max !== undefined) baseField.numberConfig.max = field.max;
          if (field.step !== undefined) baseField.numberConfig.step = field.step;
        }

        // Add multiselect config
        if (field.type === "multiselect") {
          baseField.multiSelectConfig = {
            maxSelections: field.options?.length || 5,
            searchable: true,
          };
        }

        return baseField;
      });

      // Build schema metadata for storage (simpler format for DB)
      const schemaMetadata: Record<string, { type: string; required?: boolean; min?: number }> = {};
      assessmentData.fields.forEach((field: { name: string; type: string; min?: number }) => {
        if (field.type === "checkbox") {
          schemaMetadata[field.name] = {
            type: "boolean",
            required: true,
          };
        } else if (field.type === "number") {
          schemaMetadata[field.name] = {
            type: "number",
            required: true,
          };
        } else if (field.type === "multiselect") {
          schemaMetadata[field.name] = {
            type: "array",
            required: true,
          };
        } else {
          schemaMetadata[field.name] = {
            type: "string",
            required: true,
          };
          if (field.type === "text" || field.type === "textarea") {
            schemaMetadata[field.name].min = 1;
          }
        }
      });

      // Create assessment result
      const assessmentResult = {
        type: "inChatAssessment",
        topic,
        nodeTitle,
        difficulty,
        fields: formedibleFields,
        schema: schemaMetadata, // Store simple metadata for form component
        zodSchema: zodSchema, // Also include Zod schema for validation
        correctAnswers: correctAnswersObj,
      };

      // Save assessment to database if conversationId is provided
      if (conversationId) {
        try {
          await prisma.inChatAssessment.create({
            data: {
              topic,
              nodeTitle: nodeTitle || null,
              fields: formedibleFields,
              schema: schemaMetadata,
              correctAnswers: correctAnswersObj,
              conversationId: conversationId || null,
              nodeId: lessonId || null,
            },
          });
        } catch (dbError) {
          console.error("Error saving assessment to database:", dbError);
          // Continue even if DB save fails - assessment can still be used
        }
      }

      return {
        content: `In-chat assessment created for topic: "${topic}". The form has been generated with ${assessmentData.fields.length} questions.`,
        inChatAssessmentData: assessmentResult
      };
    } catch (error) {
      console.error("Error creating in-chat assessment:", error);
      return {
        content: `Failed to create in-chat assessment: ${error instanceof Error ? error.message : 'Unknown error'}`,
        inChatAssessmentData: null
      };
    }
  },
});
