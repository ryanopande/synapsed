# SynapsEd

**SynapsEd** is a personalized learning platform. Professors create classes, upload materials, publish surveys, generate approved learning pathways, and assign quizzes. Students join classes, complete surveys, follow a personalized pathway graph, and learn through an AI tutor that supports text chat, Excalidraw visuals, realtime voice, flashcards, PDF content, and in-chat assessments.

This README is the **handoff hub**. Read it first; then follow links into folder READMEs and deep-dive docs. You should be able to run, navigate, and extend the project without prior tribal knowledge.

---

## Table of contents

1. [What this project is](#what-this-project-is)
2. [Tech stack](#tech-stack)
3. [Prerequisites](#prerequisites)
4. [How to run](#how-to-run)
5. [Environment variables](#environment-variables)
6. [Product flow](#product-flow)
7. [Repository map](#repository-map)
8. [How agents / new teammates should navigate](#how-agents--new-teammates-should-navigate)
9. [Main architectural decisions](#main-architectural-decisions)
10. [Role naming gotchas](#role-naming-gotchas)
11. [Scripts](#scripts)
12. [Documentation index](#documentation-index)
13. [Known gaps / aspirational docs](#known-gaps--aspirational-docs)

---

## What this project is

SynapsEd (repo folder: `synapsed`) is a **Next.js App Router** application backed by **MongoDB (Prisma)** with:

| Capability | Where it lives |
|---|---|
| Google OAuth + role selection (Student / Professor) | `auth.ts`, `lib/authOptions.ts`, `/sign-in`, `/choose-role` |
| Class management, join tokens, materials | `app/teacher/*`, `app/api/class*`, `lib/r2` |
| Syllabus OCR → structure → RAG | `lib/rag`, `lib/ocr`, `lib/chunking`, `lib/pinecone`, `lib/syllabus` |
| Multi-survey + AI survey generation | `app/api/surveys/*`, `SURVEY_SYSTEM_README.md` |
| Personalized learning pathways (React Flow) | `lib/learning-paths`, `app/api/pathway/*`, `components/Synapses` |
| AI tutor (text / visual / voice, shared memory) | `lib/agent/*`, `AGENT_QUICKSTART.md` |
| Professor quizzes + student taking | `app/teacher/assessments`, `app/api/professor/*`, `app/api/student/*` |
| Phase 0 research pipeline (Python, offline eval) | [`study/`](./study/README.md) |

There is also a **Phase 0 study pipeline** under `study/` that validates pathway personalization with synthetic profiles and research-grade metrics. The TypeScript pathway prompt imports the same JSON spec used by that study.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript |
| Auth | NextAuth v5 (JWT) + Google OAuth + Prisma adapter |
| Database | MongoDB via Prisma 6 |
| AI orchestration | LangGraph + LangChain + Gemini (`simple-agent`) |
| Voice transport | OpenAI Realtime (WebRTC SDP via `/api/session`) |
| Visuals | Anthropic + Excalidraw MCP → Excalidraw canvas |
| RAG | Mistral OCR → page-aware chunking → Pinecone embeddings |
| Object storage | Cloudflare R2 (AWS S3 SDK) |
| UI | Tailwind, shadcn/ui (`components/ui`), BlockNote, xyflow, Zustand, SWR |
| Study / eval | Python 3 + Gemini generator + Claude judge (`study/`) |

---

## Prerequisites

- **Node.js 20+** and **npm**
- A **MongoDB** connection string (`DATABASE_URL`)
- Google OAuth credentials (for sign-in)
- API keys for the features you need (see [Environment variables](#environment-variables))
- For the research pipeline only: **Python 3** + `study/requirements.txt`

---

## How to run

### 1. Install

```bash
npm install
```

### 2. Environment

```bash
cp .env.example .env
```

Fill `.env` (never commit it). See [Environment variables](#environment-variables).

### 3. Prisma client

`npm run build` runs `prisma generate` automatically. For local generate only:

```bash
npx prisma generate
```

Optional demo seed (if you use it): `prisma/seed.ts`.

### 4. Dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Production

```bash
npm run build
npm run start
```

### 6. First-time troubleshooting

If you see missing `.next` chunk/module errors:

```bash
rm -rf .next
npm run dev
```

Deeper reset:

```bash
rm -rf .next node_modules
npm install
npm run dev
```

### 7. Study pipeline (separate)

```bash
cd study
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp env.example .env
```

Full pipeline and gates: [`study/README.md`](./study/README.md).

---

## Environment variables

Source of truth for keys: [`.env.example`](./.env.example). Study-specific keys: [`study/env.example`](./study/env.example).

### Minimum to sign in and open the app

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | MongoDB for Prisma + NextAuth |
| `NEXTAUTH_URL` | Auth base URL (e.g. `http://localhost:3000`) |
| `AUTH_SECRET` | JWT / session secret |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `NEXT_PUBLIC_BASE_URL` | App base URL |

### Feature-minimum keys

| Feature | Variables |
|---|---|
| Text AI tutor | `GEMINI_API_KEY`, `GEMINI_AGENT_MODEL`, `GEMINI_MODEL`, `NEXT_PUBLIC_AI_PROVIDER` |
| Voice mode | `OPENAI_API_KEY` |
| Visual Excalidraw lessons | `ANTHROPIC_API_KEY` |
| Class-grounded RAG | `PINECONE_API_KEY`, `PINECONE_INDEX_NAME`, optional `PINECONE_ENVIRONMENT` |
| File uploads | `R2_ENDPOINT`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_URL` |
| OCR / materials pipeline | `MISTRAL_API_KEY` (recommended) |
| Study Claude judge | `ANTHROPIC_API_KEY` in `study/.env` |

### Gemini model split (important)

- **`GEMINI_AGENT_MODEL`** (default `gemini-2.5-flash`) — **only** LangGraph agent (`lib/agent/simple-agent.ts`) because LangChain tool loops omit Gemini 3 `thoughtSignature`.
- **`GEMINI_MODEL`** (default `gemini-3-flash-preview`) — one-shot generation (pathways, surveys, flashcards, assessments, etc.).

Details: [`lib/gemini-model.ts`](./lib/gemini-model.ts), [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

---

## Product flow

```text
Professor                         Student
─────────                         ───────
Create class + joinToken    →     Join via /student/join
Upload materials / syllabus →     (materials vectorized to Pinecone)
Publish survey (ACTIVE)     →     Take survey in /class/[id]/survey
Generate + approve pathway  →     View pathway graph
Publish quizzes             →     Lesson nodes: AI tutor / content / flashcards / quizzes
```

Class entry (`/class/[classId]`) routes students to **survey** if not submitted, otherwise **pathway**.

---

## Repository map

| Path | Importance | README |
|---|---|---|
| [`app/`](./app/README.md) | All pages + API routes (Next.js App Router) | Yes |
| [`app/api/`](./app/api/README.md) | HTTP API surface for UI and study tooling | Yes |
| [`components/`](./components/README.md) | React UI by domain (teacher, student, lesson, pathway) | Yes |
| [`lib/`](./lib/README.md) | Business logic, AI, RAG, auth helpers, types | Yes |
| [`lib/agent/`](./lib/agent/README.md) | Canonical multimodal tutor architecture | Yes (existing) |
| [`prisma/`](./prisma/README.md) | MongoDB schema + seed | Yes |
| [`hooks/`](./hooks/README.md) | Shared React hooks | Yes |
| [`scripts/`](./scripts/README.md) | One-off TS maintenance / manual tests | Yes |
| [`diagrams/`](./diagrams/README.md) | Mermaid sequence docs (voice + visual) | Yes |
| [`public/`](./public/README.md) | Static assets (logos) | Yes |
| [`study/`](./study/README.md) | Phase 0 Python research / evaluation pipeline | Yes |
| [`docs/`](./docs/ARCHITECTURE.md) | Cross-cutting architecture & decisions | Architecture doc |
| Root `*.md` | Feature deep-dives and PRDs | See [Documentation index](#documentation-index) |

Root config files you will touch often:

| File | Role |
|---|---|
| `package.json` | Scripts + dependencies |
| `auth.ts` | NextAuth export (`handlers`, `auth`, `signIn`, `signOut`) |
| `middleware.ts` | Role gates for `/teacher` and `/student` (see caveats below) |
| `next.config.ts` | Next config |
| `tailwind.config.ts` | Design tokens / ambient backgrounds |
| `tsconfig.json` | Path alias `@/*` → project root |
| `components.json` | shadcn config |

---

## How agents / new teammates should navigate

Use this decision tree every time:

### “I need to run or configure the app”

1. This README → [How to run](#how-to-run) + [Environment variables](#environment-variables)
2. `.env.example` (and `study/env.example` if research)

### “I need to change a page / route”

1. [`app/README.md`](./app/README.md) — page map
2. Open the matching `app/.../page.tsx`
3. UI pieces live in [`components/`](./components/README.md)

### “I need to change an API”

1. [`app/api/README.md`](./app/api/README.md) — endpoint map
2. Implementation usually calls into [`lib/`](./lib/README.md)

### “I need to change the AI tutor”

1. [`AGENT_QUICKSTART.md`](./AGENT_QUICKSTART.md) (ops mental model)
2. [`lib/agent/README.md`](./lib/agent/README.md) (architecture)
3. Edit points: `lib/agent/simple-agent.ts`, `lib/agent/prompts.ts`, `lib/agent/tools/*`
4. Sequence diagrams: [`diagrams/`](./diagrams/README.md)

### “I need surveys / pathways”

1. [`SURVEY_SYSTEM_README.md`](./SURVEY_SYSTEM_README.md)
2. [`lib/learning-paths/`](./lib/README.md) + `study/data/prompts/pathway_generation_spec.json`
3. UI: `components/teacher/class/*`, `components/Synapses/Pathway/*`

### “I need in-chat assessments”

1. [`inChatAssessment.md`](./inChatAssessment.md)
2. `lib/formedible/`, `components/formedible/`, `components/Lesson/AiLesson/InChatAssessmentForm.tsx`

### “I need the data model”

1. [`prisma/README.md`](./prisma/README.md)
2. `prisma/schema.prisma` (source of truth)

### “I need Phase 0 research / eval”

1. [`study/README.md`](./study/README.md)
2. Then `study/scripts/`, `study/lib/`, `study/data/` READMEs

### “I need why something was built this way”

1. [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
2. Feature-specific root docs (agent, survey, memory drawbacks)

**Rule of thumb:** pages in `app/` → UI in `components/` → logic in `lib/` → persistence in `prisma/`. APIs under `app/api/` are thin adapters.

---

## Main architectural decisions

Full write-up: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md). Short list:

1. **Single tutor brain** — text, visual, and voice all reason through `lib/agent/simple-agent.ts` with one `threadId`.
2. **Voice Option 2** — OpenAI Realtime is transport only; authoritative turns go through `/api/voice-turn` → `invokeAgent`.
3. **Dual memory stores** — LangGraph MongoDB checkpointer + Prisma `Conversation`/`Message` (see `MEMORY_MANAGEMENT_DRAWBACKS.md`).
4. **Gemini model split** — agent model vs one-shot model (thought signatures / LangChain limitation).
5. **Pathway prompt shared with study** — `lib/learning-paths/pathwayPrompt.ts` imports `study/data/prompts/pathway_generation_spec.json`.
6. **RAG pipeline** — upload to R2 → Mistral OCR → chunk by page → Pinecone → mark material vectorized.
7. **Middleware matcher is narrow** — only `/admin`, `/teacher`, `/student` are matched; `/class/*` and `/api/*` are not middleware-gated by that matcher (APIs must enforce auth themselves).
8. **URL vs enum naming** — DB role is `PROFESSOR`; UI routes use `/teacher`.

---

## Role naming gotchas

| Concept | Value |
|---|---|
| Prisma `Role` | `STUDENT` \| `PROFESSOR` \| `ADMIN` |
| Professor UI prefix | `/teacher/...` (not `/professor`) |
| First login | `role` often `null` → `/choose-role` → `/api/set-role` → sign out → sign in (JWT refresh) |
| Middleware | Protects `/teacher` and `/student`; `/admin` paths are referenced but no `app/admin` tree exists today |

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next.js development server |
| `npm run build` | `prisma generate` + production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint |

There is **no** npm test suite wired in `package.json`. Ad-hoc checks: `test-simple-agent.js`, `scripts/test-rag.ts`.

---

## Documentation index

### Start here / operations

| Doc | Use when |
|---|---|
| **This README** | Orientation, run, navigation |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Cross-cutting decisions |
| [`AGENT_QUICKSTART.md`](./AGENT_QUICKSTART.md) | Edit the multimodal agent quickly |
| [`lib/agent/README.md`](./lib/agent/README.md) | Agent architecture (canonical) |

### Feature deep-dives (implemented)

| Doc | Use when |
|---|---|
| [`SURVEY_SYSTEM_README.md`](./SURVEY_SYSTEM_README.md) | Surveys + pathway management |
| [`inChatAssessment.md`](./inChatAssessment.md) | Formedible in-chat assessments |
| [`IMPLEMENTATION_SUMMARY.md`](./IMPLEMENTATION_SUMMARY.md) | Survey/pathway delivery checklist |
| [`MEMORY_MANAGEMENT_DRAWBACKS.md`](./MEMORY_MANAGEMENT_DRAWBACKS.md) | Dual persistence risks |
| [`diagrams/diagram-feature.md`](./diagrams/diagram-feature.md) | Visual lesson sequence |
| [`diagrams/voice-feature.md`](./diagrams/voice-feature.md) | Voice WebRTC → voice-turn sequence |
| [`study/README.md`](./study/README.md) | Phase 0 research pipeline |

### Product / PRD (partially aspirational)

| Doc | Status |
|---|---|
| [`PROFESSOR_ANALYTICS_FEATURES.md`](./PROFESSOR_ANALYTICS_FEATURES.md) | Proposed analytics — much of this is **not** shipped (analytics tab commented out) |
| [`PROFESSOR_ASSESSMENT_DASHBOARD_PRD.md`](./PROFESSOR_ASSESSMENT_DASHBOARD_PRD.md) | PRD for professor in-chat assessment dashboard |

Treat PRD/analytics docs as **intent**, not as a guarantee of current UI.

---

## Known gaps / aspirational docs

- Agent tools `getStudentProgress` / `getClassResources` are stubs (hardcoded strings), not live DB queries.
- Voice turn dedupe cache is **in-memory** (`lib/agent/voice-turn-store.ts`) — not multi-instance safe.
- `/class/*` is not in the middleware `matcher`; rely on page/API auth checks.
- No formal automated test suite in npm scripts.
- Landing page only mounts navbar + hero; other landing sections exist but are commented out.

---

## License / ownership

Private project (`"private": true` in `package.json`). Coordinate access to MongoDB, R2, Pinecone, and AI provider accounts separately from this repo.
