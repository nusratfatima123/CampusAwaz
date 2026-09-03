# CampusAwaz — Sprints 1–4

An AI-powered, privacy-first complaint platform for Pakistani university students.

**Sprint 1 scope:** landing page, authentication, and the full university
verification flow (email OTP + optional student-card OCR), plus RBAC, audit
logging and route guards.

**Sprint 2 scope:** complaint submission across all 8 SRS categories, three
privacy modes (identified / confidential / anonymous), multi-file evidence
uploads to a private Storage bucket, atomic per-university-per-year tracking
IDs, a student complaint dashboard with detail view, and the **protected
harassment & safety workflow** (sensitive cases visible only to explicitly
assigned handlers).

**Sprint 3 scope:** AI Complaint Assistant that helps students draft complaints
and suggests category/priority/department, admin smart-routing intake queue with
AI recommendations and human review, department routing map, and assignment
workflow.

**Sprint 4 scope:** admin dashboard with summary cards (open/assigned/in
review/overdue), complaint list with filters (category, status, priority, search),
complaint detail view with privacy-aware identity display, status timeline,
status transition validation, assignment workflow, student complaint tracking
page, notification system with center and bell badge, and audit logging for
all admin actions.

**Still out of scope (Sprint 5+):** escalation workflows, reopened status,
resolution evidence / Proof of Action, student feedback, analytics dashboards,
student support hub.

---

## 1. Tech stack

| Concern | Choice |
| --- | --- |
| Framework | Next.js 14 (App Router) |
| UI | React 18, TypeScript (strict), Tailwind CSS |
| Backend | Supabase (Postgres + Auth + Storage) |
| Supabase clients | `@supabase/supabase-js`, `@supabase/ssr` |
| Icons | `lucide-react` |
| Forms | Native React controlled inputs + HTML5 validation (no form library) |
| OTP hashing | `bcryptjs` |
| Node | 20+ |

---

## 2. Prerequisites

- **Node.js 20 or newer** (`node -v`)
- A **Supabase project** (free tier is fine) — https://supabase.com/dashboard

---

## 3. Setup

### 3.1 Install dependencies

```bash
cd app
npm install
```

### 3.2 Create `.env.local`

Copy the example file and fill in your Supabase credentials:

```bash
cp .env.local.example .env.local
```

| Variable | Where to find it | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | Safe for the browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` `public` key | Safe for the browser |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` key | **Server only. Never expose this to the client.** |
| `OCR_PROVIDER` | `mock` (default), `gemini` | `mock` needs no API key |
| `OCR_API_KEY` | Your Gemini key | Only needed when `OCR_PROVIDER=gemini` |
| `OCR_CONFIDENCE_THRESHOLD` | `0.75` | Below this, the upload still verifies but is flagged for manual review |
| `OTP_TTL_SECONDS` | `300` | How long a 6-digit code stays valid |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Used for auth redirect URLs |

> The service role key is only ever imported by `lib/supabase/admin.ts`, which is
> used exclusively from Route Handlers and server-side helpers.

### 3.3 Apply the database migrations

The Supabase CLI shipped at the time of writing (`2.116.0`) no longer provides
`supabase db execute`, so apply the migrations through the dashboard.

Run them **in order**:

1. Open your project → **SQL Editor** → **New query**.
2. Paste the entire contents of `supabase/migrations/001_initial.sql` → **Run**.
3. New query → paste `supabase/migrations/002_complaints.sql` → **Run**.

Both migrations are **idempotent** — re-running them is safe and will not error
on existing tables, constraints, policies, triggers or seed rows.

**Alternative (CLI, if you prefer):**

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

**What `001_initial.sql` creates:**

- Tables: `universities`, `profiles`, `roles`, `user_roles`,
  `user_verification`, `audit_logs`
- Row Level Security enabled on every table, with 17 policies
- A private Storage bucket `student-cards`, with per-user folder policies
- `handle_new_user()` trigger on `auth.users` → creates a profile and assigns
  the `student` (or `graduate`) role automatically
- `is_staff()` helper (`security definer`) used by staff-read policies
- Seed data: **8 universities** (LUMS, NUST, FAST-NU, UET Lahore, IBA Karachi,
  GIKI, COMSATS, ITU) with their allowed email domains, and **8 roles**

**What `002_complaints.sql` creates (Sprint 2):**

- Tables: `complaint_categories`, `complaints`, `complaint_evidence`,
  `complaint_status_history`, `complaint_privacy`, `sensitive_case_access`,
  `tracking_id_sequences`
- `generate_tracking_id(university_id, year)` — allocates
  `CA-{CODE}-{YYYY}-{SEQUENCE}` atomically via
  `INSERT … ON CONFLICT DO UPDATE … RETURNING` on `tracking_id_sequences`, so
  concurrent submissions can never collide. `EXECUTE` is **revoked from
  `public`/`anon`/`authenticated` and granted only to `service_role`**.
- Three `security definer` access helpers: `has_sensitive_case_access()`,
  `can_read_complaint()`, `can_see_complaint_identity()`
- Row Level Security enabled on all 7 tables, with **18 policies**. There are
  **no client-side INSERT/UPDATE/DELETE policies** — writes go exclusively
  through the service-role API routes. Sensitive complaints are reachable only
  via `has_sensitive_case_access()`; there is deliberately no admin bypass.
- A **private** Storage bucket `complaint-evidence` with per-user-folder insert
  and delete policies, and a select policy that also allows readers of a linked
  complaint
- `updated_at` triggers reusing Sprint 1's `public.touch_updated_at()`
- Seed data: the **8 SRS categories** — Academic, Facilities, Hostel, Financial,
  Administrative, **Safety & Harassment (`is_sensitive = true`)**, Mental Health,
  Other

### 3.4 Configure Supabase Auth

In Supabase → **Authentication** → **Providers** → **Email**:

- For the smoothest local testing, **disable "Confirm email"**. Otherwise new
  accounts must click a confirmation link before they can sign in.
- Under **URL Configuration**, add `http://localhost:3000/api/auth/callback` to
  the redirect allow-list.

### 3.5 Assign a sensitive-case handler (Sprint 2, required for the safety flow)

Harassment/safety complaints are **only** visible to handlers explicitly listed
in `sensitive_case_access`. `createComplaint()` fills that table automatically at
submission time by looking for a staff member at the reporter's university, in
this precedence order:

`female_focal_person` → `proctor` → `admin` → `counselor`

So each university needs **at least one** of those roles, or the complaint will
still be created and tracked but will sit unassigned in `submitted` status with
no handler able to open it.

Grant the role to an existing account via the SQL Editor:

```sql
insert into public.user_roles (user_id, role_id, university_id)
select
  u.id,
  (select id from public.roles where name = 'female_focal_person'),
  p.university_id
from auth.users u
join public.profiles p on p.id = u.id
where u.email = 'ffp@fast.edu.pk'
on conflict do nothing;
```

Swap `female_focal_person` for `proctor`, `admin` or `counselor` as needed. To
verify routing, submit a safety complaint as a student and check that a row
appears in `sensitive_case_access` for that handler.

---

## 4. Running

```bash
npm run dev            # http://localhost:3000
npm run build          # production build
npm start              # serve the production build
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit
npm run test:sprint2   # offline Sprint 2 QA harness (no Supabase needed)
```

`test:sprint2` first runs `qa:build`, which transpiles the two pure-logic modules
(`lib/validators.ts`, `lib/constants.ts`) to CommonJS in `.qa-build/` (gitignored)
so plain Node can require them. No test runner is installed — the harness uses
Node's built-in `node:assert/strict`.

---

## 5. Testing the OTP flow (important)

**Email delivery is deliberately out of scope for Sprint 1** (SRS §4.2). The
6-digit code is therefore **printed to the server console** rather than emailed.

1. Run `npm run dev` and keep the terminal visible.
2. Register an account, then walk through `/verify`.
3. On the **Email/OTP** step, enter an address on one of your university's
   allowed domains (e.g. `you@lums.edu.pk`) and press **Send OTP**.
4. Look at the **dev-server terminal**. You will see a line like:

   ```
   [CampusAwaz] Verification code for you@lums.edu.pk: 483920  (expires in 300s)
   ```

5. Type that code into the 6 boxes. It auto-submits when the last box is filled.

**OTP rules:** 6 digits, TTL from `OTP_TTL_SECONDS`, max **3 attempts** per
code, max **5 sends per hour** per user. Requesting a new code expires the
previous one. The hash is deleted from the database on successful verification.

### Testing the student-card OCR

With `OCR_PROVIDER=mock` (the default) no external service is called:

- Upload **any** JPG/PNG/WEBP/PDF under 5 MB → returns confidence **0.92**
  (above threshold) → status `verified`.
- Include **`lowconf`** anywhere in the filename (e.g. `card-lowconf.png`) →
  returns confidence **0.41** (below threshold) → still `verified`, but
  `needs_manual_review = true`, and the UI shows a "Needs Manual Review" badge
  plus a warning on the dashboard.

---

## 6. Testing the Sprint 2 complaint flows

All complaint reads and writes go through Route Handlers using the service-role
client. The browser never receives the service key and never talks to PostgREST
for complaint data.

### 6.1 Standard complaint (happy path)

1. Sign in as a **verified** student (unverified users are bounced to `/verify`).
2. Dashboard → **New complaint** → pick any non-sensitive category.
3. **Step 1 Describe** — title 8–140 chars, description 30–5000 chars.
4. **Step 2 Privacy** — choose Identified, Confidential or Anonymous.
5. **Step 3 Evidence** — optional. Max **5 files**, **5 MB each**, JPEG/PNG/WEBP/PDF only.
6. **Step 4 Review** — read everything back; each section has an **Edit** jump.
7. Submit → acknowledgement screen shows the tracking ID with a copy button.
8. The complaint appears on the dashboard and opens at
   `/complaints/CA-FAST-2026-00001`.

**Tracking ID format:** `CA-{UNIVERSITY_CODE}-{YYYY}-{SEQUENCE}` — e.g.
`CA-FAST-2026-00001`. The sequence is 5-digit zero-padded and restarts at 1 for
each university **and** each calendar year. Allocation is a single atomic
`INSERT … ON CONFLICT DO UPDATE … RETURNING` inside `generate_tracking_id`, so
parallel submissions cannot produce duplicates.

### 6.2 Harassment & safety (protected) flow

- Selecting **Safety & Harassment** from the category grid routes to
  `/complaints/new/safety`, never the standard form. Hand-typing
  `/complaints/new/safety_harassment` redirects there too — and so does *any*
  category with `is_sensitive = true`, so a sensitive case can never be filed
  through the standard form.
- The safety form defaults to and recommends **Confidential**, and adds an
  **immediate danger** checkbox plus an emergency-contacts alert.
- On submit the complaint is created with `is_sensitive = true`, priority
  `critical` when immediate danger is flagged (otherwise `high`), a
  `sensitive_case_access` row for the resolved handler, and status advanced to
  `assigned`.
- `immediate_danger` is surfaced only in the reporter's own view and in
  sensitive-case handler views.

**To verify access control** (needs a live project — see §3.5):

| Actor | Expected |
| --- | --- |
| Reporting student | can open their own sensitive case |
| Assigned `female_focal_person` | can read it |
| **Unassigned** `admin` / `hod` / `warden` | **cannot** read it (no bypass policy) |
| FFP at a different university | cannot read it |
| Another student | 404, identical copy to "does not exist" |

Non-owners and non-existent tracking IDs both return **404** with the same
wording, so a tracking ID's existence is never leaked.

### 6.3 Privacy modes

| Mode | Stored | Visible to handlers |
| --- | --- | --- |
| `identified` | real `student_id` | name + email |
| `confidential` | real `student_id` | identity revealed **only** to handlers listed in `complaint_privacy.exposed_to` |
| `anonymous` | real `student_id` (for the student's own tracking) | alias only, e.g. `Student-4F9A` — never the name |

The alias is derived from a UUID slice and exposes at most 4 hex characters.
Identity redaction is enforced server-side in `getAssignedSensitiveCases()`, not
just hidden in the UI.

### 6.4 Evidence & signed URLs

- Objects live in the **private** `complaint-evidence` bucket at
  `{userId}/{complaintId}/{uuid}.{ext}`.
- Files are validated **twice** — in `EvidenceUploader` (client) and again in the
  API route via `validateEvidenceSet` (server). Renaming `payload.exe` to
  `payload.jpg` is rejected because the MIME type is checked against an
  allow-list, not the extension.
- Download links are **1-hour signed URLs** minted on request by
  `GET /api/complaints/[trackingId]/evidence`. There are no public URLs.
- Confirm in Supabase → Storage that `complaint-evidence` shows **Private** and
  that pasting a raw object path in a browser returns an error.

### 6.5 API routes

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/complaints` | Submit (multipart: fields + evidence files) |
| `GET` | `/api/complaints` | List the caller's own complaints |
| `GET` | `/api/complaints/[trackingId]` | One complaint (owner only, else 404) |
| `GET` | `/api/complaints/[trackingId]/evidence` | 1-hour signed URLs |
| `POST` | `/api/complaints/evidence/upload` | Staged single-file upload |

All five require an authenticated **verified** student.

### 6.6 Audit events

Check `audit_logs` after submitting:

- `complaint.submitted` — every submission
- `complaint.privacy_changed` — when the mode is not `identified`
- `complaint.evidence_uploaded` — per uploaded file
- `complaint.sensitive_created` — harassment/safety cases only

`createComplaint()` has no cross-statement transaction available through
PostgREST, so it runs a compensating **rollback** on failure: it deletes the
complaint row (FK cascades clear the children) and removes any uploaded Storage
objects, leaving no orphans.

---

## 7. Verification state machine

```
unverified
   │  university + student type selected, OTP requested
   ▼
pending_email ──── email OTP confirmed ────► verified
   │
   │  (supplementary path)
   ▼
pending_card ──── card OCR completed ─────► verified
                    (low confidence → verified + needs_manual_review)

any state ──── admin rejection ───────────► rejected
```

Email/OTP is the **primary** path. The student card is **supplementary** and
never blocks access on its own. A below-threshold OCR result still grants
access — it only raises `needs_manual_review` so an administrator can revisit
it later.

---

## 8. Route guards (`middleware.ts`)

| Situation | Result |
| --- | --- |
| No session on `/dashboard`, `/verify`, `/pending`, `/profile`, `/complaints` | → `/login?next=…` |
| Unverified session on `/dashboard` or `/complaints` | → `/verify` (or `/pending` when a review is in flight) |
| Verified session on `/login` or `/register` | → `/dashboard` |
| Supabase env vars missing | protected routes → `/login?error=not_configured` |

Every `/complaints/*` page additionally re-checks `isVerified(profile)`
server-side, so the middleware is defence in depth rather than the only gate.

---

## 9. Project structure

```
app/
├── app/
│   ├── (public)/          landing, login, register
│   ├── (auth)/            dashboard, verify/*, pending, profile
│   │   └── complaints/     new (category grid), new/[categoryKey], new/safety,
│   │                       success, [trackingId] (+ loading / not-found)
│   ├── api/
│   │   ├── auth/callback, audit, verify/email(+confirm), verify/card
│   │   └── complaints/     route (POST list+create), [trackingId]/route,
│   │                       [trackingId]/evidence/route, evidence/upload/route
│   ├── globals.css
│   ├── layout.tsx
│   └── not-found.tsx
├── components/
│   ├── ui/                Button, Input, Card, Badge, Alert, Stepper, Toast, Logo, Spinner
│   ├── landing/           Hero, Features, HowItWorks, Categories, Resources, CtaBanner, Footer
│   ├── layout/            Navbar (public), NavShell (authenticated)
│   ├── auth/              LoginForm, RegisterForm
│   ├── verification/      UniversityPicker/Step, StatusSelector/Step, OtpForm,
│   │                      CardUploader, OcrPreview, VerificationStatusCard, VerifyStepShell
│   └── complaints/        ComplaintForm (shared 4-step), CategoryGrid, PrivacySelector,
│                          EvidenceUploader, ComplaintReview, ComplaintCard(+Skeleton),
│                          StatusTimeline, EvidenceGallery, TrackingIdDisplay
├── lib/
│   ├── supabase/          client, server, middleware, admin
│   ├── auth.ts            cached session/profile/role/verification helpers
│   ├── audit.ts           audit() — never throws
│   ├── ocr.ts             OCR adapter (mock | gemini)
│   ├── validators.ts      email/password/OTP/file/complaint/evidence validation
│   ├── verification.ts    state machine + progress
│   ├── rate-limit.ts      in-memory sliding window
│   ├── roles.ts           RBAC helpers
│   ├── complaints.ts      server-only: create/list/fetch, evidence, sensitive routing
│   ├── complaint-ui.ts    client-safe status/privacy/priority presentation maps
│   ├── tracking.ts        generateTrackingId() RPC wrapper + parse/validate
│   ├── constants.ts
│   └── cn.ts
├── types/database.ts      Supabase schema types
├── tests/sprint2.qa.js    offline QA harness (node:assert/strict)
├── middleware.ts
└── supabase/migrations/
    ├── 001_initial.sql
    └── 002_complaints.sql
```

> **Server/client boundary:** `lib/complaints.ts` imports the service-role admin
> client, so it must never be imported by a Client Component. All presentation
> constants Client Components need live in `lib/complaint-ui.ts` instead. Keeping
> these separate is what stops the service key from being bundled for the browser.

> **`types/database.ts` gotcha:** row shapes must be declared with
> `type X = { … }`, **never** `interface X { … }`. Supabase's `GenericSchema`
> constraint requires assignability to `Record<string, unknown>`, and an
> `interface` has no implicit index signature. Using `interface` silently
> degrades every query result to `never`.

---

## 10. Manual QA checklist

Run these against `npm run dev` after applying both migrations. The pure-logic
subset (validation bounds, tracking-ID format/uniqueness, alias shape, identity
redaction, simulated RLS decisions, handler routing) is already covered
automatically by `npm run test:sprint2`.

### Landing page
- [ ] Sticky navbar: logo + tagline, center links, EN/اردو toggle, Login + Get Started
- [ ] Hamburger menu opens on mobile (< 768px) and closes on link click
- [ ] Hero headline, both CTAs, and the "Anonymous • Secure • Fast Resolution" strip render
- [ ] Both hero CTAs navigate to `/register` and show the "Please register to continue" toast
- [ ] All 6 category cards + "View All Categories" behave the same way
- [ ] 4 "How It Works" steps show numbers 01–04; connecting arrows appear on desktop only
- [ ] Footer shows emergency contacts, help centre and social links
- [ ] No horizontal scrolling at 320px, 768px, 1024px, 1440px

### Registration & login
- [ ] Stepper advances details → university → student type → confirm
- [ ] Password shorter than 8 chars, or missing a letter or digit, is rejected
- [ ] Registering an existing email shows a friendly message with a login link
- [ ] `user.registered` appears in `audit_logs`
- [ ] Login with wrong credentials shows an inline error, not a crash
- [ ] Login as an unverified user lands on `/verify`; verified lands on `/dashboard`

### Verification
- [ ] `/verify` hub shows the 5-stage stepper and a status card
- [ ] University search filters by name, code and email domain
- [ ] Selecting a university writes `profiles.university_id` and audits `verification.university.selected`
- [ ] Selecting a status writes `profiles.student_type` and audits `verification.status.selected`
- [ ] `/verify/email` blocks with a prompt if no university is chosen yet
- [ ] An email on a non-allowed domain is rejected with the accepted domains listed
- [ ] OTP prints to the server console; entering it verifies the account
- [ ] A wrong code shows an error; the 4th wrong attempt is refused
- [ ] Requesting a new code invalidates the old one
- [ ] Waiting past `OTP_TTL_SECONDS` yields an "expired" error
- [ ] Card upload rejects a >5 MB file and an unsupported type (both client and server side)
- [ ] A normal upload shows per-field confidence badges and verifies
- [ ] A `lowconf` filename verifies but shows "Needs Manual Review"
- [ ] `student-cards` objects are stored under `<user_id>/<uuid>.<ext>` and the bucket is private

### Guards, RBAC & accessibility
- [ ] Visiting `/dashboard` while logged out redirects to `/login`
- [ ] Visiting `/dashboard` while unverified redirects to `/verify` or `/pending`
- [ ] Visiting `/login` while verified redirects to `/dashboard`
- [ ] NavShell shows the role badge and university; the Verify link disappears once verified
- [ ] Logout clears the session and audits `user.logout`
- [ ] `/profile` renders the stored details read-only
- [ ] Tab order is logical and every focused control shows a visible ring
- [ ] Icon-only buttons have `aria-label`s; toasts announce via `aria-live`
- [ ] A user cannot read another user's `profiles` / `user_verification` rows (RLS)

### Sprint 2 — complaint submission
- [ ] All **8 categories** appear on `/complaints/new` with icons and descriptions
- [ ] Each of the 7 non-sensitive categories can be submitted end-to-end
- [ ] Title under 8 or over 140 chars is rejected; description under 30 or over 5000 is rejected
- [ ] **Review** step reads back category, title, description, privacy mode and file list
- [ ] Each Review section's **Edit** link jumps back to the right step with data intact
- [ ] Submission returns a `CA-{CODE}-{YYYY}-{SEQUENCE}` tracking ID
- [ ] Two submissions in a row produce **consecutive, distinct** sequences
- [ ] The acknowledgement screen's copy button puts the tracking ID on the clipboard
- [ ] The new complaint appears on the dashboard and its detail page opens

### Sprint 2 — evidence
- [ ] A 6th file is refused with a clear "max 5 files" message
- [ ] A >5 MB file is refused (client **and** server)
- [ ] A `.exe` renamed to `.jpg` is refused (MIME allow-list, not extension)
- [ ] Duplicate file selections are de-duplicated rather than double-added
- [ ] Files can be removed before submit; nothing uploads until submit
- [ ] `complaint-evidence` shows **Private** in Supabase → Storage
- [ ] Evidence links are signed URLs that 400/expire after 1 hour
- [ ] A raw object path pasted into the browser is rejected

### Sprint 2 — privacy
- [ ] `identified` shows the student's real name on the detail page
- [ ] `anonymous` shows a `Student-XXXX` alias and **never** the real name
- [ ] `confidential` explains that only assigned handlers see the identity
- [ ] `complaint_privacy.anonymous_alias` is populated only for anonymous cases
- [ ] `complaint_privacy.exposed_to` is populated only for confidential cases

### Sprint 2 — harassment & safety
- [ ] Choosing Safety & Harassment lands on `/complaints/new/safety`, not the standard form
- [ ] Hand-typing `/complaints/new/safety_harassment` redirects to `/complaints/new/safety`
- [ ] The safety form defaults to Confidential and shows the emergency alert
- [ ] Checking **immediate danger** stores `priority = critical`
- [ ] Submitting creates `is_sensitive = true` and a `sensitive_case_access` row
- [ ] Status advances to `assigned` with two `complaint_status_history` rows
- [ ] The **assigned** `female_focal_person` can read the case
- [ ] An **unassigned** `admin` / `hod` / `hostel_warden` **cannot** read it
- [ ] An FFP at a different university cannot read it
- [ ] The FFP's list contains **only** her assigned cases
- [ ] `immediate_danger` never appears in a non-sensitive or unauthorized view

### Sprint 2 — API, audit & UI states
- [ ] `GET /api/complaints/{someone-elses-id}` returns **404**, not 403
- [ ] A non-existent tracking ID returns the **same** 404 copy (no existence leak)
- [ ] Unauthenticated calls to all 5 routes return 401
- [ ] An unverified student cannot reach any `/complaints/*` page or route
- [ ] `audit_logs` gains `complaint.submitted` on every submission
- [ ] `complaint.privacy_changed` appears for anonymous/confidential only
- [ ] `complaint.evidence_uploaded` appears once per file
- [ ] `complaint.sensitive_created` appears for safety cases only
- [ ] `view-source` / bundle search finds **no** service-role key on the client
- [ ] Dashboard shows skeletons while loading, then either cards or an empty state
- [ ] A failed submission shows an inline error and leaves no orphan row or object
- [ ] No horizontal scrolling on any complaint screen at 320 / 768 / 1024 / 1440px

---

## 11. Known limitations

### Sprint 1
- **No email delivery.** OTPs are printed to the server console by design.
- **Rate limiting is in-memory**, so it resets on restart and is per-process.
  A shared store (Redis / Postgres) is needed for multi-instance deploys.
- **Urdu toggle is visual only.** No i18n is wired up; all copy is English.
- **No admin UI.** Rejections and manual reviews must be actioned via SQL for now.
- **OCR `mock` provider returns deterministic fake data**; the `gemini` provider
  is implemented but untested without a live API key.

### Sprint 2
- **`002_complaints.sql` has not been executed against a live database.** No
  `psql`, Supabase CLI or Docker is available in this environment, so it was
  verified only by static analysis (balanced dollar-quotes, zero net paren depth,
  7 tables / 18 policies / 4 functions / 2 triggers). Apply it via the SQL Editor
  and re-run the manual QA checklist.
- **No transactions through PostgREST.** `createComplaint()` performs 6–8
  sequential writes and compensates with an explicit rollback (delete complaint +
  purge Storage objects) rather than a real `BEGIN … COMMIT`. A Postgres function
  or an Edge Function would be the durable fix.
- **Sensitive-case handlers must be seeded manually** (§3.5). There is no UI for
  assigning or reassigning handlers, and no reassignment flow at all.
- **No staff-facing case management UI.** `getAssignedSensitiveCases()` exists and
  is unit-tested for redaction, but there is no screen consuming it yet — a
  handler currently needs SQL or the Supabase dashboard to work a case.
- **`getStudentComplaints()` is unpaginated.** Fine for a demo; needs cursor
  paging once a student has hundreds of complaints.
- **Rate limiting is not applied to complaint submission**, so nothing stops a
  verified student from spamming submissions.
- **No AI triage, routing, notifications, escalation, resolution, feedback or
  analytics** — all deliberately deferred to Sprint 3+.
