# `app/` — Next.js App Router

Pages, layouts, and route handlers for SynapsEd. Business logic should stay in [`../lib/`](../lib/README.md); UI building blocks in [`../components/`](../components/README.md).

Parent hub: [`../README.md`](../README.md).

---

## What lives here

| Area | Path | Purpose |
|---|---|---|
| Root layout / landing | `layout.tsx`, `page.tsx`, `globals.css` | Session + theme providers; marketing landing |
| Auth / onboarding | `sign-in/`, `choose-role/`, `unauthorized/`, `waitlist-page/` | Google sign-in, role pick, errors, waitlist |
| Student | `student/**` | Dashboard, join-by-token, achievements, feedback, settings |
| Teacher (professor) | `teacher/**` | Dashboard, classes, assessments, settings |
| Class learning surface | `class/[classId]/**` | Survey → pathway → lessons → quizzes |
| APIs | `api/**` | See [`api/README.md`](./api/README.md) |

Only three nested layouts today: root, `teacher/layout.tsx`, `student/dashboard/layout.tsx`.

---

## Page map (product)

### Auth

| Route | File | Notes |
|---|---|---|
| `/sign-in` | `sign-in/page.tsx` | Google OAuth; redirect by role |
| `/choose-role` | `choose-role/page.tsx` | Sets role via `/api/set-role`, then re-auth |
| `/unauthorized` | `unauthorized/page.tsx` | Auth errors / forbidden |
| `/waitlist-page` | `waitlist-page/page.tsx` | Waitlist signup → `/api/waitlist` (Loops) |

### Student

| Route | File |
|---|---|
| `/student/dashboard` | `student/dashboard/page.tsx` (+ `StudentPageClient.tsx`) |
| `/student/join` | `student/join/page.tsx` |
| `/student/achievements` | `student/achievements/page.tsx` |
| `/student/feedback` | `student/feedback/page.tsx` |
| `/student/settings` | `student/settings/page.tsx` |

### Teacher (DB role: `PROFESSOR`)

| Route | File | Notes |
|---|---|---|
| `/teacher/dashboard` | `teacher/dashboard/page.tsx` | Counts classes/students/materials |
| `/teacher/classes` | `teacher/classes/page.tsx` (+ `ClassesClientPage.tsx`) | List |
| `/teacher/classes/[id]` | `teacher/classes/[id]/page.tsx` | Hub with `?tab=` (info, students, content, survey-path, quizzes) |
| `/teacher/assessments` | `teacher/assessments/**` | Quiz builder / preview |
| `/teacher/settings` | `teacher/settings/page.tsx` | Settings |

### Class (shared learning)

| Route | File | Notes |
|---|---|---|
| `/class/[classId]` | `class/[classId]/page.tsx` | Router: survey vs pathway |
| `/class/[classId]/survey` | `.../survey/page.tsx` | Student survey |
| `/class/[classId]/pathway` | `.../pathway/page.tsx` | React Flow pathway |
| `/class/[classId]/synapsed` | `.../synapsed/page.tsx` | Alternate/legacy pathway + assistant shell |
| `/class/[classId]/lesson/[nodeId]` | `.../lesson/[nodeId]/page.tsx` | Lesson hub (AI / content / flashcards) |
| `/class/[classId]/quizzes` | `.../quizzes/page.tsx` | Quiz list |
| `/class/[classId]/quiz/[quizId]` | `.../quiz/[quizId]/page.tsx` | Take quiz |
| `/class/[classId]/quiz/[quizId]/results` | `.../results/page.tsx` | Results |

---

## Class hub tabs (teacher)

`teacher/classes/[id]?tab=…` maps roughly to:

| `tab` value | Component domain |
|---|---|
| `class-info` | Class settings |
| `student-management` | Enrollments |
| `content-management` | Materials upload / management |
| `survey-learning-path` | Surveys + pathways |
| `quizzes-assessments` | Class quizzes |

Analytics tab may exist in comments / PRDs but is not the active default path.

---

## Auth middleware interaction

`middleware.ts` matches `/teacher`, `/student`, `/class` and `/admin` and applies the rules in `lib/auth/routes.ts`:

- Signed-out visitors → `/sign-in` (with a `callbackUrl` back to the page).
- Signed-in users without a role → `/choose-role`.
- Wrong role → `/unauthorized`. `/teacher` is professors only, `/student` students only, `/class` both; ADMIN passes everywhere.
- APIs are not middleware-gated; every route handler checks access with `lib/auth` (see [`api/README.md`](./api/README.md#access-control)).
- Client components read the session via `@/lib/auth/client`.

See [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).

---

## Conventions

- Prefer Server Components for data fetching on teacher dashboard-style pages; client components when interactivity is required (`*Client.tsx` pattern).
- Import UI from `@/components/...` and logic from `@/lib/...`.
- Keep route handlers thin — call into `lib/`.

---

## Related docs

- API map: [`api/README.md`](./api/README.md)
- Components: [`../components/README.md`](../components/README.md)
- Schema: [`../prisma/README.md`](../prisma/README.md)
