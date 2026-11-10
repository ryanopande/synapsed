# `hooks/` — Shared React hooks

Client-side hooks used across SynapsEd UI.

Hub: [`../README.md`](../README.md) · Components: [`../components/README.md`](../components/README.md).

---

## Inventory

| File | Purpose |
|---|---|
| `useFlashDeck.ts` | Flashcard deck data via SWR |
| `use-formedible.tsx` | Formedible dynamic form helpers for in-chat assessments |
| `use-mobile.tsx` | Responsive / mobile breakpoint helper |
| `use-dropdown.ts` | Dropdown open/close state |
| `use-field-state.ts` | Field state helper for forms |

---

## When to add a hook here

- Logic is reused by **two or more** components.
- It is UI/state oriented (not server-only). Prefer `lib/` for server/domain logic.

Document new hooks in this table.
