# `components/teacher/` — Professor UI

Professor (DB role `PROFESSOR`) interface under `/teacher/*`.

Parent: [`../README.md`](../README.md).

---

## Layout

| Path | Purpose |
|---|---|
| `layout/` | App shell for teacher routes: `TeacherSidebar`, `TopNav` |
| `classes/` | Classes list helpers: `CreateClassModal` |
| `class/` | Per-class hub tabs: info, students, content, surveys/pathways, assessments, analytics |
| `assessments/` | Quiz builder, OCR import, preview/results/publish |

The class hub is driven by `/teacher/classes/[id]?tab=…`; see the tab table in [`../README.md`](../README.md#professor-class-hub--teacherclass).

Surveys & pathways product docs: [`../../docs/features/survey-system.md`](../../docs/features/survey-system.md).
