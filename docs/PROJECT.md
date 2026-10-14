# TarasLearn LMS — Project Overview

A multi-tenant **Learning Management System** for engineering education: React frontend, Express/MongoDB backend, JWT auth, S3/local file storage, quizzes, progress tracking, and a remote code lab.

> Last updated: as of the current repository state.

---

## 1. Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite 5, TypeScript, Leaflet (maps), lucide-react (icons), xlsx (Excel import/export) |
| Backend | Node.js (ES modules), Express 4, Mongoose 8 (MongoDB), JWT (`jsonwebtoken`), bcryptjs, helmet, express-rate-limit, xlsx |
| Storage | AWS S3 (presigned uploads) **or** local disk fallback (`server/uploads`) |
| Code Lab | Remote sandbox via Piston or Judge0 (`CODE_RUNNER_URL`) |
| Monorepo | npm workspaces (`client`, `server`) |

---

## 2. Repo layout

```
lms/
├─ package.json              # workspace root; dev/build/seed scripts
├─ README.md
├─ LMS_Portal_BRD_FRD.docx   # requirements doc
├─ docs/
│  └─ PROJECT.md             # this document
├─ client/                   # React + Vite frontend
│  └─ src/
│     ├─ api/client.ts       # single API wrapper (fetch + token)
│     ├─ context/AuthContext.tsx
│     ├─ data/constants.ts   # starter courses, curriculum, helpers
│     ├─ types.ts
│     ├─ components/         # AppLayout, AssetUploader, AssetTable, QuizPanel,
│     │                      # SidePanel, AdminStudentMap, profile fields…
│     ├─ pages/              # Home, Catalog, Course, Practice, Profile, Login, AdminPage
│     │  └─ teacher/         # TeacherDashboard, TeacherCourses, TeacherStudio
│     └─ globals.css
└─ server/
   └─ src/
      ├─ index.js            # Express app + middleware + route mounting
      ├─ models/             # User, College, Course, Asset, LessonProgress, QuizAttempt
      ├─ controllers/        # auth, course, user, college, asset, code,
      │                      # dashboard, progress
      ├─ routes/             # one file per resource (see API below)
      ├─ middleware/         # auth.js, limits.js (rate limits)
      ├─ services/           # storage.js (S3/local), codeRunner.js
      ├─ utils/              # access.js, scope.js, curriculum.js, helpers.js
      ├─ seed.js             # platform seed (admin + starter courses)
      ├─ seed-demo.js        # DEMOIT demo college/teacher/student
      ├─ migrate-colleges.js # backfill collegeId onto legacy data
      └─ test/               # node --test: access, scope, profile, progress
```

---

## 3. Roles & permissions

Four roles (`User.role`):

| Role | Scope | Can do |
|---|---|---|
| **admin** (super admin) | all colleges (`collegeId = null`) | everything: create colleges, manage all users/courses/content |
| **collegeAdmin** | one college | manage own college: departments, teachers/students, access, own college courses/content |
| **teacher** | one college (+ dept) | create/edit **own** courses, upload content to own courses, view students |
| **student** | one college + dept | view only courses their department is granted (or its teachers published), do lessons/quizzes |

Key rules:

- Auth is **JWT** (`Bearer`), 7-day expiry, with `tokenVersion` so password/role changes invalidate old tokens.
- New accounts get `mustChangePassword` → forced password change on first login.
- **No public signup flow**; admins create users. Email domain routes users to the right college portal.
- **Access is department-level only** (no per-student overrides).

---

## 4. Multi-tenancy & access control (the core design)

- `College` holds `name`, `code`, `state`, `domains[]`, and embedded **departments** (`{ name, code, active, allowedCourseIds[] }`).
- `Course.collegeId` and `Asset.collegeId`: a value = that college's content; `null` = **platform-wide** (visible to everyone).
- `utils/scope.js`:
  - `scopeToCollege(user)` — pins queries to the caller's college; unassigned non-super accounts **fail closed**.
  - `collegeVisibilityFilter(user)` — includes the caller's college **plus** `null` (platform) content.
- `utils/access.js`:
  - `courseAccessFor(user, college)` — admin/teacher/collegeAdmin **unrestricted**; student limited to their department's `allowedCourseIds`, and only if college + dept are active.
  - `resolveCourseAccess(user)` — for a student, **unions** the department's granted slugs with **courses created by teachers of that same department** (so a faculty upload is auto-visible to its students).
  - `canManageCourse` / `canManageAsset` — admins all; teachers only their own (`createdBy`); college admins only their college's.
- Admin-only actions are guarded by `authRequired(["admin", "collegeAdmin"])` etc. in the route files.

---

## 5. Features

- Role-based dashboards (student home with real KPIs/streak; teacher studio; admin tabbed dashboard: Overview · Colleges · Departments & Access · Content Library · People · Student Geography).
- Course catalog with level filters and "By …" author labels.
- **Learning core**: per-lesson curriculum + **auto-graded quizzes** (server-graded, answers never sent to client) + progress % and streaks.
- **Content library**: MP4/WebM video + PDF/TXT/DOC/DOCX upload; streaming; short-lived download URLs.
- **Code Lab**: run Python/C/C++/Java via remote sandbox.
- **Bulk import** of users from Excel/CSV (upsert by email, one default password, forced change).
- **Interactive India map** of student locations.
- Weekly-goal tracking; profile management with role-specific fields.

---

## 6. Data models

- **User** — name, email, passwordHash, role, active, `mustChangePassword`, `tokenVersion`, `studentId`, `collegeId`, `departmentId`, `department`, `profile` (role-specific sub-docs), `weeklyGoal`.
- **College** — name, code, state, `domains[]`, `active`, `departments[]`.
- **Course** — title, slug, language, level, `collegeId`, `createdBy`, `createdByRole`, `curriculum[]` (backfilled default).
- **Asset** — title, kind (video/document), course (slug), mimeType, size, url, `objectKey`, `createdBy`, `collegeId`.
- **LessonProgress** — learner + course + lesson key + completed.
- **QuizAttempt** — learner + course + answers/score/passed.

---

## 7. API surface (`/api`)

```
auth      POST /login   GET /me   POST /complete-password   POST /register
courses   GET /   GET /mine   POST /   PUT /:id   DELETE /:id
users     GET /   POST /   POST /bulk   PUT /:id/department   DELETE /:id
          PUT /profile   GET|PUT /weekly-goal
colleges  GET /   POST /   PUT /:id   POST /:id/departments
          PUT /:id/departments/:departmentId/access   DELETE /:id
assets    GET /   POST /upload-ticket   PUT /raw/* (local)   GET /url/:id
          POST /   PUT /:id   DELETE /:id
progress  GET /   PUT /:courseId/:lessonId   GET /:courseId/quiz   POST /:courseId/quiz
teacher   GET /stats
dashboard GET /            (admin/collegeAdmin)
code      POST /           (rate-limited)
health    GET /api/health
```

---

## 8. File storage (local vs S3)

`server/src/services/storage.js` — `storageMode()` returns `"s3"` when `S3_BUCKET` is set, else `"local"`.

- **S3**: `POST /assets/upload-ticket` returns a **presigned POST** (enforces 100 MB cap + mime allowlist server-side); browser uploads directly to S3; downloads use **presigned GET** (900s) unless `S3_PUBLIC_BASE_URL` is set.
- **Local**: browser `PUT`s bytes to `/api/assets/raw/<key>`, served from `/uploads`.

---

## 9. Setup & run (the process)

```bash
# 1. install (workspace root)
npm install

# 2. configure env
cp server/.env.example server/.env      # set MONGODB_URI, JWT_SECRET, optional AWS S3

# 3. seed (optional)
npm run seed          # platform admin + starter courses
npm run seed:demo     # DEMOIT demo college + college admin/teacher/student

# 4. run
npm run dev           # server :5000 + client :5173 together
```

Root scripts: `dev`, `dev:server`, `dev:client`, `build`, `seed`, `start`.
Server scripts: `dev` (node --watch), `start`, `seed`, `seed:demo`, `migrate:colleges`, `test`.

---

## 10. Seeded accounts

| Account | Credentials |
|---|---|
| Super admin | `admin@taraslearn.com` / `Admin@12345` |
| College admin (DEMOIT) | `college.admin@demo.edu` / `College@2026` |
| Teacher (DEMOIT, CSE) | `teacher@demo.edu` / `Teacher@2026` |
| Student (DEMOIT, CSE) | `student@demo.edu` / `Student@2026` |
| Demo teacher (legacy) | `teacher@gmail.com` / `teacher@gmail.com` |
| Demo student (legacy) | `tripdaries01@gmail.com` / `Krishna@1234` |

---

## 11. Testing

`npm test` (in `server/`) runs `node --test test/` → **36/36 passing** (access, scope, profile, progress). Client build via `npm run build` (tsc + vite).

---

## 12. Environment variables (`server/.env`)

`NODE_ENV`, `PORT`, `MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGIN`, `CODE_RUNNER_URL`, `CODE_RUNNER_TOKEN`, and the S3 block: `S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, optional `PUBLIC_API_URL`, `S3_PUBLIC_BASE_URL`, `LOCAL_UPLOAD_DIR`. In production the server **refuses to start** without an explicit `CORS_ORIGIN` and `JWT_SECRET`.

---

## 13. Known doc drift / gaps

- `README.md` is slightly stale: it says `.env.example` files exist for both apps (only `server/.env.example` exists now) and lists admin as `admin@taraslearn.local` (actual seed is `admin@taraslearn.com`).
- `react-router-dom` is installed but unused — navigation is state-based in `AppLayout`.
