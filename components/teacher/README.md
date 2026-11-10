# `components/teacher/` — Professor UI

Professor (DB role `PROFESSOR`) interface under `/teacher/*`.

Parent: [`../README.md`](../README.md).

---

## Layout

| Path | Purpose |
|---|---|
| Root (`SideBar`, `TopNav`, `CreateClassModal`, …) | App shell for teacher routes |
| `class/` | Per-class hub tabs: info, students, content, surveys/pathways, assessments |
| `assessments/` | Quiz builder, OCR import, preview/results/publish |

Class hub is driven by `/teacher/classes/[id]?tab=…`. Prefer `NewSurveyManagement` / related components over legacy `surveyManagement.tsx`.

Surveys & pathways product docs: [`../../SURVEY_SYSTEM_README.md`](../../SURVEY_SYSTEM_README.md).
