# Synapsed Agent - Quick Start

**Hub:** [README.md](./README.md) · **Architecture:** [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) · **Canonical agent docs:** [lib/agent/README.md](./lib/agent/README.md)

## Current State

Synapsed now runs a **single-memory multimodal agent**:

- text chat
- visual Excalidraw generation
- realtime voice interaction

All modalities share the same `threadId` and the same tutor policy in `lib/agent/simple-agent.ts`.

## Fast Mental Model

- **Realtime handles transport** (audio input/output, turn events)
- **`simple-agent` handles reasoning** (memory, tools, pedagogy)
- **ConversationService handles persistence** (user/assistant turns)

This avoids dual-brain drift and keeps behavior consistent.

## Main Endpoints

### `POST /api/agent-chat`
Text chat path:

```json
{
  "messages": [{ "role": "user", "content": "Explain derivatives" }],
  "threadId": "thread_...",
  "classId": "...",
  "lessonId": "...",
  "userId": "..."
}
```

Returns:
- `response`
- optional `diagramData`
- `threadId`

### `POST /api/session`
Realtime SDP proxy:
- browser sends offer SDP
- server forwards to OpenAI realtime
- server returns answer SDP

### `POST /api/voice-turn`
Voice turn commit path (authoritative memory write):

```json
{
  "transcript": "Can you show this visually?",
  "turnId": "turn-...",
  "threadId": "thread_...",
  "classId": "...",
  "lessonId": "...",
  "userId": "..."
}
```

Returns:
- `userText`
- `assistantText`
- optional `diagramData`
- `threadId`

## Tooling

Registered tools in `simple-agent.ts` include:

- `searchClassContent`
- `createInChatAssessment`
- `createVisualLesson`
- `getStudentProgress`
- `getClassResources`

## Reliability Behaviors

- Voice turn idempotency via required `turnId`
- Retry dedupe cache in `lib/agent/voice-turn-store.ts`
- Realtime barge-in: active assistant speech is canceled when user starts speaking

## Where To Edit

- Core policy + tool orchestration: `lib/agent/simple-agent.ts`
- Prompts (main + visual + audio): `lib/agent/prompts.ts`
- Visual generation tool: `lib/agent/tools/createVisualLesson.ts`
- Voice UI overlay: `components/Lesson/AiLesson/VoiceMode.tsx`
- Chat integration: `components/Lesson/AiLesson/ChatSection.tsx`

## Run

```bash
npm run dev
```

Make sure `.env` contains:
- `GEMINI_API_KEY`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
