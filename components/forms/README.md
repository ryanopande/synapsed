# `components/forms/` — Dynamic assessment forms

UI building blocks for **in-chat assessments** (Formedible + TanStack Form patterns).

Parent: [`../README.md`](../README.md) · Deep dive: [`docs/features/in-chat-assessment.md`](../../docs/features/in-chat-assessment.md) · Types/helpers: `../../lib/formedible/`.

---

## Layout

| Path | Purpose |
|---|---|
| `fields/` | Field widgets for generated assessment schemas |
| `layout/` | Form layout shells |

Consumed by `components/lesson/tutor/InChatAssessmentForm.tsx` and related assessment flows. Prefer extending field types here rather than one-off forms inside the chat UI.
