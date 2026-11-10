# `lib/` — Domain logic

Server-side (and shared) business logic for SynapsEd. Route handlers in `app/api` and some Server Components should call into here rather than reimplementing pipelines.

Hub: [`../README.md`](../README.md) · Architecture: [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).

---

## Quick index

| Path | Purpose | Start here |
|---|---|---|
| `prisma.ts` | Singleton Prisma client | All DB access |
| `authOptions.ts` | NextAuth config (Google + JWT + roles) | Auth changes |
| `gemini-model.ts` | `GEMINI_MODEL` vs `GEMINI_AGENT_MODEL` split | Any Gemini usage |
| `utils.ts` | `cn()` Tailwind helper | UI classnames |
| `vectorization.ts` | Material → OCR → chunk → Pinecone | Upload pipeline |
| [`agent/`](./agent/README.md) | Multimodal tutor (LangGraph) | AI tutor work |
| `agent/tools/` | Tool implementations for the agent | RAG search, visuals, assessments |
| `pinecone/` | Embed + query vector store | Retrieval |
| `rag/` | Mistral OCR + vectorize variants | Materials / RAG APIs |
| `ocr/` | OCR from URL helpers | Vectorization |
| `chunking/` | Page-aware markdown chunking | RAG quality |
| `r2/` | Cloudflare R2 uploads | Files, quiz images, student docs |
| `syllabus/` | Extract / structure syllabus | Syllabus APIs |
| `survey/` | Survey context helpers for AI generation | Survey generate |
| `learning-paths/` | Pathway prompt builder (imports study JSON) | Pathway generation |
| `flashcard/` | Flashcard generation | Flashcard APIs |
| `Editor/` | BlockNote AI assist | `/api/editorAi` |
| `content/` | Annotations / content references services | Lesson content UI |
| `context/` | `LessonNoteProvider` React context | Lesson notes |
| `formedible/` | Dynamic form types/utils for in-chat assessments | Assessments |
| `types/` | Shared TypeScript types | Cross-cutting types |
| `utils/` | Extra util modules (if present) | Misc |

---

## Critical modules

### `agent/` (canonical)

Authoritative tutor. Do not invent a second “brain” for voice or visuals.

- `simple-agent.ts` — LangGraph + tools
- `prompts.ts` — system / visual / audio prompts
- `conversation-service.ts` — Prisma message persistence
- `voice-turn-store.ts` — in-memory idempotency for voice turns
- `tools/` — `searchClassContent`, `createInChatAssessment`, `createVisualLesson`, stubs for progress/resources

Docs: [`agent/README.md`](./agent/README.md), [`../AGENT_QUICKSTART.md`](../AGENT_QUICKSTART.md).

### `learning-paths/`

`pathwayPrompt.ts` builds prompts and function declarations from:

```text
study/data/prompts/pathway_generation_spec.json
```

Changing pathway personalization rules usually means updating that JSON **and** verifying the study evaluation still makes sense ([`../study/README.md`](../study/README.md)).

### `gemini-model.ts`

Never point the LangGraph agent at a Gemini 3 model without fixing thought-signature / tool-history serialization. Defaults and rationale are documented in the file header.

---

## Typical call chains

**Material upload → RAG**

```text
API upload → lib/r2 → OCR (lib/ocr|rag) → lib/chunking → lib/pinecone → Prisma ClassMaterial
```

**Student asks tutor a question**

```text
/api/agent-chat → ConversationService → invokeAgent(simple-agent)
  → tools (Pinecone search, assessment, visual lesson)
  → persist assistant message (+ optional diagramData)
```

**Pathway generation**

```text
/api/pathway/generate → learning-paths/pathwayPrompt (+ survey + syllabus context) → Gemini → LearningPathway + PathwayNode
```

---

## Conventions

- Import as `@/lib/...`.
- Keep secrets and provider SDKs here (or in API wrappers), never in client components.
- Prefer small focused modules over mega-files when adding new domains.
- Update this README when adding a new top-level `lib/<domain>/`.

---

## Related feature docs

- Surveys: [`../SURVEY_SYSTEM_README.md`](../SURVEY_SYSTEM_README.md)
- In-chat assessments: [`../inChatAssessment.md`](../inChatAssessment.md)
- Memory risks: [`../MEMORY_MANAGEMENT_DRAWBACKS.md`](../MEMORY_MANAGEMENT_DRAWBACKS.md)
- Schema: [`../prisma/README.md`](../prisma/README.md)
