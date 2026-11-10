# In-Chat Assessment Implementation Guide

This document provides a step-by-step guide to the implementation of the in-chat assessment feature using Formedible forms.

## Overview

The in-chat assessment feature allows the AI tutor to evaluate student understanding by generating interactive forms directly within the chat interface. Students can answer questions, receive immediate feedback, and all responses are saved to the database for professor dashboard analytics.

## Architecture

- **Agent Tool**: `createInChatAssessment` - Generates Formedible-formatted assessments
- **Frontend Component**: `InChatAssessmentForm` - Renders forms in chat
- **API Endpoints**: Submit and manual trigger endpoints
- **Database Models**: `InChatAssessment` and `InChatAssessmentResponse`

---

## Step-by-Step Implementation

### Step 1: Install Formedible

**Command:**
```bash
npx shadcn@latest add https://formedible.dev/r/use-formedible.json --yes
```

**What it does:**
- Installs the `useFormedible` hook
- Adds all Formedible field components
- Sets up TypeScript definitions
- Installs required dependencies (TanStack Form, Zod, etc.)

**Files Created:**
- `hooks/use-formedible.tsx`
- `components/formedible/fields/*` (all field components)
- `lib/formedible/types.ts`

---

### Step 2: Database Schema

**File:** `prisma/schema.prisma`

**Added Models:**

```prisma
// In-Chat Assessment Models
model InChatAssessment {
  id             String    @id @default(auto()) @map("_id") @db.ObjectId
  conversationId String?   @db.ObjectId
  nodeId         String?   @db.ObjectId
  nodeTitle      String?
  topic          String
  fields         Json      // Formedible field configuration
  schema         Json      // Zod schema definition
  correctAnswers Json?     // Correct answers for AI feedback
  createdAt      DateTime  @default(now())
  
  // Relations
  conversation   Conversation? @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  node           PathwayNode? @relation(fields: [nodeId], references: [id], onDelete: Cascade)
  responses      InChatAssessmentResponse[]
  
  @@index([conversationId])
  @@index([nodeId])
  @@map("in_chat_assessments")
}

model InChatAssessmentResponse {
  id             String    @id @default(auto()) @map("_id") @db.ObjectId
  assessmentId   String    @db.ObjectId
  studentId      String    @db.ObjectId
  responses      Json      // Student's form responses
  score          Float?    // Calculated score if applicable
  feedback       String?   // AI-generated feedback
  submittedAt     DateTime  @default(now())
  
  // Relations
  assessment     InChatAssessment @relation(fields: [assessmentId], references: [id], onDelete: Cascade)
  student        User      @relation(fields: [studentId], references: [id], onDelete: Cascade)
  
  @@index([assessmentId])
  @@index([studentId])
  @@map("in_chat_assessment_responses")
}
```

**Updated Relations:**
- Added `inChatAssessments` to `Conversation` model
- Added `inChatAssessments` to `PathwayNode` model
- Added `inChatAssessmentResponses` to `User` model

**Migration:**
```bash
npx prisma generate
npx prisma migrate dev --name add_in_chat_assessments
```

---

### Step 3: Create Assessment Tool

**File:** `lib/agent/tools/createInChatAssessment.ts`

**Key Features:**

1. **Structured Output with Function Calling**
   - Uses Gemini's `.withStructuredOutput()` for consistent JSON generation
   - Zod schema ensures type-safe output

2. **Field Types Supported**
   - `text` - Short answer questions
   - `textarea` - Longer explanations
   - `select` - Dropdown multiple choice
   - `radio` - Radio button multiple choice (preferred for assessments)
   - `multiselect` - Multiple selection
   - `number` - Numeric answers
   - `checkbox` - True/false questions

3. **Formedible Format Compliance**
   - Fields use `options` array directly (not nested in config)
   - Config objects: `textareaConfig`, `numberConfig`, `multiSelectConfig`
   - Matches Formedible API documentation exactly

4. **Database Integration**
   - Saves assessment to database when `conversationId` is provided
   - Links assessment to conversation and node

**Tool Schema:**
```typescript
{
  topic: string
  nodeTitle?: string
  questionCount: number (1-10)
  difficulty: "beginner" | "intermediate" | "advanced"
  conversationId?: string
  classId?: string
  lessonId?: string
}
```

**Output Structure:**
```typescript
{
  fields: FormedibleField[]
  correctAnswers: Record<string, string | number | boolean | string[]>
}
```

---

### Step 4: Integrate Tool into Agent

**File:** `lib/agent/simple-agent.ts`

**Changes Made:**

1. **Import Tool**
   ```typescript
   import { createInChatAssessment } from "./tools/createInChatAssessment";
   ```

2. **Add to Tools Map**
   ```typescript
   const toolsByName = {
     // ... other tools
     [createInChatAssessment.name]: createInChatAssessment,
   };
   ```

3. **Store Assessment Data**
   - Created `toolInChatAssessmentMap` to store assessment data from tool calls
   - Extracts `inChatAssessmentData` from tool results
   - Includes in `AgentResponse` interface

4. **Context Passing**
   - Added `currentToolContext` to pass conversation context to tools
   - Injects `conversationId`, `classId`, `lessonId` into tool calls
   - Updated `invokeAgent` to accept `conversationId` parameter

5. **Updated System Prompt**
   - Added section on when and how to use `createInChatAssessment`
   - Guides AI on assessment timing and feedback

---

### Step 5: Create Assessment Form Component

**File:** `components/Lesson/AiLesson/InChatAssessmentForm.tsx`

**Features:**

1. **Form Rendering**
   - Uses `useFormedible` hook with generated schema
   - Handles all supported field types
   - Builds Zod schema from metadata or uses provided schema

2. **Form Submission**
   - Submits to `/api/in-chat-assessment/submit`
   - Shows loading state during submission
   - Displays AI-generated feedback after submission

3. **Type Safety**
   - Proper TypeScript interfaces for all props
   - Extends Formedible's `FieldConfig` type
   - Handles schema conversion properly

**Component Props:**
```typescript
{
  inChatAssessmentData: InChatAssessmentData
  assessmentId?: string
  conversationId?: string
  classId?: string
  lessonId?: string
  userId?: string
  onSubmitSuccess?: (feedback: string) => void
}
```

---

### Step 6: Create API Endpoints

#### 6.1 Submit Endpoint

**File:** `app/api/in-chat-assessment/submit/route.ts`

**Functionality:**
1. Receives form responses and assessment data
2. Creates or finds assessment record
3. Calculates score based on correct answers
4. Saves response to database
5. Generates AI feedback using agent
6. Returns feedback to frontend

**Scoring Logic:**
- **Text/Textarea**: String comparison (case-insensitive, trimmed)
- **Select/Radio**: Exact value match
- **Multiselect**: Array comparison (all correct values must be selected)
- **Number**: Numeric comparison
- **Checkbox**: Boolean comparison

#### 6.2 Manual Trigger Endpoint

**File:** `app/api/in-chat-assessment/manual-trigger/route.ts`

**Functionality:**
1. Allows students to manually request an assessment
2. Calls agent with prompt to generate assessment
3. Returns assessment data for rendering

**Usage:**
```typescript
POST /api/in-chat-assessment/manual-trigger
{
  topic: string
  nodeTitle?: string
  classId?: string
  lessonId?: string
  userId: string
  threadId?: string
}
```

---

### Step 7: Integrate into Chat Section

**File:** `components/Lesson/AiLesson/ChatSection.tsx`

**Changes Made:**

1. **Import Component**
   ```typescript
   import { InChatAssessmentForm } from "./InChatAssessmentForm"
   ```

2. **Update Message Interface**
   - Added `inChatAssessmentData?: InChatAssessmentData` to Message interface
   - Proper TypeScript types (no `any`)

3. **Detect Assessment Data**
   - Checks `message.inChatAssessmentData` in message rendering
   - Renders `InChatAssessmentForm` instead of regular markdown when present

4. **Handle Assessment Responses**
   - Updates messages array with assessment data from API responses
   - Displays feedback as new assistant message after submission

5. **Manual Trigger Button**
   - Added "Test My Understanding" button (ClipboardCheck icon)
   - Only shows when `nodeTitle` is available
   - Calls manual trigger API endpoint

**Message Rendering Logic:**
```typescript
{message.inChatAssessmentData ? (
  <InChatAssessmentForm
    inChatAssessmentData={message.inChatAssessmentData}
    // ... props
  />
) : (
  <ReactMarkdown>{message.content}</ReactMarkdown>
)}
```

---

### Step 8: Update Agent Chat API

**File:** `app/api/agent-chat/route.ts`

**Changes:**
- Updated to pass `conversationId` to `invokeAgent`
- Includes `inChatAssessmentData` in API response
- Assessment data flows through to frontend

**Response Format:**
```typescript
{
  response: string
  sources?: SourceMetadata[]
  inChatAssessmentData?: InChatAssessmentData
  conversationId?: string
  threadId?: string
}
```

---

## Data Flow

### Automatic Assessment Flow

1. **AI Decides to Assess**
   - Agent analyzes conversation context
   - Determines student needs assessment
   - Calls `createInChatAssessment` tool

2. **Tool Generates Assessment**
   - Uses Gemini structured output
   - Returns Formedible field configuration
   - Saves to database with `conversationId`

3. **Frontend Renders Form**
   - ChatSection detects `inChatAssessmentData`
   - Renders `InChatAssessmentForm` component
   - Form uses Formedible to render fields

4. **Student Submits**
   - Form validates using Zod schema
   - Submits to `/api/in-chat-assessment/submit`
   - API calculates score and generates feedback

5. **Feedback Display**
   - AI feedback displayed in chat
   - Response saved to database
   - Conversation continues

### Manual Trigger Flow

1. **Student Clicks Button**
   - "Test My Understanding" button clicked
   - Calls `/api/in-chat-assessment/manual-trigger`

2. **API Triggers Agent**
   - Sends prompt to agent requesting assessment
   - Agent calls `createInChatAssessment` tool

3. **Assessment Rendered**
   - Same flow as automatic assessment
   - Form appears in chat

---

## Formedible Field Format Reference

### Text Field
```typescript
{
  name: "question1",
  type: "text",
  label: "What is...?",
  placeholder: "Enter your answer..."
}
```

### Textarea Field
```typescript
{
  name: "question2",
  type: "textarea",
  label: "Explain...",
  placeholder: "Provide details...",
  textareaConfig: { rows: 4 }
}
```

### Select Field
```typescript
{
  name: "question3",
  type: "select",
  label: "Which of the following...?",
  options: [
    { value: "option1", label: "Option 1" },
    { value: "option2", label: "Option 2" }
  ],
  placeholder: "Select an option"
}
```

### Radio Field
```typescript
{
  name: "question4",
  type: "radio",
  label: "What is...?",
  options: [
    { value: "a", label: "A" },
    { value: "b", label: "B" }
  ]
}
```

### Multiselect Field
```typescript
{
  name: "question5",
  type: "multiselect",
  label: "Select all that apply...",
  options: [
    { value: "opt1", label: "Option 1" },
    { value: "opt2", label: "Option 2" }
  ],
  multiSelectConfig: {
    maxSelections: 5,
    searchable: true
  }
}
```

### Number Field
```typescript
{
  name: "question6",
  type: "number",
  label: "What is...?",
  numberConfig: {
    min: 0,
    max: 100,
    step: 1
  }
}
```

### Checkbox Field
```typescript
{
  name: "question7",
  type: "checkbox",
  label: "True or False: ..."
}
```

---

## Database Queries for Professor Dashboard

### Get All Assessments for a Class
```typescript
const assessments = await prisma.inChatAssessment.findMany({
  where: { 
    conversation: { classId: "classId" }
  },
  include: {
    responses: {
      include: {
        student: true
      }
    }
  }
});
```

### Get Student Performance
```typescript
const studentResponses = await prisma.inChatAssessmentResponse.findMany({
  where: {
    studentId: "studentId",
    assessment: {
      conversation: { classId: "classId" }
    }
  },
  include: {
    assessment: true
  },
  orderBy: {
    submittedAt: "desc"
  }
});
```

### Calculate Average Score
```typescript
const avgScore = await prisma.inChatAssessmentResponse.aggregate({
  where: {
    assessmentId: "assessmentId"
  },
  _avg: {
    score: true
  }
});
```

---

## Testing Checklist

- [ ] AI automatically generates assessment after explaining concept
- [ ] Manual trigger button works correctly
- [ ] All field types render properly (text, textarea, select, radio, multiselect, number, checkbox)
- [ ] Form validation works for all field types
- [ ] Form submission saves to database
- [ ] Score calculation works for all field types
- [ ] AI feedback is generated and displayed
- [ ] Assessment is linked to conversation correctly
- [ ] Multiple assessments can be created in same conversation
- [ ] Assessment responses are queryable for professor dashboard

---

## Key Files Summary

| File | Purpose |
|------|---------|
| `lib/agent/tools/createInChatAssessment.ts` | Tool that generates assessments |
| `components/Lesson/AiLesson/InChatAssessmentForm.tsx` | Form rendering component |
| `app/api/in-chat-assessment/submit/route.ts` | Form submission endpoint |
| `app/api/in-chat-assessment/manual-trigger/route.ts` | Manual trigger endpoint |
| `components/Lesson/AiLesson/ChatSection.tsx` | Chat integration |
| `lib/agent/simple-agent.ts` | Agent system integration |
| `prisma/schema.prisma` | Database models |

---

## Future Enhancements

1. **Professor Dashboard Views**
   - Display all student assessment responses
   - Analytics and performance metrics
   - Filter by topic, difficulty, date range

2. **Assessment Analytics**
   - Question-level analytics
   - Common wrong answers
   - Difficulty adjustment based on performance

3. **Adaptive Assessments**
   - Dynamic difficulty adjustment
   - Follow-up questions based on responses
   - Personalized question selection

4. **Assessment History**
   - View past assessments
   - Compare performance over time
   - Review feedback history

---

## Troubleshooting

### Assessment Not Rendering
- Check browser console for errors
- Verify `inChatAssessmentData` is present in message
- Ensure Formedible components are installed

### Form Submission Fails
- Check API endpoint logs
- Verify database connection
- Ensure all required fields are provided

### Score Calculation Issues
- Verify correct answers format matches field type
- Check scoring logic in submit endpoint
- Ensure field types match between assessment and response

### Database Errors
- Run `npx prisma generate` after schema changes
- Run `npx prisma migrate dev` to apply migrations
- Verify MongoDB connection string

---

## References

- [Formedible Documentation](https://formedible.dev/docs)
- [Formedible API Reference](https://formedible.dev/docs/api)
- [Formedible Field Types](https://formedible.dev/docs/fields)
- [LangChain Tools Documentation](https://js.langchain.com/docs/modules/tools/)

