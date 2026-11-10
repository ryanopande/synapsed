# `app/api/` — HTTP API surface

Next.js Route Handlers (`route.ts`) used by the SynapsEd UI and optional study tooling. Prefer keeping heavy logic in [`../../lib/`](../../lib/README.md).

Parent: [`../README.md`](../README.md) · Hub: [`../../README.md`](../../README.md).

---

## Auth note

These routes are **outside** the middleware matcher. Each handler should authenticate/authorize as needed (`auth()`, session checks, role checks). Do not assume middleware protects APIs.

---

## Endpoint map by domain

### Auth / session

| Path | Role |
|---|---|
| `auth/[...nextAuth]` | NextAuth handlers |
| `set-role` | Assign `STUDENT` / `PROFESSOR` after first login |
| `session` | WebRTC SDP proxy for OpenAI Realtime voice |

### AI tutor / multimodal

| Path | Role |
|---|---|
| `agent-chat` | Text tutor → `invokeAgent` |
| `voice-turn` | Voice transcript commit → `invokeAgent` (idempotent `turnId`) |
| `chat` | Older Gemini chat path (prefer `agent-chat` for the main tutor) |
| `editorAi` | BlockNote editor AI assist |

Canonical agent docs: [`../../lib/agent/README.md`](../../lib/agent/README.md), [`../../AGENT_QUICKSTART.md`](../../AGENT_QUICKSTART.md).

### Classes / enrollment / materials

| Path | Role |
|---|---|
| `class/[id]` | Class CRUD-ish |
| `class/[id]/materials` | List/manage materials |
| `class/[id]/students` | Enrollments |
| `classMaterial/upload` | Upload → R2 (+ vectorization pipeline) |
| `professor/classes` | Professor’s classes |
| `student/classes` | Student’s classes |
| `student/join` | Join via `joinToken` |

### RAG / syllabus / query

| Path | Role |
|---|---|
| `rag` | OCR / vectorize helpers |
| `query` | Query / retrieval experiments |
| `syllabus/extract` | Extract syllabus structure |
| `syllabus/content` | Syllabus content access |

### Surveys

| Path | Role |
|---|---|
| `surveys` | Multi-survey CRUD |
| `surveys/generate` | AI survey generation |
| `surveys/[id]/publish` \| `archive` \| `duplicate` | Lifecycle |
| `surveys/[id]/questions/reorder` \| `duplicate` | Question ops |
| `survey/*` | **Legacy** single-survey endpoints (`save`, `submit`, `template`, `response`, …) |

Prefer `surveys/*` for new work. Deep dive: [`../../SURVEY_SYSTEM_README.md`](../../SURVEY_SYSTEM_README.md).

### Learning pathways

| Path | Role |
|---|---|
| `pathway/generate` | Generate pathway |
| `pathway/generate/batch` | Batch generate |
| `pathway/get` | Fetch pathway |
| `pathway/embed` | Embed helpers |
| `pathway/exists/[classId]/[studentId]` | Existence check |
| `pathway/professor/[classId]` | Professor view / management |
| `learning-paths/generate` | Alternate/related generate entry |
| `learning-paths/[id]/regenerate` | Regenerate |

Prompt shared with study: `lib/learning-paths/pathwayPrompt.ts` → `study/data/prompts/pathway_generation_spec.json`.

### Flashcards / progress / lesson notes

| Path | Role |
|---|---|
| `flashcard/generate`, `flashcard/AI`, `flashcard/[nodeId]` | Deck generation / fetch |
| `progress/flashcard` | Mastery progress |
| `lesson-notes` | BlockNote lesson notes |

### Documents / annotations / references

| Path | Role |
|---|---|
| `documents`, `documents/[id]`, `.../pdf`, `.../annotations` | Student/class documents |
| `content-references` | Content hotspots / references |
| `hotspot-notes` | Hotspot note CRUD |

### Conversations

| Path | Role |
|---|---|
| `conversations` | List/create |
| `conversations/[threadId]` | Thread detail |
| `conversations/by-lesson` | Lookup by lesson |

### In-chat assessments

| Path | Role |
|---|---|
| `in-chat-assessment/submit` | Submit Formedible assessment |
| `in-chat-assessment/manual-trigger` | Manual trigger |
| `assessment/submit` | Related submit path |

Deep dive: [`../../inChatAssessment.md`](../../inChatAssessment.md).

### Professor quizzes

| Path | Role |
|---|---|
| `professor/quizzes/[classId]` | List/create for class |
| `professor/quiz/[quizId]` | Quiz CRUD |
| `professor/quiz/[quizId]/questions` | Questions |
| `professor/quiz/[quizId]/questions/[questionId]/image` | Question images (R2) |
| `professor/quiz/[quizId]/publish` | Publish |
| `professor/quiz/[quizId]/responses` | Responses |
| `professor/quizzes/ocr` | OCR import of quiz content |
| `professor/assessments/[classId]` (+ `aggregates`) | Assessment aggregates |

### Student quizzes

| Path | Role |
|---|---|
| `student/quizzes/[classId]` | Available quizzes |
| `student/quiz/[quizId]` | Fetch quiz |
| `student/quiz/[quizId]/submit` | Submit answers |
| `student/quiz/[quizId]/results` | Results |
| `student/quizzes/notifications` | Notifications |

### Study / misc

| Path | Role |
|---|---|
| `study/seed` | Seed synthetic class/profiles for Phase 0 |
| `waitlist` | Waitlist signup |

---

## Conventions for new endpoints

1. Create `app/api/<domain>/.../route.ts`.
2. Validate input (Zod where used elsewhere).
3. AuthZ: check session + class membership / professor ownership.
4. Call `lib/*` for side effects (DB, R2, Pinecone, LLM).
5. Document the route here and, if product-facing, in the relevant root feature README.

---

## Related

- Pages that call these APIs: [`../README.md`](../README.md)
- Domain logic: [`../../lib/README.md`](../../lib/README.md)
- Schema: [`../../prisma/README.md`](../../prisma/README.md)
