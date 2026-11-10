# `prisma/` — Database schema

MongoDB data model for SynapsEd via Prisma. **Source of truth:** `schema.prisma`.

Hub: [`../README.md`](../README.md) · Architecture: [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).

---

## Setup

```bash
# After schema changes
npx prisma generate

# Included automatically in
npm run build
```

Connection string: `DATABASE_URL` in `.env` (MongoDB).

Client singleton used by the app: [`../lib/prisma.ts`](../lib/prisma.ts).

Optional seed: `seed.ts` (demo ADMIN / PROFESSOR / STUDENT users). Run with your usual Prisma seed workflow if configured.

Also present: `schema.prisma.backup`, `prisma.config.ts` (minimal / unused for day-to-day work).

---

## Model groups

### Identity & auth

| Model | Purpose |
|---|---|
| `User` | App user; optional `role`; relations to classes, enrollments, notes, quizzes, conversations |
| `Account` / `Session` / `VerificationToken` | NextAuth adapter tables |

`Role` enum: `STUDENT` | `PROFESSOR` | `ADMIN`.

### Classes & materials

| Model | Purpose |
|---|---|
| `Class` | Course; unique `joinToken`; professor owner |
| `ClassEnrollment` | Student ↔ class (unique pair) |
| `ClassMaterial` | Uploaded files (PDF/DOCX/MP4…); category `SYLLABUS` / `CONTENT` / `EXERCISES`; vectorization + syllabus extraction fields |

### Surveys & pathways

| Model | Purpose |
|---|---|
| `Survey` | Multi-survey per class; status `DRAFT` / `ACTIVE` / `ARCHIVED`; questions JSON |
| `StudentSurveyResponse` | Student answers |
| `LearningPathway` | Personalized path; approval workflow fields |
| `PathwayNode` | Nodes with deps / difficulty / content hooks |

### Lesson learning aids

| Model | Purpose |
|---|---|
| `FlashcardDeck` / `Flashcard` | Per-node cards |
| `NodeProgress` | Flashcard / node mastery |
| `LessonNote` | BlockNote JSON notes per node |

### Documents & annotations

| Model | Purpose |
|---|---|
| `Document` / `DocumentAnnotation` | PDF/document annotation system |
| `ContentReference` / `Note` | Content hotspots / notes |

### AI tutor

| Model | Purpose |
|---|---|
| `Conversation` | Thread metadata (`threadId` unique) |
| `Message` | Chat turns (`MessageRole`) |
| `InChatAssessment` / `InChatAssessmentResponse` | Formedible assessments + scores |

### Professor quizzes

| Model | Purpose |
|---|---|
| `ProfessorQuiz` | Formal quiz (`QuizStatus`) |
| `ProfessorQuizQuestion` / `ProfessorQuizOption` | Items (`QuestionType`: MC / TF / short answer, etc.) |
| `ProfessorQuizResponse` / `ProfessorQuizAnswer` | Student attempts |

---

## Change process

1. Edit `schema.prisma`.
2. `npx prisma generate`.
3. Apply to Mongo carefully (Prisma + Mongo does not use SQL migrations the same way as Postgres — coordinate with the team’s deployment practice).
4. Update API/`lib` types and any seed scripts.
5. If models affect surveys/pathways, check [`../SURVEY_SYSTEM_README.md`](../SURVEY_SYSTEM_README.md) and study coupling.

---

## Related

- Auth: `../lib/authOptions.ts`, `../auth.ts`
- Agent persistence: `../lib/agent/conversation-service.ts`
- Study seed API: `../app/api/study/seed`
