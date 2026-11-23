# Study 1 setup runbook (researchers only)

Everything here runs on your own laptop against a **local study database**. The study never touches Atlas.

| Piece | Where |
|---|---|
| Study database | MongoDB on port **27019**, data in `~/synapsed-study-db`, database `synapsed_study1` |
| App settings for the study | `.env.local` in the repo root (overrides `.env`; delete it to go back to the old database) |
| Educator | one Google account, signed in at `http://localhost:3000` |

## 1. Start the study database (once per reboot)

```
cd ~/Desktop/synapsed
bash study/study1_instructor/start_study_db.sh
```

## 2. Start the app

Free port 3000 first if something is using it (`lsof -nP -iTCP:3000 -sTCP:LISTEN`, then `kill <pid>`). Then:

```
npm run dev
```

It reads `.env.local`, so it uses the study database. Check the first lines of the terminal: `Environments: .env.local, .env`.

## 3. Create the educator account (once)

1. Open `http://localhost:3000` and sign in with the Gmail account you will use as the educator.
2. Choose the **Professor** role.
3. **Sign out and sign in again.** The role only takes effect on the next sign-in.

The instructor taking part in the study does not need an account: you sign in and share your screen (or hand over the laptop).

## 4. Create the class, the 12 simulated students, and attach the syllabus (once)

In a second terminal, from the repo root:

```
bash study/study1_instructor/setup_study_class.sh <the Gmail you signed in with>
```

It prints the class id and a link. Safe to re-run: it never creates a second class.

## 5. Generate the pathways (START THIS TONIGHT)

Go to the class > **Learning Paths** > **Student Progress** > **Generate**.
Do **not** use the survey page's batch button (older prompt, falls back to a different syllabus).

**What the session really needs** (do these first, with explanations):

1. `amal_r`, the walkthrough learner.
2. `lina_m`, `omar_k`, `daniel_w`, the three core cases.

The others are only there so the roster looks like a real class: `mei_t` and `sara_b` (the fairness pair, optional) and six fillers. Generate them AFTER the four above, and only if time allows. Instructors will only open the learners you show them.

**Generate a few students at a time, not all 12.** The screen waits until the batch is done and shows no progress.

**Gemini can be very slow when it is busy.** In rehearsal it was overloaded ("503 high demand") and the explanation step alone took minutes per pathway (19 minutes for three in the worst case). The app retries automatically and rotates between Gemini models, so a busy spell slows it down instead of failing a student, but plan for it:
- Start the first four **tonight**, not tomorrow morning.
- If it is very slow, generate students WITHOUT explanations to get the pathways quickly: stop the app, start it with `PATHWAY_EXPLANATIONS=off npm run dev`, generate, then restart normally and add explanations in step 6.
- If a student fails, generate that student again.

Optional settings (in `.env.local`):
- `GEMINI_NO_FALLBACK=1`: use only `GEMINI_MODEL` (when every pathway must come from one model; slower when it is busy).
- `GEMINI_FALLBACK_MODEL=<name>`: add a model to the rotation.

Note which model produced the pathways (`GEMINI_MODEL`) in your study record. When a fallback model answered, the server terminal shows a `[GEMINI_RETRY] ... answered by fallback model` line.

## 6. Add and check the explanations

Every pathway you will show should have **Why this pathway** and **Why this node** in the preview. To list the ones that don't, and to write them (one at a time, safe to re-run, changes no pathway):

```
bash study/study1_instructor/explain_missing.sh --dry-run     # only list what is missing
bash study/study1_instructor/explain_missing.sh               # write them
```

Do this BEFORE you freeze in step 8, so the explanations are part of the snapshot. If it says FAILED for a student, just run it again.

## 7. Review the three core cases

Open each of `lina_m`, `omar_k`, `daniel_w` and compare with `README_researchers_only.md` (the case key). If a case misses its intended property, regenerate it and note every attempt.

## 8. Freeze, and restore before every participant

IMPORTANT: always give node BOTH env files, in this order. `.env` alone points at Atlas; `.env.local` (listed last) overrides it with the study database.

```
node --env-file=.env --env-file=.env.local study/study1_instructor/pathway_snapshot.mjs export <classId> frozen.json
```

Before each participant (it wipes ALL pathways in the class and puts the frozen ones back as pending):

```
node --env-file=.env --env-file=.env.local study/study1_instructor/pathway_snapshot.mjs restore <classId> frozen.json
```

After each participant, **export again** under a new name (e.g. `p01_after.json`). That keeps what they changed, plus the edit log.

## 9. If something goes wrong

- **Sign-in fails:** the Google account must be allowed to log in to this app (test users), and `NEXTAUTH_URL` is `http://localhost:3000`.
- **No class shown after setup:** the class belongs to the Google account in step 3; sign in with that exact account.
- **Regenerate fails:** Gemini was busy; retry. Your pathway is no longer deleted when it fails.
- **Port 3000 busy:** see step 2.
- **Go back to the old database:** stop the app, delete `.env.local`, restart.
