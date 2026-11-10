# `components/Lesson/` — Lesson experience UI

Student lesson surface for a pathway node: AI tutor, content/PDF, and flashcards.

Parent: [`../README.md`](../README.md) · Route: `/class/[classId]/lesson/[nodeId]` (`app/class/.../lesson/[nodeId]/page.tsx`).

---

## Subfolders

| Path | Purpose |
|---|---|
| `AiLesson/` | Multimodal tutor: chat, voice, Excalidraw, BlockNote editor, in-chat assessments |
| `contentPage/` | PDF / content viewing, notes, content references |
| `flashcard/` | Flashcards panel |

---

## `AiLesson/` key files

| File | Talks to |
|---|---|
| `ChatSection.tsx` | `POST /api/agent-chat` |
| `VoiceMode.tsx` | `POST /api/session`, `POST /api/voice-turn` |
| `ExcalidrawCanvas.tsx` | Renders `diagramData` from agent |
| `InChatAssessmentForm.tsx` | Formedible + assessment APIs |
| `Editor.tsx` | Lesson notes / BlockNote (+ editor AI) |
| `AiLessonLayout.tsx` | Mode shell |

Agent architecture: [`../../lib/agent/README.md`](../../lib/agent/README.md) · Sequences: [`../../diagrams/`](../../diagrams/README.md).
