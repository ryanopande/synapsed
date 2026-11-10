# `lib/` — Domain logic

Server-side (and shared) business logic for SynapsEd. API routes in `app/api` and Server Components call into here instead of reimplementing pipelines. Each folder is one domain.

Hub: [`../README.md`](../README.md) · Architecture: [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).

---

## Folder map

| Folder | Purpose | Key files |
|---|---|---|
| [`auth/`](#auth--the-authentication-parent) | **All authentication and authorization** | `index.ts` (server), `client.ts` (React), `routes.ts` (middleware) |
| `db/` | Prisma client singleton | `prisma.ts` |
| `ai/` | One shared client per AI provider | `gemini.ts` (client + model names), `mistral.ts` (client + OCR) |
| `storage/` | Cloudflare R2 uploads | `r2.ts` (client), `uploadToR2.ts`, `uploadQuizImage.ts`, `uploadStudentDocument.ts` |
| `rag/` | Material → chunks → Pinecone, and retrieval | `pinecone.ts` (client), `vectorizeMaterial.ts`, `chunkMarkdown.ts`, `embedAndStore.ts`, `queryPinecone.ts` |
| [`agent/`](./agent/README.md) | Multimodal AI tutor (LangGraph) | `tutorAgent.ts`, `prompts.ts`, `conversationService.ts`, `voiceTurnStore.ts`, `tools/` |
| `course/` | Per-class topic map and per-topic mastery scoring | `topicMap.ts`, `mastery.ts`, `types.ts` |
| `pathways/` | Personalized pathway generation and lesson unlocking | `generatePathway.ts`, `progress.ts`, `locks.ts` |
| `surveys/` | Diagnostic survey generation | `diagnostic.ts`, `syllabusService.ts` |
| `syllabus/` | Syllabus OCR → structured content, with caching | `processSyllabus.ts`, `extractSyllabus.ts`, `cache.ts` |
| `quizzes/` | Professor quiz grading | `grading.ts` |
| `flashcards/` | Flashcard generation (Gemini, with fallback deck) | `generate.ts`, `aiClient.ts` (browser) |
| `students/` | Student achievements and professor feedback | `achievements.ts`, `feedback.ts` |
| `analytics/` | Class analytics for professors | `classAnalytics.ts` |
| `documents/` | PDF annotations and content references | `databaseContentService.ts` (browser), `annotationUtils.ts` |
| `editor/` | BlockNote editor AI assist | `models.ts` (server), `aiClient.ts` (browser) |
| `forms/` | Formedible dynamic-form helpers (in-chat assessments) | `types.ts`, `templateInterpolation.ts` |
| `types/` | Shared TypeScript types | `assessments.ts`, `quizzes.ts`, `pathway.ts`, … |
| `utils.ts` | `cn()` Tailwind class helper (used by shadcn `components/ui`) | |

Files marked *(browser)* are thin `fetch` wrappers called from client components; everything else runs on the server.

---

## `auth/` — the authentication parent

Every auth concern goes through this folder; nothing else imports `next-auth` directly.

| File | Purpose | Import from |
|---|---|---|
| `index.ts` | Entry point: re-exports everything below | `@/lib/auth` (server) |
| `config.ts` | NextAuth config: Google provider, Prisma adapter, JWT callbacks | — |
| `nextauth.ts` | The NextAuth instance: `auth`, `handlers`, `signIn`, `signOut` | via `index.ts` |
| `session.ts` | `getCurrentUser`, `requireUser`, `requireRole`, `hasRole`, `isAdmin` | via `index.ts` |
| `guards.ts` | Ownership checks: `requireClassProfessor`, `requireClassMember`, `requireEnrolledStudent`, `requireStudentOrClassProfessor`, `requireSurveyProfessor`, `requirePathwayNodeAccess` | via `index.ts` |
| `service-key.ts` | `isStudyServiceRequest` — `STUDY_API_KEY` access for the `study/` pipeline | via `index.ts` |
| `routes.ts` | Page paths, `HOME_BY_ROLE`, role-based page rules (edge-safe) | `@/lib/auth/routes` (middleware) |
| `client.ts` | `useSession`, `useCurrentUser`, `signInWithGoogle`, `signOutToSignIn`, `SessionProvider` | `@/lib/auth/client` (client components) |
| `types.ts` | Adds `id` and `role` to NextAuth's `Session`/`JWT` types | — |

Every `require*` helper returns `{ ok: true, user, ... }` or `{ ok: false, response }`, so an API route looks like:

```ts
import { requireClassProfessor } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: Params) {
  const { classId } = await params;
  const authResult = await requireClassProfessor(classId);
  if (!authResult.ok) return authResult.response; // 401 / 403 / 404
  const { user, cls } = authResult;
  // ...
}
```

Rules:

- Use the signed-in user (`authResult.user.id`), never a user/student/professor ID sent by the client.
- ADMIN passes every role and ownership check.
- Routes called by the `study/` pipeline accept `isStudyServiceRequest(req)` as an alternative to a session.

---

## Typical call chains

**Material upload → RAG**

```text
POST /api/classMaterial/upload → storage/uploadToR2 → rag/vectorizeMaterial
  → ai/mistral (OCR) → rag/chunkMarkdown → rag/embedAndStore (Pinecone) → Prisma ClassMaterial
```

**Student asks the tutor a question**

```text
POST /api/agent-chat → agent/conversationService → agent/tutorAgent (invokeAgent)
  → tools (Pinecone search, in-chat assessment, visual lesson) → persist messages
```

**Pathway generation**

```text
POST /api/learning-paths/generate → pathways/generatePathway
  (course/topicMap + course/mastery from survey answers) → Gemini → LearningPathway + PathwayNode
```

---

## Conventions

- Import as `@/lib/<domain>/<file>`; file names are camelCase.
- Create provider clients only in `ai/`, `storage/r2.ts`, `rag/pinecone.ts` — import the shared instance elsewhere.
- Server code never calls this app's own API over HTTP; call the `lib` function directly.
- Keep secrets and provider SDKs out of client components.
- Never point the LangGraph agent at a Gemini model without checking the thought-signature notes in `ai/gemini.ts`.
- Add a row to the folder map when adding a new domain folder.

---

## Related docs

- Agent: [`agent/README.md`](./agent/README.md), [`../docs/features/agent-quickstart.md`](../docs/features/agent-quickstart.md)
- Surveys: [`../docs/features/survey-system.md`](../docs/features/survey-system.md)
- In-chat assessments: [`../docs/features/in-chat-assessment.md`](../docs/features/in-chat-assessment.md)
- Memory risks: [`../docs/features/agent-memory-management.md`](../docs/features/agent-memory-management.md)
- Schema: [`../prisma/README.md`](../prisma/README.md)
