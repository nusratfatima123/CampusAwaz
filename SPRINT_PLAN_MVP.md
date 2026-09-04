# CampusAwaz — MVP Sprint Plan
**Document:** Sprint Plan & SRS Traceability Matrix
**Version:** 1.0
**Date:** 2026-08-29
**Source of Truth:** SRS CampusAwaz v1.0 (28 August 2026)
**Cadence:** 6 Sprints × 1 week each (5-day hackathon MVP sprints)
**Target:** Complete core journey — *Verify → Protect → Report → AI Understands → Route → Track → Escalate → Prove → Resolve*

---

## A. MVP Scope Summary

### In Scope (per SRS §4.1)
- University + student/graduate registration and affiliation verification
- University email/OTP verification and student-card (AI/OCR) verification
- Identified / Confidential / Anonymous complaint privacy modes
- Universal complaint categories (academic, facilities, hostel, financial, admin, safety, harassment, etc.)
- AI Complaint Assistant (classification, priority, department, structured complaint generation)
- Evidence upload (student side + resolution side)
- Harassment & Safety protected workflow with Female Focal Person role
- Immediate-danger indication
- Smart Routing recommendations (AI-assisted) with admin override
- Complaint tracking (ID, status, timeline)
- Statuses: Submitted → Assigned → In Review → Action Taken → Resolved (+Escalated, Reopened)
- Escalation workflow with configurable response periods
- Proof of Action + resolution evidence
- Student feedback after resolution
- Student Support module (mental health, anonymous counseling, rights, policies/FAQs, emergency contacts)
- Role-based admin dashboards (Admin, HOD, Proctor, Female Focal Person, Hostel Warden, Counselor)
- Analytics (category, department, avg. resolution time, pending, escalated, resolution rate, recurring facility issues)
- Notifications on status change, case update, escalation, resolution (channel unspecified for MVP)
- Audit logging for sensitive actions
- Responsive web (desktop / tablet / mobile)

### Out of Scope (SRS §4.2 — confirmed excluded from MVP)
- Official live university database integration
- Official HEC integration
- SMS services
- Real-time campus security tracking
- Large-scale production deployment across universities

### Future Enhancements (SRS §4.3 / §25 — deferred by SRS itself)
- Official student-information-system integrations
- HEC integration
- Automatic external escalation
- SMS notifications
- Multi-university large-scale deployment
- Dedicated mobile app
- Student community features
- Advanced analytics
- AI Complaint Pattern Analysis (Future)
- AI Duplicate/Similar Complaint Detection (Future)

---

## B. Sprint Overview Table

| Sprint | Name | Objective | Key Deliverables | Dependencies |
|---|---|---|---|---|
| **S1** | Foundation, Auth & Verification | Establish project skeleton, RBAC, and verify a student's university affiliation | Next.js + Supabase scaffold, landing, registration, university selection, student/graduate status, email/OTP flow, student-card OCR, verification state, RBAC base, audit log schema | None |
| **S2** | Complaint Intake, Privacy & Evidence | Verified student can compose, protect, attach evidence, and submit a complaint | Complaint form, privacy selection, evidence upload, tracking ID, student dashboard, complaint list, Harassment/Safety protected workflow, Female Focal Person routing | S1 (verified user, storage, roles) |
| **S3** | AI Complaint Assistant & Smart Routing | AI understands, classifies, prioritizes, routes, and generates structured complaints; admin can override | AI service integration (LLM + OCR), classification/priority/department recommendation, structured complaint generation, smart routing UI, admin override, routing table | S1 + S2 (complaint schema, roles) |
| **S4** | Admin Dashboards, Tracking & Notifications | University staff can manage, assign, and update complaints; students can track progress; notifications fired | Admin dashboard, complaint management, complaint details, status transitions, assignment, timeline, notifications (status update / case update / resolution), student tracking page | S1 + S2 + S3 (complaints, routing, roles) |
| **S5** | Escalation, Proof of Action, Resolution & Feedback | Unattended complaints escalate; admins document actions with evidence; students view and give feedback | Escalation engine (configurable SLA), PoA record, resolution evidence upload, student resolution view, feedback form, Reopened state | S4 (statuses, assignment, routing) |
| **S6** | Analytics, Student Support, Polish & E2E Hardening | Analytics, support resources, accessibility/responsiveness, privacy audit, full E2E acceptance run | Analytics dashboard, student support hub (mental health, counseling request, rights, FAQ, emergency contacts), responsive polish, accessibility pass, privacy review, UAT | S1–S5 complete |

---

## C. Detailed Sprint Breakdown

### Sprint 1 — Foundation, Auth & Verification

**Objective**
Stand up the Next.js + Supabase skeleton with role-based auth, and implement the university affiliation verification flow end-to-end so that only verified students/graduates can reach protected features.

**Features**
- Project scaffold (Next.js + React + TypeScript + Tailwind + Supabase)
- Landing page, registration, university selection
- Current Student vs Graduate selection
- University email/OTP verification
- Student-card verification with AI/OCR
- Verification status persistence
- Base role model (Student, Graduate, Admin, HOD, Proctor, Female Focal Person, Hostel Warden, Counselor)
- Audit log foundation
- Input validation + error/empty/loading states

**User Stories**
- US-1.1: As a prospective user, I can register and pick my university so my affiliation is known.
- US-1.2: As a registrant, I can declare myself as Current Student or Graduate.
- US-1.3: As a student, I can verify via university email/OTP.
- US-1.4: As a student, I can submit my student card and have key fields extracted via OCR.
- US-1.5: As a verified user, I can access the complaint features; as an unverified user, I cannot.
- US-1.6: As the system, I log verification-related sensitive actions to the audit trail.

**SRS Requirements Covered**
- FR-AUTH-001, FR-AUTH-002, FR-AUTH-003, FR-AUTH-004, FR-AUTH-005
- NFR-SEC-001, NFR-SEC-003, NFR-SEC-004, NFR-SEC-005, NFR-SEC-006, NFR-SEC-009
- NFR-SCAL-001, NFR-MAIN-001, NFR-COMP-001, NFR-ACC-001
- AI: Student Card OCR (Current/Applicable per §25)

**Screens / UI**
- Landing page
- Registration (account create)
- University selection
- Student / Graduate status selection
- Verification — email/OTP
- Verification — student-card upload + OCR preview
- Verification status screen
- Basic nav shell (role-aware)

**Backend & Database**
- Supabase schema: `universities`, `users`, `user_verification`, `audit_logs`, `roles`/`user_roles`
- Auth (email/OTP via Supabase Auth), session handling
- OTP dispatch & verification endpoint
- OCR pipeline: upload to Supabase Storage → call vision model → store extracted fields + confidence
- Verification status state machine: `unverified → pending_email → pending_card → verified / rejected`
- Seed list of participating universities
- Row-level security policies for verification records

**AI**
- Student-card OCR/Vision to extract name, roll no, university, validity
- Confidence threshold + "needs manual review" flag

**Security**
- Role-based route guards (student vs admin)
- Input validation on registration, OTP, file uploads (type/size)
- Audit log entries for register, verify, reject, re-verify
- Storage buckets private; signed URLs for card images
- Anonymous identity protection foundations (privacy column on user)

**Dependencies**
- None (this is the bootstrap sprint)
- External: Supabase project provisioned, LLM/Vision API key available for OCR

**Definition of Done**
- A user can register, select a university, select status, complete OTP OR card verification, and see "Verified" state.
- Unverified users are blocked from complaint entry points.
- Audit log captures registration + verification events.
- Responsive at desktop/tablet/mobile breakpoints.

**Acceptance Criteria**
- FR-AUTH-001..005 all pass their SRS acceptance criteria.
- NFR-SEC-005 (unauthenticated blocked), NFR-SEC-006 (RBAC), NFR-SEC-009 (input validation) demonstrated.
- Seed universities selectable; at least one verification path completes successfully.

---

### Sprint 2 — Complaint Intake, Privacy & Evidence

**Objective**
A verified student can describe a problem, choose a privacy mode, attach evidence, and submit — generating a tracking ID. Harassment/Safety cases enter a protected workflow routed to authorized roles including the Female Focal Person.

**Features**
- Complaint creation (natural-language description field)
- Universal complaint categories
- Privacy mode selection: Identified / Confidential / Anonymous
- Evidence upload (multi-file)
- Tracking ID generation
- Harassment & Safety protected workflow
- Immediate-danger flag
- Female Focal Person restricted role
- Student dashboard (my complaints)
- Student Support entry points (informational in this sprint; functional in S6)

**User Stories**
- US-2.1: As a verified student, I can submit a complaint in any supported category.
- US-2.2: As a student, I can choose Identified, Confidential, or Anonymous before submitting.
- US-2.3: As a student, I can attach evidence (images, PDFs) up to the allowed size/count.
- US-2.4: As a student submitting a harassment/safety complaint, I am guided through a protected workflow.
- US-2.5: As a student in immediate danger, I can flag the case as urgent.
- US-2.6: As a Female Focal Person, I can see only the sensitive cases assigned to me.
- US-2.7: As a student, I receive a tracking ID after successful submission.

**SRS Requirements Covered**
- FR-CMP-001..005
- FR-HAR-001..006
- NFR-PRIV-001, NFR-PRIV-002, NFR-PRIV-003, NFR-PRIV-004
- NFR-SEC-002, NFR-SEC-007, NFR-SEC-008, NFR-SEC-009
- NFR-REL-001, NFR-USE-001, NFR-COMP-001

**Screens / UI**
- Student dashboard (list of my complaints + statuses)
- New Complaint — category selection
- New Complaint — natural-language description
- New Complaint — privacy selection
- New Complaint — evidence upload
- New Complaint — review & submit
- Harassment & Safety report form (with immediate-danger toggle)
- Complaint acknowledgement / tracking ID screen

**Backend & Database**
- Schema: `complaints`, `complaint_evidence`, `complaint_status_history`, `complaint_privacy`, `sensitive_case_access`
- Tracking ID generator (university-prefix + year + sequence, e.g. `CA-FAST-2026-00001`)
- Privacy mode enforcement: Anonymous strips PII from handler views; Confidential exposes identity only to assigned handler
- Evidence storage: signed URLs, virus/mime validation, size limits
- Harassment flag triggers restricted visibility + role check
- RLS policies: unauthorized roles cannot SELECT sensitive complaints
- `female_focal_person` role seeded per university

**AI**
- None required this sprint (AI integration in S3). Hook points reserved: `pre_submit` (for classification) and `on_upload` (for future evidence analysis).

**Security**
- Anonymous identity never stored in plaintext on the complaint record accessible to handlers
- Evidence signed URLs with expiry
- File-type allow-list (images, PDFs) and max-size enforcement
- RLS verified for all roles (student, admin, HOD, Proctor, Female Focal Person, Warden, Counselor)
- Audit log for submit, privacy-change, evidence-upload

**Dependencies**
- S1: verified user, RBAC, storage buckets, audit log
- OCR integration ready (S1) can optionally extract metadata from evidence (nice-to-have)

**Definition of Done**
- Verified student can submit a complaint in each supported category with a privacy mode and ≥1 evidence file.
- Tracking ID generated and displayed.
- Harassment complaint is invisible to an unauthorized admin account.
- Anonymous complaint does not expose identity to handlers.

**Acceptance Criteria**
- FR-CMP-001..005, FR-HAR-001..006 pass SRS acceptance criteria.
- Privacy modes demonstrably restrict identity visibility.
- Tracking IDs are unique and human-readable.
- Evidence upload fails gracefully on invalid files.

---

### Sprint 3 — AI Complaint Assistant & Smart Routing

**Objective**
AI analyzes the student's natural-language description, recommends category/priority/department, generates a structured complaint the student can edit, and provides smart routing recommendations that admins can override before assignment.

**Features**
- AI Complaint Assistant (natural language in → structured complaint out)
- AI category recommendation
- AI priority recommendation
- AI department recommendation
- Student review/edit of AI output before submission
- Admin review/override of AI recommendations
- Smart Routing recommendation panel on admin side
- Fallback when AI is unavailable (manual entry still works)

**User Stories**
- US-3.1: As a student, I describe my issue in plain language and the AI suggests category, priority, and department.
- US-3.2: As a student, I can edit any AI-suggested field before submitting.
- US-3.3: As a student, I can ask the AI to generate a fully structured complaint from my description.
- US-3.4: As an admin, I see the AI's routing recommendation when a new complaint lands.
- US-3.5: As an admin, I can change category/priority/department before assigning.
- US-3.6: As the system, if the AI service is down, the user can still submit manually.

**SRS Requirements Covered**
- FR-AI-001..006
- FR-ROUTE-001..004
- NFR-USE-001, NFR-MAIN-001
- AI Opportunities: Complaint Classification, Priority Detection, Smart Routing, Complaint Generation, AI Complaint Assistant (all Current/Applicable per §25)

**Screens / UI**
- AI Assistant conversational panel (on New Complaint)
- AI recommendation summary card (category / priority / department) with edit controls
- Structured complaint preview (generated text + editable fields)
- Admin intake view showing AI recommendations + override controls
- Smart Routing panel (recommended department + list of assignable staff)

**Backend & Database**
- New tables: `ai_recommendations`, `ai_sessions`, `departments`, `department_routing`
- Endpoint `/api/ai/analyze` → calls LLM with a structured prompt, returns category/priority/department/structured_text + confidence
- Endpoint `/api/ai/generate` → returns a full structured complaint draft
- Persist AI recommendation alongside complaint for admin review + audit
- Graceful degradation: if AI times out, return `null` recommendations and allow manual flow
- Department master data seeded per university

**AI**
- Prompt template: classification (category + subcategory), priority scoring (severity + urgency cues), department mapping (based on category keywords), structured complaint generation (who/what/when/where/impact/requested-action)
- Confidence score returned with every recommendation
- Safety guardrails for harassment content (do NOT re-summarize PII unnecessarily)

**Security**
- PII handling: AI payload strips identity for Anonymous complaints before sending
- AI response stored for audit; never auto-applies without student/admin review (human-in-the-loop per FR-AI-006 / FR-ROUTE-003,004)
- Prompt-injection defense: sanitize user description before embedding
- Rate limiting on `/api/ai/*`

**Dependencies**
- S1 (auth, departments, roles)
- S2 (complaint schema to attach recommendations to)
- LLM provider key + model endpoint available

**Definition of Done**
- A plain-language description yields category, priority, and department recommendations.
- Student can approve/edit AI output; the final submitted complaint reflects their edits.
- Admin sees AI recommendation and can override before assignment.
- AI outage does not block complaint submission.

**Acceptance Criteria**
- FR-AI-001..006, FR-ROUTE-001..004 all pass SRS acceptance criteria.
- AI recommendation latency acceptable under NFR-PERF-001.
- At least one structured complaint is fully generated from a natural-language input.

---

### Sprint 4 — Admin Dashboards, Tracking & Notifications

**Objective**
University staff manage, assign, and progress complaints through role-specific dashboards; students track status via a timeline; notifications fire on relevant events.

**Features**
- University Administration dashboard
- Role-filtered complaint lists
- Complaint detail view (with privacy-aware identity display)
- Assignment workflow
- Status transitions (Submitted → Assigned → In Review → Action Taken → Resolved)
- Complaint timeline / status history
- Student tracking page (by tracking ID or from dashboard)
- Notifications: status update, case information update, resolution notice
- Complaint analytics stub (full in S6)

**User Stories**
- US-4.1: As an administrator, I see a dashboard of complaints relevant to my role.
- US-4.2: As an administrator, I can assign a complaint to an appropriate authority.
- US-4.3: As an administrator, I can update a complaint's status through the defined states.
- US-4.4: As an administrator, I cannot see sensitive harassment cases outside my authorization.
- US-4.5: As a student, I can open my complaint by tracking ID and see its current status and timeline.
- US-4.6: As a student, I receive a notification when my complaint status changes.
- US-4.7: As a responsible authority, I receive a notification when a case I'm assigned to updates.

**SRS Requirements Covered**
- FR-ADMIN-001..005
- FR-TRACK-001..004 (005 — Escalated/Reopened — finalized in S5)
- Notifications §16: status update, case update, resolution
- NFR-SEC-001, NFR-SEC-002, NFR-SEC-006, NFR-SEC-008, NFR-SEC-010
- NFR-USE-002, NFR-PRIV-002, NFR-PRIV-003

**Screens / UI**
- Admin dashboard (cards/tables: open, assigned, in-review, overdue)
- Complaint management list (filters: category, department, status, priority)
- Complaint detail page (description, evidence, AI recommendation, status history, actions)
- Female Focal Person / sensitive-case interface (subset of above, restricted)
- Student complaint tracking page (tracking-ID lookup + timeline)
- Notification center (in-app; channel per SRS "not specified" — delivered in-app + email optional)

**Backend & Database**
- Tables: `notifications`, `complaint_assignments`, `complaint_status_history` (extend S2)
- Endpoints for list/filter/detail/assign/status-change
- Status transition validator (illegal transitions rejected)
- Notification dispatcher (in-app write + email hook stub)
- Privacy filter per role on detail endpoint

**AI**
- None added this sprint; AI recommendations from S3 rendered on detail page.

**Security**
- RLS enforced on every complaint read — harassment cases locked to assigned roles
- Audit log for assign, status change, view of sensitive case
- Admin cannot elevate own access

**Dependencies**
- S1 (roles, audit), S2 (complaints, privacy), S3 (AI recommendations visible on detail)

**Definition of Done**
- Each admin role can log in and see only their permitted complaints.
- A complaint can be assigned and moved through Submitted → Assigned → In Review → Action Taken → Resolved.
- Student sees the same transitions on their timeline within seconds.
- Notifications appear for status change, case update, and resolution events.

**Acceptance Criteria**
- FR-ADMIN-001..005, FR-TRACK-001..004 pass SRS acceptance criteria.
- Sensitive harassment complaint is invisible to an unauthorized admin in both list and detail endpoints.
- Timeline displays chronological history (FR-TRACK-003).

---

### Sprint 5 — Escalation, Proof of Action, Resolution & Feedback

**Objective**
Unattended complaints auto-escalate after a configurable response window; admins record actions with resolution evidence (Proof of Action); students view resolution and submit feedback; Escalated/Reopened states finalized.

**Features**
- Configurable response periods per category/priority
- Escalation detection + workflow (next higher authority)
- Escalation activity recording
- Proof of Action record (action taken + resolution evidence)
- Resolution evidence upload (admin side)
- Resolution view for students
- Student feedback after resolution
- Escalated and Reopened states (completes FR-TRACK-005)
- Escalation notification to responsible authority

**User Stories**
- US-5.1: As the system, I detect complaints that have exceeded their response period and mark them eligible for escalation.
- US-5.2: As a higher authority, I receive an escalation notification with case context.
- US-5.3: As an administrator, I record the action taken and upload resolution evidence.
- US-5.4: As a student, I can view the resolution and Proof of Action.
- US-5.5: As a student, I can submit feedback after resolution.
- US-5.6: As an authorized admin, I can reopen a resolved complaint when warranted.

**SRS Requirements Covered**
- FR-ESC-001..004
- FR-RES-001..005
- FR-TRACK-005
- Notifications §16: escalation, resolution
- NFR-SEC-010 (audit escalation + resolution actions)
- NFR-REL-001

**Screens / UI**
- Escalation banner on complaint detail (for escalated cases)
- Admin resolution form: action taken + evidence upload
- Student resolution view with Proof of Action + feedback form
- Escalation history panel (on timeline)
- Reopen control (authorized roles)

**Backend & Database**
- Tables: `sla_rules` (category/priority → response period), `escalations`, `proof_of_action`, `resolution_evidence`, `feedback`
- Background job: periodic scan of open complaints vs SLA → creates escalation record, updates status to `Escalated`, notifies next authority
- Resolution endpoint writes `Action Taken` + PoA + evidence atomically, transitions to `Resolved`
- Feedback endpoint (rating + comment), visible to admins in aggregate

**AI**
- Optional: summarize long case history when escalating (if time permits; not mandatory per SRS).

**Security**
- Escalation path respects harassment restrictions (sensitive cases escalate only to authorized higher roles)
- Resolution evidence inherits privacy rules of the complaint
- Audit log for escalation events, PoA creation, resolution, feedback, reopen

**Dependencies**
- S4 (statuses, assignment, notifications, dashboards)

**Definition of Done**
- A complaint left untouched past its SLA auto-escalates and the next authority is notified.
- Admin can record action + evidence; student sees it.
- Student can submit feedback; feedback is persisted.
- Reopen transitions are valid and audited.

**Acceptance Criteria**
- FR-ESC-001..004, FR-RES-001..005, FR-TRACK-005 pass SRS acceptance criteria.
- Escalation notification fires; resolution notification fires.
- Proof of Action record is retrievable for any resolved complaint.

---

### Sprint 6 — Analytics, Student Support, Polish & E2E Hardening

**Objective**
Ship the analytics dashboard, complete the Student Support module, perform a privacy + accessibility + responsiveness pass, and run the full end-to-end acceptance journey.

**Features**
- Complaint analytics dashboard (category, department, avg resolution time, pending, escalated, resolution rate, recurring facility issues)
- Student Support hub: mental-health resources, anonymous counseling request, student-rights info, policies/FAQ, emergency contacts
- AI Policy/FAQ assistant (Current/Applicable per §25 — retrieval over approved content)
- Accessibility pass (WCAG-minded: contrast, keyboard nav, ARIA)
- Responsive polish across desktop/tablet/mobile
- Privacy audit (verify NFR-PRIV-001..004 end-to-end)
- End-to-end UAT run against SRS §22 acceptance criteria

**User Stories**
- US-6.1: As a university administrator, I see aggregate analytics without exposing individual identities unnecessarily.
- US-6.2: As a student, I can access mental-health resources and request counseling anonymously.
- US-6.3: As a student, I can read student-rights info, FAQs, policies, and emergency contacts.
- US-6.4: As a student with a disability, I can navigate core flows with keyboard + screen reader basics.
- US-6.5: As a user on mobile, I can complete every core flow without layout breakage.
- US-6.6: As a product owner, I can execute the SRS §22 acceptance checklist green.

**SRS Requirements Covered**
- FR-SUP-001..005
- Analytics §17
- NFR-ACC-001, NFR-COMP-001, NFR-USE-002, NFR-PRIV-003, NFR-PRIV-004, NFR-PERF-001
- AI Opportunity: Policy/FAQ Assistant (Current/Applicable)
- SRS §22 full acceptance criteria validation

**Screens / UI**
- Analytics dashboard (charts: category, department, SLA metrics)
- Student Support hub (cards: mental health, counseling, rights, FAQ, emergency)
- Anonymous counseling request form
- FAQ search with AI-assisted answers (over curated content)
- Polish pass on all existing screens (empty/loading/error/success states per UI/UX §12)

**Backend & Database**
- Views/materialized queries for analytics (privacy-safe aggregations)
- Tables: `support_resources`, `counseling_requests`, `faq_entries`, `policies`, `emergency_contacts`
- Counseling request stored without link to complaint identity when submitted anonymously
- FAQ retrieval endpoint (optionally LLM-summarized over curated corpus)

**AI**
- Policy/FAQ assistant: retrieval + grounded generation over university-approved content only (no open-domain answers)

**Security**
- Analytics queries verified not to leak single-student identifiable data in small buckets (k-anonymity threshold or suppression)
- Counseling requests decoupled from complaint identity when anonymous
- Final privacy + audit-log review

**Dependencies**
- S1–S5 complete (data available for analytics; complaint flows stable)

**Definition of Done**
- All 20 acceptance items in SRS §22 demonstrably pass.
- Analytics shows all 7 specified metrics.
- Support hub covers all 5 FR-SUP items.
- Responsive test matrix (desktop/tablet/mobile) green for all core flows.

**Acceptance Criteria**
- FR-SUP-001..005, all analytics bullets in §17, NFR-ACC-001, NFR-COMP-001 pass.
- No sensitive personal information exposed by analytics (§17 privacy constraint).
- SRS §22 checklist fully green.

---

## D. SRS Traceability Matrix

| Requirement ID | Requirement (summary) | Sprint | Implementation / Feature | Priority |
|---|---|---|---|---|
| FR-AUTH-001 | Select participating university | S1 | Registration — university selection | High |
| FR-AUTH-002 | Identify as current student or graduate | S1 | Registration — status selection | High |
| FR-AUTH-003 | University email/OTP verification | S1 | Verification — email/OTP flow | High |
| FR-AUTH-004 | Student-card verification | S1 | Verification — card upload + OCR | High |
| FR-AUTH-005 | Record university verification status | S1 | `user_verification` state machine | High |
| FR-CMP-001 | Verified users submit complaints | S2 | Complaint creation flow | High |
| FR-CMP-002 | Universal complaint categories | S2 | Category selection + seed data | High |
| FR-CMP-003 | Attach supporting evidence | S2 | Evidence upload | High |
| FR-CMP-004 | Identified / Confidential / Anonymous | S2 | Privacy selection + RLS | High |
| FR-CMP-005 | Unique tracking ID per complaint | S2 | Tracking ID generator | High |
| FR-AI-001 | Natural-language complaint input | S3 | AI Assistant conversational UI | High |
| FR-AI-002 | AI category recommendation | S3 | LLM classification | High |
| FR-AI-003 | AI priority recommendation | S3 | LLM priority scoring | High |
| FR-AI-004 | AI department recommendation | S3 | LLM dept mapping | High |
| FR-AI-005 | AI structured complaint generation | S3 | `/api/ai/generate` | High |
| FR-AI-006 | Student review of AI output | S3 | Review/edit step | High |
| FR-HAR-001 | Dedicated harassment/safety workflow | S2 | Protected workflow branch | High |
| FR-HAR-002 | Anonymous/confidential harassment reporting | S2 | Privacy modes in protected flow | High |
| FR-HAR-003 | Immediate-danger indication | S2 | Urgent flag on form | High |
| FR-HAR-004 | Harassment evidence submission | S2 | Evidence upload in protected flow | High |
| FR-HAR-005 | Route sensitive cases to authorized personnel | S2 + S4 | RLS + role filter | High |
| FR-HAR-006 | Female Focal Person role | S2 + S4 | Role seed + restricted UI | High |
| FR-ROUTE-001 | AI-based routing recommendations | S3 | Smart Routing panel | High |
| FR-ROUTE-002 | AI-based priority recommendations | S3 | (same as FR-AI-003) | High |
| FR-ROUTE-003 | Admin review of AI recommendations | S3 | Admin intake view | High |
| FR-ROUTE-004 | Admin modify recommendations | S3 | Override controls | High |
| FR-TRACK-001 | Unique tracking ID | S2 | Tracking ID generator | High |
| FR-TRACK-002 | Display complaint status | S4 | Tracking page + detail page | High |
| FR-TRACK-003 | Display complaint timeline | S4 | Timeline component | High |
| FR-TRACK-004 | Statuses: Submitted/Assigned/In Review/Action Taken/Resolved | S4 | Status state machine | High |
| FR-TRACK-005 | Escalated + Reopened states | S5 | Escalation + reopen flow | Medium |
| FR-ESC-001 | Configurable response periods | S5 | `sla_rules` table | High |
| FR-ESC-002 | Identify overdue complaints | S5 | Escalation scanner job | High |
| FR-ESC-003 | Escalate to higher authorities | S5 | Escalation workflow | High |
| FR-ESC-004 | Record escalation activity | S5 | `escalations` + audit log | High |
| FR-RES-001 | Record actions taken | S5 | PoA form | High |
| FR-RES-002 | Upload resolution evidence | S5 | Resolution evidence upload | High |
| FR-RES-003 | Provide resolution info to student | S5 | Student resolution view | High |
| FR-RES-004 | Maintain Proof of Action record | S5 | PoA persistence | High |
| FR-RES-005 | Student feedback after resolution | S5 | Feedback form | Medium |
| FR-ADMIN-001 | Administration dashboard | S4 | Admin dashboard | High |
| FR-ADMIN-002 | View relevant complaints (role-based) | S4 | Role-filtered lists | High |
| FR-ADMIN-003 | Assign complaints | S4 | Assignment flow | High |
| FR-ADMIN-004 | Update complaint status | S4 | Status transitions | High |
| FR-ADMIN-005 | Restrict sensitive complaints | S4 | RLS + harassment gating | High |
| FR-SUP-001 | Mental-health resources | S6 | Support hub | Medium |
| FR-SUP-002 | Anonymous counseling requests | S6 | Counseling form | Medium |
| FR-SUP-003 | Student-rights information | S6 | Support hub content | Medium |
| FR-SUP-004 | Policies and FAQs | S6 | FAQ + AI assistant | Medium |
| FR-SUP-005 | Emergency contacts | S6 | Support hub content | Medium |
| NFR-PERF-001 | Responsive interaction | S6 (ongoing) | Perf pass | Medium |
| NFR-SEC-001 | Role-restricted functionality | S1 + S4 | RBAC + route guards | High |
| NFR-SEC-002 | Sensitive info restricted | S2 + S4 | RLS, privacy modes | High |
| NFR-SEC-003 | Validate input & uploads | S1 + S2 | Validators + file checks | High |
| NFR-SEC-004 | Audit logging | S1 + all | `audit_logs` + writers | High |
| NFR-SEC-005 | Authentication required | S1 | Auth middleware | High |
| NFR-SEC-006 | Role-based authorization | S1 + S4 | RBAC | High |
| NFR-SEC-007 | Anonymous identity protection | S2 | Privacy modes + RLS | High |
| NFR-SEC-008 | Sensitive harassment restricted | S2 + S4 | RLS + role filter | High |
| NFR-SEC-009 | Validate complaint inputs/evidence | S1 + S2 | Validators | High |
| NFR-SEC-010 | Audit records for sensitive actions | S1 + all | Audit writers | High |
| NFR-REL-001 | Complaint records remain available | S2 + S4 | Persistence + retrieval | High |
| NFR-SCAL-001 | Future multi-university expansion | S1 | Multi-tenant schema (university_id FKs) | Medium |
| NFR-USE-001 | Natural-language complaint | S2 + S3 | Description field + AI | High |
| NFR-USE-002 | Simple status timeline | S4 | Timeline component | High |
| NFR-ACC-001 | Accessibility considerations | S6 | Accessibility pass | Medium |
| NFR-MAIN-001 | Modular structure | S1 + ongoing | Module-per-feature layout | Medium |
| NFR-COMP-001 | Responsive web | S6 (ongoing) | Tailwind responsive pass | High |
| NFR-PRIV-001 | Anonymous/confidential do not expose identity | S2 | Privacy modes + RLS | High |
| NFR-PRIV-002 | Sensitive harassment restricted | S2 + S4 | RLS | High |
| NFR-PRIV-003 | Privacy-first approach | All sprints | Privacy review each sprint | High |
| NFR-PRIV-004 | Pakistan data hosting | S1 | Infra selection (Supabase region) | Medium |
| Notifications §16 | Status update / case update / escalation / resolution | S4 + S5 | Notification service (in-app + email stub) | High |
| Analytics §17 | 7 specified metrics, privacy-safe | S6 | Analytics dashboard | High |
| AI §25 — Classification | Category detection | S3 | LLM classifier | Current |
| AI §25 — Priority Detection | Priority recommendation | S3 | LLM scorer | Current |
| AI §25 — Smart Routing | Department recommendation | S3 | LLM router | Current |
| AI §25 — Complaint Generation | Structured complaint | S3 | LLM generator | Current |
| AI §25 — AI Complaint Assistant | Student guidance | S3 | Conversational UI | Current |
| AI §25 — Student Card OCR | Card extraction | S1 | Vision model | Current |
| AI §25 — Policy/FAQ Assistant | FAQ retrieval | S6 | RAG over curated FAQ | Current |
| AI §25 — Complaint Pattern Analysis | Recurring issues | Future | Deferred | Future |
| AI §25 — Duplicate Complaint Detection | Similar complaints | Future | Deferred | Future |
| SRS §22 Acceptance 1–20 | Full E2E acceptance | S6 (UAT) | End-to-end run | High |

---

## E. MVP vs Future Scope

### Must Have (MVP — Sprints 1–6)
Everything mapped above to S1–S6, including:
- Registration, verification (email/OTP + card OCR)
- All complaint categories incl. harassment/safety
- Privacy modes (Identified/Confidential/Anonymous)
- AI classification, priority, department, structured generation, review
- Smart routing with admin override
- Tracking, timeline, all statuses incl. Escalated/Reopened
- Escalation with configurable SLA
- Proof of Action + resolution evidence + feedback
- Admin dashboards + RBAC + Female Focal Person
- Notifications for the 4 SRS-defined events
- Analytics (all 7 listed metrics)
- Student Support (mental health, anonymous counseling, rights, FAQ, emergency)
- Responsive web + accessibility considerations + audit logging + privacy-first design

### Should Have (MVP if time allows within S6, else deferred to patch immediately after MVP)
- AI Policy/FAQ grounded assistant (SRS lists as Current/Applicable, but SRS also says "other AI opportunities should not delay completion of the core complaint-to-resolution workflow" — §25)
- Advanced accessibility compliance beyond baseline

### Future / Out of Scope (per SRS §4.2 / §4.3 / §25)
- Official university SIS integration
- HEC integration
- Automatic external escalation
- SMS notifications
- Real-time campus security tracking
- Large-scale multi-university deployment
- Dedicated mobile app
- Student community features
- Advanced analytics
- AI Complaint Pattern Analysis
- AI Duplicate Complaint Detection

---

## F. Complete End-to-End User Journey

The SRS §22 acceptance test demands one unbroken path. Below is the journey with the sprint(s) that deliver each step and the verification gate.

| # | Step | Owner | Sprints | Key Evidence |
|---|---|---|---|---|
| 1 | **Student Registration** — account + university + student/graduate status | Student | S1 | `users` + `universities` + status flag |
| 2 | **Verification** — email/OTP or student-card OCR; status = Verified | Student + System | S1 | `user_verification.verified = true` |
| 3 | **AI Complaint** — natural-language description enters AI assistant | Student | S3 | `ai_sessions` record |
| 4 | **Privacy Selection** — Identified / Confidential / Anonymous | Student | S2 | `complaints.privacy_mode` |
| 5 | **Evidence** — upload files, validated + stored | Student | S2 | `complaint_evidence` rows + storage objects |
| 6 | **Submission** — review, confirm, submit → tracking ID issued | Student | S2 | `complaints.tracking_id`, status = Submitted |
| 7 | **AI Analysis** — category, priority, department recommendation recorded | AI | S3 | `ai_recommendations` row |
| 8 | **Smart Routing** — admin reviews AI recommendation, overrides if needed, assigns | Admin | S3 + S4 | `complaint_assignments` + audit log |
| 9 | **Admin Action** — status to In Review / Action Taken, notes added | Admin | S4 | `complaint_status_history` |
| 10 | **Tracking** — student views status + timeline | Student | S4 | Tracking page + timeline component |
| 11 | **Escalation** — if SLA exceeded, auto-escalate to higher authority | System | S5 | `escalations` row + notification |
| 12 | **Proof of Action** — admin records action + uploads resolution evidence | Admin | S5 | `proof_of_action` + `resolution_evidence` |
| 13 | **Resolution** — complaint moves to Resolved; student notified | Admin + System | S5 | Status = Resolved + notification |
| 14 | **Feedback** — student submits rating + comment | Student | S5 | `feedback` row |

**End-to-end acceptance (SRS §22):** every step 1–13 is demonstrable in a single walkthrough by Sprint 6 UAT; step 14 is optional (Medium priority) but included in the journey.

---

## Notes & Assumptions

1. **Sprint cadence** assumes a 5-day hackathon sprint. Adjust if team size changes.
2. **Supabase region** should be chosen in S1 to satisfy NFR-PRIV-004 (Pakistan hosting where supported). If Supabase has no Pakistan region, pick the nearest compliant option and document the deviation.
3. **LLM provider** is not specified in the SRS; selection is an implementation decision in S3. Must support structured JSON output for recommendations.
4. **Notification channel** is explicitly "not specified" in SRS §16 — MVP delivers in-app notifications; email is a cheap add-on, SMS is out of scope (§4.2).
5. **Female Focal Person** role must be seedable per university in S1/S2; assignment logic in S4.
6. **SLA defaults** (for FR-ESC-001) should be seeded per category/priority in S5; admins can override per university.
7. **Privacy review** is not a one-sprint activity — every sprint includes a privacy checkpoint; S6 performs the formal audit.
8. **Future AI features** (Pattern Analysis, Duplicate Detection) are deliberately excluded from sprint work per SRS §25 ("should not delay completion of the core complaint-to-resolution workflow").

---

*End of Sprint Plan.*
