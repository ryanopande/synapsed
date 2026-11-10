# `components/` — React UI

Domain-organized UI for SynapsEd. Pages under `app/` compose these components; data/API calls often go through `app/api` + `lib`.

Hub: [`../README.md`](../README.md) · Pages: [`../app/README.md`](../app/README.md).

---

## Domain map

| Folder | Audience | Purpose |
|---|---|---|
| `landingPage/` | Public | Navbar, hero (other sections may be unused / commented in `app/page.tsx`) |
| `teacher/` | Professor | Shell: `SideBar`, `TopNav`, `CreateClassModal` |
| `teacher/class/` | Professor | Class hub: surveys, content, students, assessments tab, dialogs |
| `teacher/assessments/` | Professor | Quiz builder, OCR import, results, publish flows |
| `student/` | Student | Dashboard cards, survey screens, class tabs, quiz results |
| `Synapses/Pathway/` | Student (+ views) | React Flow pathway graph (`PathwayDisplay`, nodes/edges, Zustand `store`) |
| `Lesson/AiLesson/` | Student | Tutor chat, voice overlay, Excalidraw canvas, BlockNote editor, in-chat assessment form, layout |
| `Lesson/contentPage/` | Student | PDF / content viewing, notes panel, references |
| `Lesson/flashcard/` | Student | Flashcards panel |
| `assessments/` | Shared | Quiz list/card/view/notifications |
| `formedible/` | Shared | Dynamic form fields/layouts for in-chat assessments |
| `richtext/` | Shared | BlockNote wrappers (e.g. quiz questions) |
| `ui/` | Shared | shadcn/ui primitives (new-york style) |
| `magicui/` | Shared | Decorative / motion UI helpers |
| `material/` | Professor | Upload UI |
| Root files | Shared | e.g. `AIAssistant`, `AuthButtons`, xyflow helpers (`base-node`, handles), waitlist |

---

## Highest-traffic lesson UI

`components/Lesson/AiLesson/`:

| File | Role |
|---|---|
| `AiLessonLayout.tsx` | Lesson shell / mode layout |
| `ChatSection.tsx` | Text chat ↔ `/api/agent-chat` |
| `VoiceMode.tsx` | Realtime voice UX ↔ `/api/session` + `/api/voice-turn` |
| `ExcalidrawCanvas.tsx` | Renders `diagramData` from agent |
| `Editor.tsx` | BlockNote lesson editor |
| `InChatAssessmentForm.tsx` | Formedible assessment rendering |

Agent edit points also listed in [`../AGENT_QUICKSTART.md`](../AGENT_QUICKSTART.md).

---

## Pathway UI

`components/Synapses/Pathway/`:

- `PathwayDisplay.tsx` — main graph
- `PathwayNode.tsx` / `PathwayEdge.tsx` — custom React Flow elements
- `store.ts` — Zustand client state

---

## Teacher class hub

`components/teacher/class/` powers `/teacher/classes/[id]` tabs:

- `NewSurveyManagement.tsx`, `SurveyEditor.tsx`, `StudentProgressTable.tsx`
- `contentmanagement/` — materials
- `studentManagement.tsx`
- `ClassAssessmentsManagement.tsx`
- `ClassInfoSettings.tsx`
- Legacy: `surveyManagement.tsx` (prefer newer survey components)

Survey product docs: [`../SURVEY_SYSTEM_README.md`](../SURVEY_SYSTEM_README.md).

---

## Design system notes

- Primitives: `components/ui` via shadcn (`../components.json`).
- Prefer existing patterns (Radix + CVA + `cn()` from `@/lib/utils`) over new one-off kits.
- Ambient page backgrounds are often applied in `app/*/layout.tsx`, not inside every card.

---

## Conventions

- Colocate by **product domain**, not by technical type alone.
- Keep fetch/mutation logic thin; reuse `lib` and API routes.
- When adding a major domain folder, document it in this README.

---

## Related

- Hooks: [`../hooks/README.md`](../hooks/README.md)
- Types: `../lib/types/`
- In-chat assessments: [`../inChatAssessment.md`](../inChatAssessment.md)
