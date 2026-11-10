# `components/lesson/` — Lesson experience UI

Student lesson surface for a pathway node: AI tutor, content/PDF, and flashcards.

Parent: [`../README.md`](../README.md) · Route: `/class/[classId]/lesson/[nodeId]` (`app/class/[classId]/lesson/[nodeId]/page.tsx`).

---

## Subfolders

| Path | Purpose |
|---|---|
| `tutor/` | Multimodal tutor: chat, voice, Excalidraw, notes editor, in-chat assessments |
| `content/` | PDF / content viewing, annotations, notes, content references |
| `flashcards/` | Flashcards panel (parked: commented out in the lesson page) |
| `LessonNoteContext.tsx` | Lesson notes state shared by the tutor and content tabs |

---

## `tutor/` key files

| File | Talks to |
|---|---|
| `ChatSection.tsx` | `POST /api/agent-chat`, `/api/conversations/*` |
| `VoiceMode.tsx` | `POST /api/session`, `POST /api/voice-turn` |
| `ExcalidrawCanvas.tsx` | Renders `diagramData` from the agent |
| `InChatAssessmentForm.tsx` | Formedible + `/api/in-chat-assessment/*` |
| `NotesEditor.tsx` | Lesson notes / BlockNote (+ `/api/editorAi`) |
| `AiLessonLayout.tsx` | Tutor tab layout |

## `content/` key files

| File | Role |
|---|---|
| `ContentPage.tsx` | Content tab entry: document sidebar, PDF viewer, notes |
| `AnnotationContext.tsx` | Annotation state; talks to `/api/documents`, `/api/content-references`, `/api/hotspot-notes` |
| `PdfViewer.tsx` / `PdfViewerClient.tsx` | react-pdf viewer |
| `DocumentSidebar.tsx`, `NotesPanelClient.tsx`, `ContentReferenceDisplay.tsx`, `ResizablePane.tsx` | Content tab panels |

Agent architecture: [`../../lib/agent/README.md`](../../lib/agent/README.md) · Sequences: [`../../docs/features/voice-mode.md`](../../docs/features/voice-mode.md), [`../../docs/features/visual-lesson-diagrams.md`](../../docs/features/visual-lesson-diagrams.md).
