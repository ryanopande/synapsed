# `components/Synapses/` — Pathway graph UI

React Flow visualization of personalized learning pathways.

Parent: [`../README.md`](../README.md) · Student route: `/class/[classId]/pathway`.

---

## `Pathway/`

| File | Purpose |
|---|---|
| `PathwayDisplay.tsx` | Main graph container |
| `PathwayNode.tsx` | Custom node |
| `PathwayEdge.tsx` | Custom edge |
| `store.ts` | Zustand client state |
| `Pathway.css` | Graph-specific styles |

Data comes from pathway APIs (`/api/pathway/*`) and Prisma `LearningPathway` / `PathwayNode`. Generation rules: `lib/learning-paths` + `study/data/prompts/pathway_generation_spec.json`.
