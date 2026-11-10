# `hooks/` — Shared React hooks

Client-side hooks used across SynapsEd UI. File names are `useX`, matching the hook they export.

Hub: [`../README.md`](../README.md) · Components: [`../components/README.md`](../components/README.md).

---

## Inventory

| File | Purpose |
|---|---|
| `useFlashDeck.ts` | Flashcard deck data via SWR (used by the parked flashcards tab) |
| `useFormedible.tsx` | Formedible dynamic form helpers for in-chat assessments |
| `useIsMobile.tsx` | Mobile breakpoint helper (used by `components/ui/sidebar.tsx`) |

---

## When to add a hook here

- Logic is reused by **two or more** components.
- It is UI/state oriented (not server-only). Prefer `lib/` for server/domain logic.

Document new hooks in this table.
