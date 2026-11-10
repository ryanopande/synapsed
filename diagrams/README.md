# `diagrams/` — Sequence documentation

Mermaid (and related) sequence docs for multimodal features. Use these to understand **runtime order**, not folder layout.

Hub: [`../README.md`](../README.md) · Agent: [`../lib/agent/README.md`](../lib/agent/README.md).

---

## Files

| File | Covers |
|---|---|
| `diagram-feature.md` | Visual lesson generation (agent → Anthropic/Excalidraw → canvas) |
| `voice-feature.md` | Voice WebRTC (`/api/session`) → transcript commit (`/api/voice-turn`) → shared agent memory |

---

## Related code

- Visual tool: `lib/agent/tools/createVisualLesson.ts`
- Voice UI: `components/Lesson/AiLesson/VoiceMode.tsx`
- Voice API: `app/api/voice-turn`, `app/api/session`
