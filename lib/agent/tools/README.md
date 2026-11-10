# `lib/agent/tools/` — Tutor tool implementations

Tools bound into `simple-agent.ts`. Keep tool schemas and prompts aligned with `../prompts.ts`.

Parent agent docs: [`../README.md`](../README.md).

---

## Tools

| Tool | Status | Purpose |
|---|---|---|
| `searchClassContent` | Live | Pinecone RAG over class materials |
| `createInChatAssessment` | Live | Generate Formedible understanding checks |
| `createVisualLesson` | Live | Anthropic + Excalidraw MCP → `diagramData` |
| `getStudentProgress` | **Stub** | Returns hardcoded helper text — not real DB progress |
| `getClassResources` | **Stub** | Returns hardcoded helper text — not real resources list |

When replacing stubs, wire to Prisma models (`NodeProgress`, materials, etc.) and update [`../README.md`](../README.md) + [`../../../AGENT_QUICKSTART.md`](../../../AGENT_QUICKSTART.md).
