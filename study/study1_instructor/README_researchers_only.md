# SynapsEd Study 1: simulated learners (researchers only)

Do not show this file, the profile `description` fields, or the case labels to participants.
All 12 learners are fictional and were written by the research team. Tell participants this at the start.

## Files

| File | Purpose |
|---|---|
| `study1_profiles.json` | 12 learners in the `/api/study/seed` format (answers keyed by the 8 standard survey question IDs) |
| `seed_study1.py` | Creates the class, survey, students and responses through `/api/study/seed` |
| `pathway_snapshot.mjs` | Exports a frozen copy of the class's pathways and restores it before each session |
| `build_profiles.py` | Source of the profiles; re-run after editing to re-validate option strings |

## The class

| Learner (shown as "Study <id>") | Role in the session |
|---|---|
| amal_r | Walkthrough / practice only |
| lina_m, omar_k, daniel_w | The three core review cases (counterbalance order) |
| mei_t, sara_b | Pair: identical answers except learning style (class-level task) |
| jonas_e, priya_s, hugo_l, fatima_a, kenji_n, rosa_g | Rest of the class, so the roster looks like a real course |

## Case key (internal)

**lina_m: intended to fit (A).** Nursing student, "Very uncertain", no computing background, goals about patient safety and privacy.
The generation rules should give 3+ beginner nodes in block_01 before block_02 and 4+ ethics nodes (block_06).
Watch for: what evidence instructors use to accept it, and whether they would review every pathway this closely.

**omar_k: intended trade-off (B).** MPH student who wants both a technical RAG chatbot (block_05b) and an adoption plan for his manager (block_05a), plus health-equity ethics, with only about 4 hours a week.
The rules say to prioritise one of 05a/05b, so the system has to choose. Both choices are defensible.
Watch for: which track instructors prefer, how they tell the AI, and whether the time limit is respected.

**daniel_w: intended problem (C).** Finance student who rates himself "Very confident" and mentions neural networks, which triggers the rule "at most 1 block_01 node".
His own answer contains two misconceptions that block_01 and block_06 address ("ML = writing if-then rules"; "more data means no bias"). He also asks to skip ethics.
The self-report and the demonstrated knowledge disagree. This is the issue Phase 1 instructors raised (Pierre, Chenyu).
Watch for: whether instructors notice the misconception, what extra evidence they ask for, and whether "Regenerate with focus" fixes it.

**mei_t / sara_b: fairness pair.** By the generation spec, learning style must not change block structure, so the two block sequences should be identical with different wording.
Ask: should these two pathways differ, and what differences between students would be acceptable?

## Before the first session (checklist)

1. Use a separate test database or a class that is clearly marked as a study class. `reset=True` deletes pathways and survey responses in the target class.
2. Upload and process the AI literacy syllabus for the class first. Without a syllabus, the old batch route (`/api/pathway/generate/batch`) silently falls back to a probability-and-statistics syllabus.
3. Generate pathways from **Teacher > Student Progress > Generate** (`/api/learning-paths/generate`), which uses the shared prompt spec and block catalog. Do not use the survey page's batch button.
4. Read every generated pathway against the case key above. If a core case does not show its intended property, generate again and record every attempt. Do not edit pathways by hand without logging it.
5. Export the snapshot (`pathway_snapshot.mjs export`). Before each participant, `restore` it so everyone sees the same AI output.
6. Known differences to record: professor "Regenerate with focus" (`/api/pathway/professor/[classId]` POST) uses an older prompt without the block catalog, and it deletes the previous pathway. Export or screenshot before every regeneration.
7. Pathway nodes have no stored rationale, learning objective or source material. If you show an explanation, it must be a clearly labelled mockup.
8. Run one full mock session and time it.
