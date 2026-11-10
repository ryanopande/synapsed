# Synapsed Agent

LangGraph-based tutoring agent for Synapsed with shared memory across text, visual, and voice interactions.

**Navigation:** [Root hub](../../README.md) · [Architecture decisions](../../docs/ARCHITECTURE.md) · [Ops quickstart](../../AGENT_QUICKSTART.md) · [Tools](./tools/README.md) · [Parent `lib/`](../README.md)

## Core Architecture

- **Single reasoning brain**: `lib/agent/simple-agent.ts` is the authoritative tutor logic.
- **Shared memory**: all turns use the same `threadId` in LangGraph checkpointer state.
- **Single persistence path**: conversation messages are stored through `ConversationService`.
- **Multimodal outputs**:
  - text responses
  - optional in-chat assessments
  - optional visual diagram payloads (`diagramData`)

## Current Tools

Defined in `lib/agent/tools` and registered in `simple-agent.ts`:

- `searchClassContent`: RAG search over class content
- `createInChatAssessment`: generated graded forms for understanding checks
- `createVisualLesson`: Excalidraw lesson generation (Anthropic + Excalidraw MCP)
- `getStudentProgress` / `getClassResources`: helper tools

## Prompts

Prompts are centralized in `lib/agent/prompts.ts`:

- main tutoring system prompt
- visual module prompt
- audio module prompt
- Excalidraw planner/teacher prompts

This keeps one unified tutoring policy while allowing modality-specific instructions.

## API Surface

- `POST /api/agent-chat`
  - Standard text chat path.
  - Calls `invokeAgent(...)` and persists user/assistant messages.
  - Returns text + optional `diagramData`.

- `POST /api/session`
  - WebRTC SDP proxy for OpenAI realtime voice.
  - Keeps `OPENAI_API_KEY` server-side.

- `POST /api/voice-turn`
  - Turn commit endpoint for realtime voice transcripts.
  - Calls `invokeAgent(...)` with the same `threadId`.
  - Persists user/assistant messages.
  - Returns `assistantText` + optional `diagramData`.
  - Requires `turnId` for idempotency.

## Voice Design (Option 2)

Voice UX uses OpenAI realtime for low-latency audio transport while keeping agent reasoning in `simple-agent`:

1. Browser streams audio via realtime.
2. Finalized transcript is posted to `/api/voice-turn`.
3. Backend invokes `simple-agent` with same `threadId`.
4. Assistant text is sent back and spoken via realtime.
5. Both voice user and assistant turns are appended to chat history.

## Reliability Notes

- `app/api/voice-turn` deduplicates retries using `turnId`.
- Dedup cache is currently in-memory (`lib/agent/voice-turn-store.ts`) with TTL.
- Realtime barge-in is handled by canceling in-progress assistant audio generation when user starts speaking.

## Direct Usage Example

```typescript
import { invokeAgent } from "@/lib/agent/simple-agent";

const response = await invokeAgent(
  "Explain the chain rule visually.",
  "thread_abc123",
  "class_id",
  "user_id",
  "conversation_id"
);

console.log(response.content, response.diagramData);
```
