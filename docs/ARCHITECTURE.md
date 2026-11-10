# Architecture & main decisions

Cross-cutting design decisions for SynapsEd. For folder-level maps, start at the [root README](../README.md). For the AI tutor specifically, prefer [`lib/agent/README.md`](../lib/agent/README.md) and [`AGENT_QUICKSTART.md`](../AGENT_QUICKSTART.md).

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

- **NextAuth v5** with **JWT** sessions and **Prisma adapter** (`lib/authOptions.ts`).
- Provider: **Google OAuth only**.
- Entry: `auth.ts` exports `{ handlers, signIn, signOut, auth }`.
- Role is stored on `User.role` (`STUDENT` | `PROFESSOR` | `ADMIN`).
- First login often has `role: null` → `/choose-role` → `POST /api/set-role` → **sign out + sign in** so the JWT picks up the new role.

### Middleware caveats

`middleware.ts` body mentions `/class` and `/admin`, but `config.matcher` is only:

```ts
['/admin/:path*', '/teacher/:path*', '/student/:path*']
```

Implications:

- `/class/*` is **not** middleware-protected by that matcher.
- `/api/*` is explicitly skipped inside the middleware body when matched — and APIs are outside the matcher anyway. **API routes must enforce auth themselves.**
- There is no `app/admin` tree today.

---

## Multimodal AI tutor (single brain)

**Decision:** One reasoning path for text, visual, and voice.

| Piece | Responsibility |
|---|---|
| `lib/agent/simple-agent.ts` | Authoritative tutor logic (LangGraph + tools) |
| `lib/agent/prompts.ts` | Shared pedagogy + modality-specific prompts |
| `lib/agent/conversation-service.ts` | Prisma persistence of turns |
| `POST /api/agent-chat` | Text chat path |
| `POST /api/session` | WebRTC SDP proxy to OpenAI Realtime (key stays server-side) |
| `POST /api/voice-turn` | Commit voice transcript → `invokeAgent` → reply text |

### Voice “Option 2”

OpenAI Realtime is **transport** (audio in/out, barge-in). Reasoning and memory writes go through `/api/voice-turn` with a required `turnId` for idempotency (`lib/agent/voice-turn-store.ts`, in-memory TTL).

Sequence: [`diagrams/voice-feature.md`](../diagrams/voice-feature.md).

### Dual memory

1. **LangGraph MongoDB checkpointer** — graph state / tool loop continuity (same Mongo `DATABASE_URL`).
2. **Prisma `Conversation` / `Message`** — user-visible chat history via `ConversationService`.

Risks and drawbacks: [`MEMORY_MANAGEMENT_DRAWBACKS.md`](../MEMORY_MANAGEMENT_DRAWBACKS.md).

One conversation per `(userId, classId, lessonId)` is the intended model.

---

## Gemini model split

Defined in `lib/gemini-model.ts`:

| Env | Default | Used for |
|---|---|---|
| `GEMINI_AGENT_MODEL` | `gemini-2.5-flash` | LangGraph agent only (`bindTools` + checkpoints) |
| `GEMINI_MODEL` | `gemini-3-flash-preview` | One-shot generation (pathways, surveys, flashcards, OCR quizzes, etc.) |

**Why:** LangChain serialization of tool rounds omits Gemini 3 `thoughtSignature`. Until that is fixed (or the agent uses full `content.parts` history), the agent must stay on a 2.5 Flash-class model.

---

## RAG / materials pipeline

Typical flow for class materials:

1. Upload file → **Cloudflare R2** (`lib/r2`)
2. **Mistral OCR** → markdown (`lib/ocr` / `lib/rag`)
3. **Page-aware chunking** (`lib/chunking`)
4. Embed + store in **Pinecone** (`lib/pinecone`)
5. Mark `ClassMaterial` vectorized in Prisma
6. Agent tool `searchClassContent` queries Pinecone scoped to the class

Syllabus extraction/structuring lives under `lib/syllabus` and related `/api/syllabus/*` routes.

---

## Surveys & personalized pathways

1. Professor creates surveys (DRAFT → ACTIVE / ARCHIVED) — multi-survey per class.
2. Student submits `StudentSurveyResponse`.
3. Pathway generation uses survey + syllabus context and a **shared prompt spec**:
   - TypeScript: `lib/learning-paths/pathwayPrompt.ts`
   - Spec JSON: `study/data/prompts/pathway_generation_spec.json`
4. Pathways stored as `LearningPathway` + `PathwayNode`; UI via React Flow (`components/Synapses/Pathway`).
5. Professor approval / regenerate flows under `/api/pathway/*` and `/api/learning-paths/*`.

Product/API detail: [`SURVEY_SYSTEM_README.md`](../SURVEY_SYSTEM_README.md).

**Research coupling:** The Python `study/` pipeline evaluates the same personalization idea offline (and optionally against the live API). Keep the prompt JSON in sync when changing pathway generation.

---

## Lesson experience

Route: `/class/[classId]/lesson/[nodeId]`.

Modes (UI in `components/Lesson/`):

- AI chat + voice + Excalidraw (`AiLesson/`)
- Content / PDF (`contentPage/`)
- Flashcards (`flashcard/`)
- In-chat assessments (Formedible)
- Professor quizzes (separate quiz routes under `/class/.../quiz/...`)

Notes use `LessonNote` + BlockNote; editor AI assist via `/api/editorAi` + `lib/Editor`.

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
- Pathway client state: Zustand store in `components/Synapses/Pathway/store.ts`.
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
