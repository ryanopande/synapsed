# `components/` — React UI

UI grouped by product area. Pages under `app/` compose these components; data goes through `app/api` routes and `lib/`.

Hub: [`../README.md`](../README.md) · Pages: [`../app/README.md`](../app/README.md).

---

## Folder map

| Folder | Audience | Purpose |
|---|---|---|
| `landing/` | Public | Navbar, hero, and parked landing sections (commented out in `app/page.tsx`) |
| `lesson/` | Student | Lesson page: [`tutor/`](./lesson/README.md), `content/`, `flashcards/`, `LessonNoteContext.tsx` |
| `pathway/` | Student, professor | React Flow pathway graph, its Zustand store, and the pathway-page `AIAssistant` |
| `student/` | Student | `StudentSidebar`, `dashboard/` (dashboard, course cards, class tabs), `quizzes/` (quiz list/card/view/results) |
| `teacher/` | Professor | `layout/` (sidebar, top nav), `classes/` (create class), `class/` (per-class hub), `assessments/` (quiz builder and results) |
| `forms/` | Shared | Formedible dynamic-form `fields/` and `layout/` used by in-chat assessments |
| `rich-text/` | Shared | BlockNote display/editor wrappers (quiz questions) |
| `providers/` | Shared | App-wide providers (`ThemeProvider`) |
| `ui/` | Shared | shadcn/ui primitives (managed by the shadcn CLI) |

---

## Lesson page — `lesson/`

Route `/class/[classId]/lesson/[nodeId]`.

| Path | Role |
|---|---|
| `tutor/AiLessonLayout.tsx` | Tutor tab layout |
| `tutor/ChatSection.tsx` | Text chat ↔ `/api/agent-chat` |
| `tutor/VoiceMode.tsx` | Realtime voice ↔ `/api/session` + `/api/voice-turn` |
| `tutor/ExcalidrawCanvas.tsx` | Renders `diagramData` from the agent |
| `tutor/NotesEditor.tsx` | BlockNote lesson notes editor |
| `tutor/InChatAssessmentForm.tsx` | Renders agent-generated assessments |
| `content/ContentPage.tsx` | PDF viewer, annotations and notes (`AnnotationContext.tsx` holds state) |
| `flashcards/FlashcardsPanel.tsx` | Flashcards tab (parked: commented out in the lesson page) |
| `LessonNoteContext.tsx` | Lesson notes state shared by the tutor and content tabs |

---

## Professor class hub — `teacher/class/`

Powers `/teacher/classes/[id]?tab=…`:

| Path | Tab / role |
|---|---|
| `ClassPageLayout.tsx` | Sidebar + top nav shell for the class hub |
| `ClassInfoSettings.tsx` | Class name, description, join code |
| `StudentManagement.tsx` | Roster, invites, feedback |
| `content/` | Materials: `ContentManagement`, `UploadSection`, `ContentView` |
| `surveys/` | `SurveyManagement`, `SurveyEditor` |
| `StudentProgressTable.tsx` | Survey responses and pathway approval |
| `ClassAssessmentsManagement.tsx` | Class quizzes |
| `ClassAnalytics.tsx` | Analytics |
| `dialogs/` | Invite, feedback, survey answers, pathway preview |

---

## Naming conventions

- Components: one component per file, **PascalCase** file named after its export (`ChatSection.tsx` exports `ChatSection`).
- Folders: lowercase, kebab-case for multiple words (`rich-text/`).
- Non-component modules (stores, contexts' helpers): camelCase (`pathwayStore.ts`).
- Exception: `ui/` keeps shadcn's kebab-case file names so `npx shadcn add` keeps working.
- Auth in client components: import from `@/lib/auth/client`, never `next-auth/react`.

---

## Related

- Hooks: [`../hooks/README.md`](../hooks/README.md)
- Types: `../lib/types/`
- In-chat assessments: [`../docs/features/in-chat-assessment.md`](../docs/features/in-chat-assessment.md)
- Surveys: [`../docs/features/survey-system.md`](../docs/features/survey-system.md)
