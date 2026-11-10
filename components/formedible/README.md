# `components/formedible/` — Dynamic assessment forms

UI building blocks for **in-chat assessments** (Formedible + TanStack Form patterns).

Parent: [`../README.md`](../README.md) · Deep dive: [`../../inChatAssessment.md`](../../inChatAssessment.md) · Types/helpers: `../../lib/formedible/`.

---

## Layout

| Path | Purpose |
|---|---|
| `fields/` | Field widgets for generated assessment schemas |
| `layout/` | Form layout shells |

Consumed by `Lesson/AiLesson/InChatAssessmentForm.tsx` and related assessment flows. Prefer extending field types here rather than one-off forms inside the chat UI.
