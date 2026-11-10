# `scripts/` — One-off TypeScript utilities

Maintenance and manual test scripts for the Next.js app (not the Python study pipeline).

Hub: [`../README.md`](../README.md) · Study scripts: [`../study/scripts/README.md`](../study/scripts/README.md).

---

## Inventory

| File | Purpose |
|---|---|
| `migrate-surveys.ts` | Migrate legacy single-survey data → multi-survey model |
| `test-rag.ts` | Manual RAG / retrieval smoke test |

These are **not** wired into `package.json` scripts. Run with `npx tsx` / `ts-node` (or your preferred runner) after setting env vars, and only when you understand the side effects (especially migrations).

---

## Related

- Survey system: [`../SURVEY_SYSTEM_README.md`](../SURVEY_SYSTEM_README.md)
- Ad-hoc agent smoke test at repo root: `../test-simple-agent.js`
