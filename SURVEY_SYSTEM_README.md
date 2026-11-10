# Survey & Learning Path Management System

## Overview

This document describes the redesigned survey and learning path management system for professors. The system allows professors to create multiple surveys (AI or manual), duplicate them, and generate personalized learning paths for students with flexible selection options.

## Key Features

### 1. Survey Management

- **Multiple Surveys**: Professors can create and manage multiple surveys per class
- **Three Survey States**: 
  - `DRAFT` - Editable, not visible to students
  - `ACTIVE` - Published and available to students
  - `ARCHIVED` - Hidden from active view but preserved
- **AI Generation**: Generate surveys with AI based on course context
- **Manual Creation**: Create surveys from scratch with custom questions
- **Survey Duplication**: Duplicate any survey (draft/active/archived) to create a new draft copy
- **Question Management**: Add, edit, delete, duplicate, and reorder questions

### 2. Survey Editor

- **Drag-and-Drop Reordering**: Reorder questions by dragging
- **Question Types**:
  - Text (short answer)
  - Multiple Choice
  - Rating Scale
  - Ranking
- **Question Duplication**: Copy questions within a survey
- **Auto-save Ready**: Built for auto-save implementation (every 30 seconds)
- **Preview Mode**: Preview student view (ready for implementation)

### 3. Learning Path Generation

- **Three Generation Modes**:
  - **Individual**: Generate for a single student
  - **Selected**: Generate for multiple selected students
  - **All**: Generate for all students in class
- **No Response Threshold**: Can generate paths anytime (not requiring survey responses)
- **Survey-Based**: Each path is linked to a specific survey
- **Version Tracking**: Paths track version numbers for regeneration
- **Approval Workflow**: Paths require professor approval before students see them

### 4. Student Progress Tracking

- **Bulk Selection**: Select multiple students with checkboxes
- **Status Tracking**:
  - Survey completion status
  - Learning path status (none, pending, approved, rejected)
- **Quick Actions**: View survey responses, view pathways, approve/reject
- **Path Regeneration**: Regenerate paths for individual students

## Database Schema Changes

### Survey Model

```prisma
model Survey {
  id             String       @id @default(auto()) @map("_id") @db.ObjectId
  classId        String       @db.ObjectId
  title          String
  status         SurveyStatus @default(DRAFT)
  questions      Json         // Array of question objects
  publishedAt    DateTime?
  duplicatedFrom String?      @db.ObjectId
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  
  responses      StudentSurveyResponse[]
  learningPaths  LearningPathway[]
}

enum SurveyStatus {
  DRAFT
  ACTIVE
  ARCHIVED
}
```

### StudentSurveyResponse Model

```prisma
model StudentSurveyResponse {
  id         String   @id @default(auto()) @map("_id") @db.ObjectId
  studentId  String   @db.ObjectId
  surveyId   String   @db.ObjectId  // NEW: Links to specific survey
  classId    String   @db.ObjectId
  answers    Json
  submittedAt DateTime @default(now())
  
  @@unique([studentId, surveyId])
}
```

### LearningPathway Model

```prisma
model LearningPathway {
  id         String   @id @default(auto()) @map("_id") @db.ObjectId
  studentId  String
  classId    String
  surveyId   String?  @db.ObjectId  // NEW: Links to survey used for generation
  status     String   @default("pending")
  professorNotes String?
  approvedAt DateTime?
  rejectedAt DateTime?
  version    Int      @default(1)  // NEW: Tracks regenerations
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  
  nodes      PathwayNode[]
}
```

## API Endpoints

### Survey Management

#### List Surveys
```
GET /api/surveys?classId={classId}
```
Returns all surveys for a class, ordered by status and creation date.

#### Create Survey
```
POST /api/surveys
Body: {
  classId: string,
  title: string,
  questions?: Question[]
}
```
Creates a new draft survey.

#### Update Survey
```
POST /api/surveys
Body: {
  id: string,
  title?: string,
  questions?: Question[]
}
```
Updates an existing draft survey. Only drafts can be edited.

#### Generate Survey with AI
```
POST /api/surveys/generate
Body: {
  classId: string,
  context?: string,
  subject: string,
  level?: string
}
```
Generates a survey using AI based on course context and syllabus.

#### Duplicate Survey
```
POST /api/surveys/{id}/duplicate
```
Creates a draft copy of any survey with all questions.

#### Publish Survey
```
POST /api/surveys/{id}/publish
Body: {
  forcePublish?: boolean  // Optional: auto-archive existing active survey
}
```
Publishes a draft survey, making it available to students.

**Important**: Only one survey can be active per class at a time. If another survey is already active:
- Without `forcePublish`: Returns 409 CONFLICT with details about existing survey
- With `forcePublish: true`: Automatically archives the existing active survey and publishes the new one

Response (409 Conflict):
```json
{
  "error": "CONFLICT",
  "message": "Another survey is already active for this class",
  "existingSurvey": {
    "id": "...",
    "title": "...",
    "publishedAt": "..."
  },
  "requiresConfirmation": true
}
```

Response (200 Success):
```json
{
  "success": true,
  "survey": { ... },
  "message": "Survey published successfully",
  "archivedPrevious": true  // true if a previous survey was archived
}
```

#### Archive Survey
```
POST /api/surveys/{id}/archive
```
Archives an active survey.

#### Delete Survey
```
DELETE /api/surveys?id={id}
```
Deletes a draft survey permanently. Only drafts can be deleted.

### Question Management

#### Duplicate Question
```
POST /api/surveys/{id}/questions/duplicate
Body: {
  questionId: string
}
```
Duplicates a question within a survey.

#### Reorder Questions
```
PUT /api/surveys/{id}/questions/reorder
Body: {
  questionIds: string[]  // Array of question IDs in new order
}
```
Reorders questions in a survey.

### Learning Path Management

#### Generate Learning Paths
```
POST /api/learning-paths/generate
Body: {
  classId: string,
  surveyId: string,
  mode: 'individual' | 'selected' | 'all',
  studentIds?: string[]  // Required for 'individual' and 'selected'
}
```
Generates learning paths for students based on a survey.

Response includes:
- `generated`: Number of successfully generated paths
- `failed`: Number of failures
- `results`: Array of successful generations
- `errors`: Array of failures with error messages

#### Regenerate Learning Path
```
POST /api/learning-paths/{id}/regenerate
Body: {
  focusArea?: string  // Optional professor notes for focus
}
```
Regenerates a learning path with incremented version number.

#### Get Pathways (Professor View)
```
GET /api/pathway/professor/{classId}
```
Returns all pathways for a class with student information.

#### Update Pathway Status
```
PUT /api/pathway/professor/{classId}
Body: {
  pathwayId: string,
  status: 'approved' | 'rejected'
}
```
Approves or rejects a pathway.

## Component Usage

### Using the New Survey Management Component

Replace the old `SurveyLearningPath` component with `NewSurveyManagement`:

```tsx
import { NewSurveyManagement } from "@/components/teacher/class/NewSurveyManagement"

export default function ClassPage({ params }: { params: { classId: string } }) {
  return (
    <div>
      <NewSurveyManagement classId={params.classId} />
    </div>
  )
}
```

The component includes:
- Survey list dashboard
- Survey creation/editing
- AI generation
- Student progress table
- Learning path generation

### Standalone Components

You can also use components individually:

```tsx
import { SurveyEditor } from "@/components/teacher/class/SurveyEditor"
import { StudentProgressTable } from "@/components/teacher/class/StudentProgressTable"

// Use SurveyEditor
<SurveyEditor
  open={isOpen}
  onClose={() => setIsOpen(false)}
  survey={selectedSurvey}
  onSave={handleSave}
/>

// Use StudentProgressTable
<StudentProgressTable classId={classId} surveys={surveys} />
```

## Migration Notes

### Breaking Changes

1. **Database Schema**: The Survey model no longer has a unique constraint on `classId`. You'll need to run a migration.

2. **StudentSurveyResponse**: Now requires `surveyId` instead of just `classId`.

3. **Old Endpoints**: The old `/api/survey/[classId]` endpoint still works but is deprecated. Use `/api/surveys?classId={id}` instead.

### Migration Steps

1. **Database Migration**:
```bash
npx prisma generate
# Review and apply migrations to your production database
```

2. **Update Existing Code**:
   - Replace `SurveyLearningPath` with `NewSurveyManagement` in class pages
   - Update any direct API calls to use new endpoints
   - Update student survey submission to include `surveyId`

3. **Data Migration** (if needed):
   - Convert existing single surveys per class to new multi-survey format
   - Update survey responses to link to specific survey IDs

## Future Enhancements

- **Auto-save**: Implement auto-save every 30 seconds in SurveyEditor
- **Survey Preview**: Add student preview mode before publishing
- **Bulk Actions**: Archive/delete multiple surveys at once
- **Survey Analytics**: Track response rates and completion times
- **Path Templates**: Save and reuse learning path templates
- **Conditional Questions**: Show/hide questions based on previous answers
- **Question Bank**: Reusable question library across surveys
- **Export/Import**: Export surveys and import from other classes

## Troubleshooting

### Common Issues

1. **"Only draft surveys can be edited"**
   - Solution: Duplicate the survey to create an editable draft copy

2. **"Cannot publish survey without questions"**
   - Solution: Add at least one question before publishing

3. **"No active surveys available"**
   - Solution: Create and publish a survey before generating learning paths

4. **Learning paths not showing for students**
   - Solution: Make sure paths are approved by the professor

### Debug Mode

To enable debug logging, add to your `.env.local`:
```
NEXT_PUBLIC_DEBUG_SURVEYS=true
```

## Support

For issues or questions:
1. Check this README
2. Review the API documentation above
3. Check the console for error messages
4. Review the Prisma schema for data structure

## Version History

- **v1.0** (October 2025): Initial release with redesigned survey system
  - Multiple surveys per class
  - AI generation
  - Survey duplication
  - Flexible learning path generation
  - Drag-and-drop question reordering
  - Bulk student selection

