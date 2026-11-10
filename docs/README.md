# `docs/` — Project documentation

Cross-cutting and feature documentation. Folder-level guides live next to the code (`app/README.md`, `lib/README.md`, `components/README.md`, …).

Hub: [`../README.md`](../README.md).

---

## Architecture

| File | Purpose |
|---|---|
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Main technical decisions: auth, AI tutor, RAG, pathways |

## Features

| File | Covers |
|---|---|
| [`features/agent-quickstart.md`](./features/agent-quickstart.md) | Working on the AI tutor: where to edit what |
| [`features/agent-memory-management.md`](./features/agent-memory-management.md) | Tutor memory design and its drawbacks |
| [`features/in-chat-assessment.md`](./features/in-chat-assessment.md) | Agent-generated assessments (Formedible) |
| [`features/survey-system.md`](./features/survey-system.md) | Multi-survey system and pathway generation |
| [`features/professor-analytics.md`](./features/professor-analytics.md) | Professor analytics features |
| [`features/visual-lesson-diagrams.md`](./features/visual-lesson-diagrams.md) | Sequence: visual lesson generation (agent → Claude/Excalidraw → canvas) |
| [`features/voice-mode.md`](./features/voice-mode.md) | Sequence: voice WebRTC (`/api/session`) → transcript commit (`/api/voice-turn`) → shared agent memory |

## Product

| File | Covers |
|---|---|
| [`product/professor-assessment-dashboard-prd.md`](./product/professor-assessment-dashboard-prd.md) | PRD: professor assessment dashboard |
| [`product/implementation-summary.md`](./product/implementation-summary.md) | Historical summary of the survey system implementation |

Research pipeline docs live in [`../study/README.md`](../study/README.md).
