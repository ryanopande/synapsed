# Architecture & main decisions

Cross-cutting design decisions for SynapsEd. For folder-level maps, start at the [root README](../README.md). For the AI tutor specifically, prefer [`lib/agent/README.md`](../lib/agent/README.md) and [`docs/features/agent-quickstart.md`](features/agent-quickstart.md).

---

## System shape

```text
Browser (App Router pages)
   │
   ├─ UI components/  (domain React)
   ├─ hooks/          (client data helpers)
   │
   ▼
app/api/*  (thin route handlers)
   │
   ▼
lib/*      (domain logic: agent, RAG, pathways, surveys, R2, …)
   │
   ├─ Prisma → MongoDB
   ├─ Pinecone (embeddings)
   ├─ Cloudflare R2 (files)
   └─ Providers: Gemini / OpenAI / Anthropic / Mistral
```

**Rule:** Prefer putting business logic in `lib/`, not in `app/api` route files or React components.

---

## Auth & sessions

**Decision:** one authentication parent, `lib/auth/`. Nothing else imports `next-auth` directly.

- **NextAuth v5** with **JWT** sessions and **Prisma adapter** (`lib/auth/config.ts`); provider: **Google OAuth only**.
- Role is stored on `User.role` (`STUDENT` | `PROFESSOR` | `ADMIN`) and copied into the JWT/session (`lib/auth/types.ts` types it).
- First login has `role: null` → `/choose-role` → `POST /api/set-role` → **sign out + sign in** so the JWT picks up the role. A role is chosen once; ADMIN is never self-assignable.

| Layer | Uses | Enforces |
|---|---|---|
| Pages | `middleware.ts` + `lib/auth/routes.ts` | Signed in, has a role, role may open `/teacher`, `/student`, `/class`, `/admin` |
| API routes | `@/lib/auth` (`requireUser`, `requireRole`, `requireClassProfessor`, …) | Signed in, role, and ownership/membership of the class, survey, quiz or pathway |
| Client components | `@/lib/auth/client` | Reads the session for display only; never a security boundary |
| `study/` pipeline | `isStudyServiceRequest` (`x-study-api-key`) | Machine access to the handful of routes the research scripts call |

Rules:

- API routes take the user from the session; IDs sent by the client (`userId`, `studentId`, `professorId`) are ignored or checked against it.
- ADMIN passes every role and ownership check.
- `routes.ts` stays free of Prisma/NextAuth imports so the edge middleware can use it.

The per-route access table is in [`app/api/README.md`](../app/api/README.md#access-control).

---

## Multimodal AI tutor (single brain)

**Decision:** One reasoning path for text, visual, and voice.

| Piece | Responsibility |
|---|---|
| `lib/agent/tutorAgent.ts` | Authoritative tutor logic (LangGraph + tools) |
| `lib/agent/prompts.ts` | Shared pedagogy + modality-specific prompts |
| `lib/agent/conversationService.ts` | Prisma persistence of turns |
| `POST /api/agent-chat` | Text chat path |
| `POST /api/session` | WebRTC SDP proxy to OpenAI Realtime (key stays server-side) |
| `POST /api/voice-turn` | Commit voice transcript → `invokeAgent` → reply text |

### Voice “Option 2”

OpenAI Realtime is **transport** (audio in/out, barge-in). Reasoning and memory writes go through `/api/voice-turn` with a required `turnId` for idempotency (`lib/agent/voiceTurnStore.ts`, in-memory TTL).

Sequence: [`docs/features/voice-mode.md`](features/voice-mode.md).

### Dual memory

1. **LangGraph MongoDB checkpointer** — graph state / tool loop continuity (same Mongo `DATABASE_URL`).
2. **Prisma `Conversation` / `Message`** — user-visible chat history via `ConversationService`.

Risks and drawbacks: [`docs/features/agent-memory-management.md`](features/agent-memory-management.md).

One conversation per `(userId, classId, lessonId)` is the intended model.

---

## Gemini model split

Defined in `lib/ai/gemini.ts`:

| Env | Default | Used for |
|---|---|---|
| `GEMINI_AGENT_MODEL` | `gemini-3-flash-preview` | LangGraph agent only (`bindTools` + checkpoints) |
| `GEMINI_MODEL` | `gemini-3-flash-preview` | One-shot generation (pathways, surveys, flashcards, OCR quizzes, etc.) |

**Why:** LangChain serialization of tool rounds omits Gemini 3 `thoughtSignature`. Until that is fixed (or the agent uses full `content.parts` history), the agent must stay on a 2.5 Flash-class model.

---

## RAG / materials pipeline

Typical flow for class materials:

1. Upload file → **Cloudflare R2** (`lib/storage`), orchestrated by `lib/rag/vectorizeMaterial.ts`
2. **Mistral OCR** → markdown (`lib/ai/mistral.ts`)
3. **Page-aware chunking** (`lib/rag`)
4. Embed + store in **Pinecone** (`lib/rag`)
5. Mark `ClassMaterial` vectorized in Prisma
6. Agent tool `searchClassContent` queries Pinecone scoped to the class

Syllabus extraction/structuring lives under `lib/syllabus` (`extractSyllabus.ts` is called directly after a syllabus upload) and `/api/syllabus/extract`.

---

## Surveys & personalized pathways

1. Professor creates surveys (DRAFT → ACTIVE / ARCHIVED) — multi-survey per class.
2. Student submits `StudentSurveyResponse`.
3. Pathway generation (`lib/pathways/generatePathway.ts`) plans against the class topic map (`lib/course/topicMap.ts`, built from syllabus + materials) and the student's per-topic mastery from the survey (`lib/course/mastery.ts`).
4. Pathways stored as `LearningPathway` + `PathwayNode`; UI via React Flow (`components/pathway`).
5. Professor approval / regenerate flows under `/api/pathway/*` and `/api/learning-paths/*`.

Product/API detail: [`docs/features/survey-system.md`](features/survey-system.md).

**Research coupling:** The Python `study/` pipeline evaluates the same personalization idea offline (and optionally against the live API, authenticated with `STUDY_API_KEY`). It keeps its own prompt spec in `study/data/prompts/`.

---

## Lesson experience

Route: `/class/[classId]/lesson/[nodeId]`.

Modes (UI in `components/lesson/`):

- AI chat + voice + Excalidraw (`tutor/`)
- Content / PDF (`content/`)
- Flashcards (`flashcards/`, currently commented out in the lesson page)
- In-chat assessments (Formedible)
- Professor quizzes (separate quiz routes under `/class/.../quiz/...`)

Notes use `LessonNote` + BlockNote; editor AI assist via `/api/editorAi` + `lib/editor`.

---

## Data model principles

- MongoDB ObjectIds via Prisma `@db.ObjectId`.
- Class join via unique `joinToken`.
- Materials categorized `SYLLABUS` | `CONTENT` | `EXERCISES`.
- Formal quizzes (`ProfessorQuiz*`) are separate from in-chat assessments (`InChatAssessment*`).

Schema map: [`prisma/README.md`](../prisma/README.md).

---

## UI / frontend conventions

- Path alias `@/*` → repo root (`tsconfig.json`).
- shadcn **new-york** style under `components/ui` (`components.json`).
- Ambient backgrounds: `bg-ambient-teacher`, `bg-ambient-light` (see `app/globals.css` / Tailwind config).
- Pathway client state: Zustand store in `components/pathway/pathwayStore.ts`.
- Some lists use SWR (e.g. flashcard deck hook).

---

## Study / Phase 0

Independent Python package under `study/` validating that pathways are meaningfully personalized (multiset Jaccard, contrast hypotheses, Claude LLM-as-judge). Gates are in `study/config/study_config.yaml` and enforced by `scripts/09_research_evaluation.py`.

Optional bridge into the app: `/api/study/seed` + DB-backed pathway scripts.

---

## Explicit non-goals / stubs today

- Full professor analytics dashboard (see PRD docs; UI tab often commented).
- Real implementations of `getStudentProgress` / `getClassResources` agent tools.
- Multi-instance-safe voice turn cache (in-memory only).
- Automated CI test suite in npm scripts.

Update this file when a decision above changes.
