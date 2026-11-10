# `app/api/` — HTTP API surface

Next.js Route Handlers (`route.ts`) used by the SynapsEd UI and the `study/` research pipeline. Keep handlers thin; put logic in [`../../lib/`](../../lib/README.md).

Parent: [`../README.md`](../README.md) · Hub: [`../../README.md`](../../README.md).

---

## Access control

Middleware only protects **pages**. Every API route checks access itself through [`lib/auth`](../../lib/README.md#auth--the-authentication-parent). The **Access** column below says who may call each route:

| Access | Meaning | Helper |
|---|---|---|
| Public | Anyone | — |
| Signed in | Any signed-in user; data is scoped to that user | `requireUser` |
| Professor | Role `PROFESSOR` | `requireRole("PROFESSOR")` |
| Class professor | Teaches the class in question | `requireClassProfessor`, `requireSurveyProfessor` |
| Class member | Teaches or is enrolled in the class | `requireClassMember` |
| Enrolled student | Enrolled in the class | `requireEnrolledStudent` |
| Student or professor | Is that student, or teaches the class | `requireStudentOrClassProfessor`, `requirePathwayNodeAccess` |
| Quiz owner | Created the quiz (checked in the route) | `requireUser` + `quiz.professorId` |
| + study key | Also accepts `x-study-api-key: $STUDY_API_KEY` from `study/` | `isStudyServiceRequest` |

ADMIN passes every check. Routes never trust a user, student or professor ID sent by the client; they use the session user.

---

## Endpoint map by domain

### Auth / session

| Path | Access | Role |
|---|---|---|
| `auth/[...nextAuth]` | Public | NextAuth handlers |
| `set-role` | Signed in | Choose `STUDENT` / `PROFESSOR` once, after first sign-in (ADMIN is never self-assignable) |
| `session` | Signed in | WebRTC SDP proxy for OpenAI Realtime voice |

### AI tutor / multimodal

| Path | Access | Role |
|---|---|---|
| `agent-chat` | Signed in (+ class member when `classId` given) | Text tutor → `invokeAgent` |
| `voice-turn` | Signed in (+ class member when `classId` given) | Voice transcript commit → `invokeAgent` (idempotent `turnId`) |
| `chat` | Signed in | Gemini chat for the pathway-page `AIAssistant` |
| `editorAi` | Signed in | BlockNote editor AI assist |

Canonical agent docs: [`../../lib/agent/README.md`](../../lib/agent/README.md), [`../../docs/features/agent-quickstart.md`](../../docs/features/agent-quickstart.md).

### Conversations

| Path | Access | Role |
|---|---|---|
| `conversations` | Signed in | List/create the user's conversations |
| `conversations/[threadId]` | Signed in (own threads only) | Thread detail, rename, delete |
| `conversations/by-lesson` | Signed in | The user's conversation for a lesson |

### Classes / enrollment / materials

| Path | Access | Role |
|---|---|---|
| `professor/classes` | Professor | List / create the professor's classes |
| `student/classes` | Signed in | The student's enrolled classes |
| `student/join` | Signed in, student | Join via `joinToken` |
| `class/[id]` | Class professor | Class details, rename, reset join code |
| `class/[id]/students` | Class professor | Enrollments |
| `class/[id]/materials` | Class member + study key | List materials |
| `classMaterial/upload` | Class professor + study key | Upload → R2 → vectorize; syllabi are extracted in the background |
| `syllabus/extract` | Class professor + study key | Extract syllabus structure (cached) |

### Surveys

| Path | Access | Role |
|---|---|---|
| `surveys` | Class professor | Multi-survey list / create / update / delete |
| `surveys/generate` | Class professor | AI diagnostic survey generation |
| `surveys/[id]/publish` \| `archive` \| `duplicate` | Class professor | Lifecycle |
| `surveys/[id]/questions/reorder` \| `duplicate` | Class professor | Question ops |
| `survey/[classId]` | Class member | The class's active survey (answer keys stripped) |
| `survey/submit` | POST: enrolled student · GET: student or professor | Submit answers / check submission |
| `survey/response/[classId]` | Class professor | All responses for a class |

Deep dive: [`../../docs/features/survey-system.md`](../../docs/features/survey-system.md).

### Learning pathways

| Path | Access | Role |
|---|---|---|
| `pathway/get` | Student or professor | Approved pathway nodes |
| `pathway/exists/[classId]/[studentId]` | Student or professor | Existence check |
| `pathway/node/[nodeId]/complete` | Signed in (own pathway) | Lesson lock state / mark complete |
| `pathway/professor/[classId]` | Class professor + study key | List, approve/reject, regenerate with focus |
| `learning-paths/generate` | Class professor + study key | Generate pathways (individual / selected / all) |
| `learning-paths/[id]/regenerate` | Class professor + study key | Regenerate one pathway |

All generation goes through `lib/pathways/generatePathway.ts`: class topic map (`lib/course/topicMap.ts`) + student mastery from the diagnostic survey → Gemini.

### Flashcards / progress / lesson notes

| Path | Access | Role |
|---|---|---|
| `flashcard/generate`, `flashcard/[nodeId]` | Student or professor (of the node's pathway) | Deck generation / fetch / edit |
| `flashcard/AI` | Signed in | Raw AI flashcards for given content |
| `progress/flashcard` | Signed in | The student's flashcard progress |
| `lesson-notes` | Signed in | The student's BlockNote lesson notes |

### Documents / annotations / references

| Path | Access | Role |
|---|---|---|
| `documents`, `documents/[id]`, `.../pdf`, `.../annotations` | Signed in (own documents) | Uploaded documents and annotations |
| `content-references`, `content-references/[id]` | Signed in (own documents) | Content hotspots / references |
| `hotspot-notes`, `hotspot-notes/[id]` | Signed in (own notes) | Hotspot note CRUD |

### In-chat assessments

| Path | Access | Role |
|---|---|---|
| `in-chat-assessment/submit` | Signed in | Submit a Formedible assessment |
| `in-chat-assessment/manual-trigger` | Signed in | Ask the tutor for an assessment |

Deep dive: [`../../docs/features/in-chat-assessment.md`](../../docs/features/in-chat-assessment.md).

### Professor quizzes, analytics and feedback

| Path | Access | Role |
|---|---|---|
| `professor/quizzes/[classId]` | Class professor | List/create quizzes for a class |
| `professor/quizzes/ocr` | Professor | OCR import of quiz content |
| `professor/quiz/[quizId]` | Quiz owner | Quiz CRUD |
| `professor/quiz/[quizId]/questions` (+ `[questionId]`, `.../image`) | Quiz owner | Questions and question images (R2) |
| `professor/quiz/[quizId]/publish` | Quiz owner | Publish / archive |
| `professor/quiz/[quizId]/responses` (+ `[responseId]`) | Quiz owner | Responses, manual grading |
| `professor/assessments/[classId]` (+ `aggregates`) | Class professor | Assessment results and aggregates |
| `professor/analytics/[classId]` | Class professor | Class analytics |
| `professor/feedback/[classId]/[studentId]` | Class professor | Read / write feedback for a student |

### Student quizzes, achievements and feedback

| Path | Access | Role |
|---|---|---|
| `student/quizzes/[classId]` | Enrolled student | Available quizzes |
| `student/quiz/[quizId]` | Enrolled student | Fetch quiz |
| `student/quiz/[quizId]/submit` | Enrolled student | Submit answers |
| `student/quiz/[quizId]/results` | Enrolled student | Results |
| `student/quizzes/notifications` | Signed in | Quiz notifications across the student's classes |
| `student/achievements` | Signed in | The student's achievements |
| `student/feedback` | Signed in | Feedback the student received |

### Study / misc

| Path | Access | Role |
|---|---|---|
| `study/seed` | Study key only | Seed synthetic class/profiles for Phase 0 |
| `waitlist` | Public | Add an email to the Loops waitlist |

---

## Conventions for new endpoints

1. Create `app/api/<domain>/.../route.ts`.
2. Start every handler with a `lib/auth` helper (see the table above); take user IDs from the session, not the request.
3. Validate input (Zod where used elsewhere).
4. Call `lib/*` for side effects (DB, R2, Pinecone, LLM). Never `fetch` this app's own API from the server.
5. Add the route to the map above with its Access level.

---

## Related

- Pages that call these APIs: [`../README.md`](../README.md)
- Domain logic: [`../../lib/README.md`](../../lib/README.md)
- Schema: [`../../prisma/README.md`](../../prisma/README.md)
