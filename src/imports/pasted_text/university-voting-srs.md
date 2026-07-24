# Software Requirements Specification (SRS)
## University King & Queen Voting System

| Field | Detail |
|---|---|
| Document Version | 1.0 |
| Date | July 15, 2026 |
| Author | Min Bhone San (Syl) |
| Status | Draft |
| Intended Audience | Project supervisor, development team, event organizing committee |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [Functional Requirements](#3-functional-requirements)
4. [Non-Functional Requirements](#4-non-functional-requirements)
5. [System Architecture](#5-system-architecture)
6. [Frontend Specification](#6-frontend-specification)
7. [Backend Specification](#7-backend-specification)
8. [Database Design](#8-database-design)
9. [Deployment on Vercel](#9-deployment-on-vercel)
10. [Security Requirements](#10-security-requirements)
11. [Testing Strategy](#11-testing-strategy)
12. [Project Milestones](#12-project-milestones)
13. [Future Enhancements](#13-future-enhancements)
14. [Appendix](#14-appendix)

---

## 1. Introduction

### 1.1 Purpose

This document specifies the software requirements for a web-based **King & Queen Voting System** to be used at university events (e.g., fresher welcome ceremonies, annual festivals). The system allows registered students to cast votes for King and Queen candidates, prevents duplicate or fraudulent voting, and automatically determines winners based on vote counts. This SRS defines the functional and non-functional requirements, system architecture, frontend and backend design, database schema, and deployment strategy.

### 1.2 Scope

The system will:

- Allow event organizers (admins) to register candidates in two categories: **King** and **Queen**, with photos and profiles.
- Authenticate voters using their student credentials so that each student can vote **exactly once per category**.
- Provide a mobile-friendly voting interface (most students will vote from phones).
- Tally votes in real time on the server, with results hidden from voters until the admin closes voting.
- Automatically compute and announce winners when voting closes.
- Provide an admin dashboard for managing candidates, controlling the voting window, monitoring turnout, and viewing final results.

Out of scope for version 1.0: payment-based voting, multi-university tenancy, native mobile apps, and offline voting.

### 1.3 Definitions and Acronyms

| Term | Definition |
|---|---|
| Candidate | A student nominated for the King or Queen title |
| Voter | A registered student eligible to cast one vote per category |
| Admin | Event organizer with privileged access to manage the election |
| Election | A voting event with a defined open/close window |
| Ballot | A single vote record linking a voter to a candidate |
| RLS | Row Level Security (Postgres/Supabase feature) |
| SSR / ISR | Server-Side Rendering / Incremental Static Regeneration (Next.js) |
| JWT | JSON Web Token |

### 1.4 References

- IEEE 830-1998 Recommended Practice for Software Requirements Specifications
- Next.js Documentation (App Router)
- Supabase Documentation (Auth, Postgres, RLS, Realtime)
- Vercel Deployment Documentation

---

## 2. Overall Description

### 2.1 Product Perspective

The system is a standalone full-stack web application. It follows a **serverless architecture**: a Next.js application deployed on Vercel serves both the frontend and the backend API, backed by a managed Postgres database (Supabase). No self-hosted servers are required, which keeps operating cost near zero — suitable for a student project and a one-night event workload.

### 2.2 User Classes

| User Class | Description | Access |
|---|---|---|
| Voter (Student) | Authenticated student; browses candidates and casts one vote per category | Public app, after login |
| Admin (Organizer) | Manages candidates, opens/closes voting, views live tallies and final results | Admin dashboard, role-protected |
| Guest | Unauthenticated visitor; can view the landing page and candidate gallery but cannot vote | Public pages only |

### 2.3 Operating Environment

- **Client:** Modern browsers (Chrome, Safari, Firefox, Edge) on mobile and desktop. The UI must be responsive down to 360 px width.
- **Server:** Vercel serverless/edge runtime (Node.js 20).
- **Database:** Supabase-managed PostgreSQL 15+.
- **Connectivity:** Designed to tolerate slow/unstable mobile networks (lightweight pages, optimistic UI with server confirmation).

### 2.4 Design Constraints

- One vote per student per category, enforced at the **database level**, not just the UI.
- Results must not be visible to voters while voting is open (to avoid bandwagon effects).
- Free-tier friendly: must run within Vercel Hobby and Supabase Free tier limits.
- Voting window is short and traffic is bursty (hundreds of students voting within minutes of the announcement).

### 2.5 Assumptions and Dependencies

- The university provides a list of eligible student IDs/emails, or students self-register and are verified by admins before voting opens.
- Each student has access to a smartphone or computer with internet during the event.
- The event has a single election at a time (one King race, one Queen race), though the schema supports multiple elections for reuse in future years.

---

## 3. Functional Requirements

Requirements are labeled FR-x.y and prioritized: **M** (Must), **S** (Should), **C** (Could).

### 3.1 Authentication & Voter Eligibility

| ID | Requirement | Priority |
|---|---|---|
| FR-1.1 | The system shall allow students to sign in using email + OTP (magic link/code) or student-ID + password issued by organizers. | M |
| FR-1.2 | The system shall verify that the authenticated user appears on the eligible voter list before allowing a ballot. | M |
| FR-1.3 | The system shall maintain a session (JWT) so voters do not re-authenticate during the event. | M |
| FR-1.4 | The system shall support an admin role, distinguished from voters via a role claim/flag. | M |
| FR-1.5 | The system should lock accounts after 5 failed login attempts for 15 minutes. | S |

### 3.2 Candidate Management (Admin)

| ID | Requirement | Priority |
|---|---|---|
| FR-2.1 | Admins shall create, edit, and delete candidates with: full name, category (King/Queen), photo, department/major, year, and a short bio. | M |
| FR-2.2 | Candidate photos shall be uploaded to object storage (Supabase Storage) with a max size of 5 MB, auto-resized for display. | M |
| FR-2.3 | Admins shall be able to reorder candidates or shuffle display order to avoid position bias. | S |
| FR-2.4 | Candidate deletion shall be blocked once voting has opened (deactivation allowed instead). | M |

### 3.3 Election Control (Admin)

| ID | Requirement | Priority |
|---|---|---|
| FR-3.1 | Admins shall open and close voting manually, and optionally schedule open/close times. | M |
| FR-3.2 | The system shall reject any ballot submitted while the election status is not `open`, enforced server-side. | M |
| FR-3.3 | Admins shall see live turnout (number of ballots cast per category) and live tallies while voting is open. | M |
| FR-3.4 | When the election is closed, the system shall compute winners per category (highest vote count) and record them. | M |
| FR-3.5 | The system shall support a tie-breaking policy: flag ties to the admin rather than auto-deciding. | S |

### 3.4 Voting (Voter)

| ID | Requirement | Priority |
|---|---|---|
| FR-4.1 | Voters shall view all active candidates per category with photo, name, department, and bio. | M |
| FR-4.2 | Voters shall cast exactly one vote for King and one vote for Queen. Votes for the two categories may be cast at different times. | M |
| FR-4.3 | The system shall show a confirmation dialog before submitting a ballot; votes are final and cannot be changed. | M |
| FR-4.4 | Duplicate ballots shall be rejected with a clear message ("You have already voted for King"). Enforcement is a database unique constraint, not only UI state. | M |
| FR-4.5 | After voting, the voter shall see a "vote recorded" state per category (but not tallies). | M |
| FR-4.6 | Voters could optionally see the results page after the admin publishes results. | S |

### 3.5 Results & Announcement

| ID | Requirement | Priority |
|---|---|---|
| FR-5.1 | The system shall display final results (winner + vote counts or percentages, per admin's choice) on a public results page once published. | M |
| FR-5.2 | The results page should support a "reveal" animation suitable for projecting on stage at the event. | S |
| FR-5.3 | Admins shall be able to export full results and the anonymized ballot log as CSV. | S |

### 3.6 Audit & Integrity

| ID | Requirement | Priority |
|---|---|---|
| FR-6.1 | Every ballot shall record a server-side timestamp; the voter–candidate link is stored for uniqueness enforcement but never exposed publicly. | M |
| FR-6.2 | Admin actions (open/close election, candidate changes, result publication) shall be written to an audit log. | M |
| FR-6.3 | The system shall rate-limit ballot submission endpoints to mitigate scripted voting. | M |

---

## 4. Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-1 | Performance | Ballot submission completes in < 1.5 s at the 95th percentile under 200 concurrent users. Candidate pages load in < 2.5 s on 3G-class connections. |
| NFR-2 | Scalability | The serverless architecture shall handle burst traffic of at least 1,000 voters within a 30-minute window without manual intervention. |
| NFR-3 | Availability | ≥ 99% availability during the voting window; graceful error states if the database is briefly unreachable. |
| NFR-4 | Security | All traffic over HTTPS; secrets stored in environment variables; RLS enabled on all tables; one-vote enforcement at the database layer. |
| NFR-5 | Privacy | Individual voting choices are never displayed to anyone, including admins; only aggregate tallies are shown. Exports anonymize voter identity. |
| NFR-6 | Usability | Mobile-first design; voting flow completable in ≤ 3 taps after login; supports English UI with Burmese labels where helpful. |
| NFR-7 | Accessibility | WCAG 2.1 AA basics: sufficient contrast, alt text on candidate photos, keyboard-navigable forms. |
| NFR-8 | Maintainability | TypeScript throughout; ESLint + Prettier enforced; schema migrations tracked in version control. |
| NFR-9 | Cost | Runs entirely within Vercel Hobby tier and Supabase Free tier for a single event. |

---

## 5. System Architecture

### 5.1 Architecture Overview

The system uses a **serverless three-tier architecture** with Next.js (App Router) as a unified frontend + backend framework, deployed on Vercel, and Supabase providing Postgres, authentication, storage, and realtime updates.

```
                        ┌──────────────────────────────────────────┐
                        │              CLIENT (Browser)             │
                        │   Next.js React UI · Tailwind CSS         │
                        │   Voter pages · Admin dashboard           │
                        └───────────────┬──────────────────────────┘
                                        │ HTTPS
                    ┌───────────────────▼───────────────────────────┐
                    │                 VERCEL                         │
                    │  ┌──────────────────────────────────────────┐ │
                    │  │  Next.js App Router                       │ │
                    │  │  • Server Components (SSR/ISR pages)      │ │
                    │  │  • Route Handlers  /api/*  (REST)         │ │
                    │  │  • Server Actions (ballot submission)     │ │
                    │  │  • Middleware (auth guard, rate limiting) │ │
                    │  └───────────────────┬──────────────────────┘ │
                    │            Edge Network / CDN (static assets) │
                    └────────────────────────┬──────────────────────┘
                                             │ Postgres protocol / REST
                    ┌────────────────────────▼──────────────────────┐
                    │                 SUPABASE                       │
                    │  • PostgreSQL 15 (elections, candidates,      │
                    │    voters, ballots, audit_log) + RLS          │
                    │  • Auth (email OTP, JWT issuance)             │
                    │  • Storage (candidate photos)                 │
                    │  • Realtime (live tally channel for admin)    │
                    └───────────────────────────────────────────────┘
```

### 5.2 Key Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 15 (App Router, TypeScript) | Single codebase for UI + API; first-class Vercel support; SSR for fast first paint on slow mobile networks |
| Backend style | Serverless Route Handlers + Server Actions | No servers to manage; auto-scales for the burst during the event; Server Actions keep ballot logic server-side |
| Database | Supabase Postgres | Relational integrity (unique constraints for one-vote enforcement), RLS for defense-in-depth, generous free tier |
| Auth | Supabase Auth (email OTP) with role claim | Avoids password management; magic-code login is simple for students on phones |
| File storage | Supabase Storage | Candidate photos served via CDN URL |
| Live updates | Supabase Realtime (admin tally) with polling fallback | Live turnout on the admin dashboard without a custom WebSocket server |
| Styling | Tailwind CSS + shadcn/ui | Fast to build a clean, responsive UI |
| Hosting | Vercel | Git-integrated CI/CD, preview deployments, global CDN, zero-config Next.js |

### 5.3 Request Flow: Casting a Ballot

1. Voter (authenticated, JWT in cookie) taps **Vote** on a candidate card and confirms.
2. Client invokes a **Server Action** `castBallot(candidateId)`.
3. Middleware validates the session; the action re-verifies the JWT server-side.
4. The action checks election status = `open` and voter eligibility.
5. A single SQL transaction inserts into `ballots`. The **unique constraint** `(election_id, voter_id, category)` guarantees one vote per category — a duplicate attempt raises a constraint violation which is returned as "already voted".
6. Response updates the UI to the "vote recorded" state.

This design means correctness does not depend on client behavior: even a scripted client cannot vote twice.

---

## 6. Frontend Specification

### 6.1 Technology Stack

- **Framework:** Next.js 15 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS, shadcn/ui component library
- **State/data:** React Server Components for reads; Server Actions + `useOptimistic`/`useTransition` for writes; minimal client state
- **Forms & validation:** Zod schemas shared between client and server
- **Icons/animation:** lucide-react; Framer Motion for the results reveal

### 6.2 Route Map

| Route | Access | Description |
|---|---|---|
| `/` | Public | Landing page: event branding, countdown to open/close, login CTA |
| `/login` | Public | Email/student-ID login (OTP) |
| `/vote` | Voter | Category tabs (King / Queen), candidate grid, voting status per category |
| `/vote/[candidateId]` | Voter | Candidate detail: full photo, bio, vote button |
| `/results` | Public (after publish) | Winners with reveal animation; optional full standings |
| `/admin` | Admin | Dashboard home: election status toggle, live turnout, live tallies |
| `/admin/candidates` | Admin | CRUD table for candidates, photo upload, activate/deactivate |
| `/admin/voters` | Admin | Eligible-voter list import (CSV), verification status |
| `/admin/audit` | Admin | Audit log viewer; CSV exports |

### 6.3 Key UI Components

| Component | Purpose |
|---|---|
| `CandidateCard` | Photo, name, department, category badge, Vote button (disabled if already voted or election closed) |
| `CategoryTabs` | Switch between King and Queen races; shows a check mark on categories already voted |
| `VoteConfirmDialog` | Final confirmation, emphasizing votes cannot be changed |
| `VotedBanner` | Per-category "Your vote has been recorded ✓" state |
| `ElectionStatusPill` | `Scheduled / Open / Closed / Published` indicator |
| `LiveTallyBoard` (admin) | Realtime bar chart of votes per candidate |
| `TurnoutMeter` (admin) | Ballots cast vs. eligible voters |
| `WinnerReveal` | Animated stage-projection view of King & Queen winners |
| `CandidateForm` (admin) | Create/edit candidate with image upload + preview |

### 6.4 UX Requirements

- Mobile-first layout; candidate grid is 2 columns on phones, 4 on desktop.
- The voting flow after login: pick category → tap candidate → confirm = **3 taps**.
- All destructive/final actions require confirmation.
- Errors are human-readable ("Voting hasn't opened yet — it opens at 6:00 PM") rather than raw API errors.
- Loading skeletons for candidate grids; optimistic "recording your vote…" state with server confirmation.

---

## 7. Backend Specification

### 7.1 Technology Stack

- **Runtime:** Vercel serverless functions (Node.js 20) via Next.js Route Handlers and Server Actions
- **Validation:** Zod on every input boundary
- **Database access:** Supabase JS client (RLS-scoped, per-user JWT) for voter paths; service-role client only inside admin-verified server code
- **Rate limiting:** Upstash Redis (`@upstash/ratelimit`) or Vercel Firewall rules on ballot and login endpoints

### 7.2 API Endpoints

All endpoints are JSON over HTTPS. Voter endpoints require a valid session; admin endpoints additionally require the `admin` role.

| Method & Path | Auth | Description |
|---|---|---|
| `POST /api/auth/login` | Public | Request OTP for an eligible email/student ID |
| `POST /api/auth/verify` | Public | Verify OTP, establish session |
| `GET /api/elections/current` | Voter | Current election status, open/close times |
| `GET /api/candidates?category=` | Voter | Active candidates for a category (shuffled order) |
| `POST /api/ballots` | Voter | Cast a ballot `{ candidateId }` — one per category, enforced by DB constraint |
| `GET /api/me/ballots` | Voter | Which categories this voter has completed (no candidate identity returned) |
| `GET /api/results` | Public | Published results only; 403 before publication |
| `POST /api/admin/elections/:id/open` | Admin | Open voting |
| `POST /api/admin/elections/:id/close` | Admin | Close voting and compute winners |
| `POST /api/admin/elections/:id/publish` | Admin | Publish results to the public page |
| `POST /api/admin/candidates` | Admin | Create candidate |
| `PATCH /api/admin/candidates/:id` | Admin | Update / activate / deactivate candidate |
| `POST /api/admin/voters/import` | Admin | Bulk import eligible voters (CSV) |
| `GET /api/admin/tally` | Admin | Live per-candidate counts |
| `GET /api/admin/export` | Admin | CSV export (results, anonymized ballots, audit log) |

### 7.3 Ballot Submission Logic (authoritative pseudocode)

```ts
async function castBallot(userId: string, candidateId: string) {
  const candidate = await db.candidates.find(candidateId);
  if (!candidate || !candidate.is_active) throw new ApiError(404, "CANDIDATE_NOT_FOUND");

  const election = await db.elections.find(candidate.election_id);
  if (election.status !== "open") throw new ApiError(409, "VOTING_CLOSED");

  const voter = await db.voters.findByUser(userId, election.id);
  if (!voter || !voter.is_verified) throw new ApiError(403, "NOT_ELIGIBLE");

  try {
    await db.ballots.insert({
      election_id: election.id,
      voter_id: voter.id,
      candidate_id: candidate.id,
      category: candidate.category,   // unique (election_id, voter_id, category)
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new ApiError(409, "ALREADY_VOTED");
    throw e;
  }
  return { ok: true, category: candidate.category };
}
```

### 7.4 Error Handling Conventions

- Errors return `{ error: { code, message } }` with proper HTTP status codes (`401`, `403`, `404`, `409`, `429`, `500`).
- Machine-readable `code` values (`ALREADY_VOTED`, `VOTING_CLOSED`, `NOT_ELIGIBLE`, `RATE_LIMITED`) drive friendly UI messages.
- All admin mutations write an `audit_log` row in the same transaction where possible.

---

## 8. Database Design

### 8.1 Entity-Relationship Overview

```
 elections 1 ──── * candidates
     │                  │
     │ 1                │ *
     │                  │
     * voters 1 ──── * ballots (unique per voter+category)
                        
 audit_log (references admin user + action)
```

### 8.2 Schema (PostgreSQL / Supabase)

```sql
-- Election events (reusable across years)
create table elections (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,                          -- e.g. "Fresher Welcome 2026"
  status        text not null default 'scheduled'
                check (status in ('scheduled','open','closed','published')),
  opens_at      timestamptz,
  closes_at     timestamptz,
  created_at    timestamptz not null default now()
);

-- Candidates for King / Queen
create table candidates (
  id            uuid primary key default gen_random_uuid(),
  election_id   uuid not null references elections(id),
  category      text not null check (category in ('king','queen')),
  full_name     text not null,
  department    text,
  academic_year text,
  bio           text,
  photo_url     text,
  is_active     boolean not null default true,
  display_order int,
  created_at    timestamptz not null default now()
);

-- Eligible voters (linked to Supabase auth users after login)
create table voters (
  id            uuid primary key default gen_random_uuid(),
  election_id   uuid not null references elections(id),
  auth_user_id  uuid unique references auth.users(id),
  student_id    text not null,
  email         text not null,
  is_verified   boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (election_id, student_id)
);

-- Ballots: THE integrity core of the system
create table ballots (
  id            uuid primary key default gen_random_uuid(),
  election_id   uuid not null references elections(id),
  voter_id      uuid not null references voters(id),
  candidate_id  uuid not null references candidates(id),
  category      text not null check (category in ('king','queen')),
  cast_at       timestamptz not null default now(),
  unique (election_id, voter_id, category)   -- one vote per category, guaranteed
);

-- Computed winners (filled when election closes)
create table results (
  election_id   uuid not null references elections(id),
  category      text not null check (category in ('king','queen')),
  candidate_id  uuid not null references candidates(id),
  vote_count    int  not null,
  is_tie        boolean not null default false,
  primary key (election_id, category, candidate_id)
);

-- Admin action audit trail
create table audit_log (
  id            bigint generated always as identity primary key,
  actor_id      uuid not null,
  action        text not null,      -- 'ELECTION_OPENED', 'CANDIDATE_UPDATED', ...
  details       jsonb,
  created_at    timestamptz not null default now()
);

-- Indexes for hot paths
create index idx_candidates_election_cat on candidates (election_id, category) where is_active;
create index idx_ballots_tally on ballots (election_id, candidate_id);
```

### 8.3 Tally Query

```sql
select c.id, c.full_name, c.category, count(b.id) as votes
from candidates c
left join ballots b on b.candidate_id = c.id
where c.election_id = $1 and c.is_active
group by c.id
order by c.category, votes desc;
```

### 8.4 Row Level Security Policies (summary)

| Table | Voter (authenticated) | Admin | Anonymous |
|---|---|---|---|
| `elections` | `select` current election | full | `select` when `status='published'` |
| `candidates` | `select` active rows while open/published | full | `select` when published |
| `voters` | `select` own row only | full | none |
| `ballots` | `insert` own ballot (checked against `voters.auth_user_id`); `select` own rows *without* `candidate_id` (via view) | aggregate views only | none |
| `results` | `select` when published | full | `select` when published |
| `audit_log` | none | `select` | none |

Ballot secrecy: voters query a view `my_ballot_status(category, cast_at)` that excludes `candidate_id`; even admins interact with aggregates, not row-level voter→candidate pairs, satisfying NFR-5.

---

## 9. Deployment on Vercel

### 9.1 Deployment Model

- **Repository:** GitHub (`main` = production, feature branches = previews).
- **CI/CD:** Vercel's Git integration builds on every push. Pull requests get an isolated **Preview Deployment** URL for testing with the organizing committee before merging.
- **Production:** merging to `main` triggers an atomic production deployment with instant rollback available from the Vercel dashboard.

### 9.2 Project Configuration

| Setting | Value |
|---|---|
| Framework preset | Next.js |
| Node.js version | 20.x |
| Build command | `next build` (default) |
| Install command | `npm ci` |
| Region | Singapore (`sin1`) — lowest latency to Myanmar; pin Supabase project to Southeast Asia as well |

### 9.3 Environment Variables

Configured in Vercel → Project → Settings → Environment Variables, scoped per environment (Development / Preview / Production):

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | All | Supabase project URL (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All | Public anon key (RLS-restricted) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Admin operations; never exposed to the client |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Server only | Rate limiting |
| `APP_BASE_URL` | All | Absolute URL for OTP email links |

Preview deployments point to a **separate staging Supabase project** so test ballots never touch production data.

### 9.4 Runtime Topology on Vercel

- **Static & ISR pages** (`/`, `/results` after publish) served from Vercel's Edge CDN.
- **Dynamic pages** (`/vote`, `/admin`) rendered as serverless SSR with per-request auth.
- **Route Handlers / Server Actions** run as serverless functions; ballot submission is kept on the Node runtime (not Edge) for stable Postgres connections via Supabase's connection pooler (port 6543, transaction mode).
- **Middleware** at the edge guards `/admin/*` and `/vote` routes by checking the session cookie before the request reaches a function.
- **Cron:** a Vercel Cron job (`/api/cron/close-election`) runs every minute during the event window to auto-close the election at `closes_at` if the admin forgets.

### 9.5 Deployment Checklist

1. Create Supabase project (Southeast Asia region); run schema migrations; enable RLS; create storage bucket `candidate-photos`.
2. Seed the admin user and set role claim.
3. Import eligible voter list (CSV).
4. Push repository to GitHub; import project into Vercel; set environment variables.
5. Verify Preview deployment end-to-end (login → vote → duplicate rejection → admin tally).
6. Promote to Production; set custom domain (e.g., `vote.mtu-event.com`) with automatic HTTPS.
7. Load-test ballot endpoint (k6, 200 concurrent virtual users) against staging.
8. On event day: open election from `/admin`, project `/results` page after publishing.

---

## 10. Security Requirements

| Area | Control |
|---|---|
| Transport | HTTPS enforced by Vercel; HSTS enabled |
| Authentication | Supabase Auth OTP; JWTs in `HttpOnly`, `Secure`, `SameSite=Lax` cookies |
| Authorization | Role checks server-side on every admin route; RLS as second layer so even a leaked anon key cannot read ballots |
| Vote integrity | DB unique constraint `(election_id, voter_id, category)`; server-side election-status check; votes immutable (no update/delete policy on `ballots`) |
| Rate limiting | 5 ballot attempts/min/user and IP-based limits on login endpoints |
| Input validation | Zod validation on all inputs; parameterized queries only (no string-built SQL) |
| Secrets | Service-role key exists only in Vercel server env; never in client bundles (`NEXT_PUBLIC_` prefix audit in CI) |
| File uploads | Photo uploads restricted to image MIME types, ≤ 5 MB, admin-only signed upload URLs |
| Ballot secrecy | Voter→candidate pairs never exposed via any API or export; aggregates only |
| Auditability | Append-only `audit_log` for all admin actions |

---

## 11. Testing Strategy

| Level | Tooling | Focus |
|---|---|---|
| Unit | Vitest | Zod schemas, tally computation, tie detection |
| Integration | Vitest + Supabase local (CLI) | Ballot insertion, unique-constraint rejection, RLS policies (attempt forbidden reads as voter role) |
| End-to-end | Playwright | Login → vote → confirm → duplicate blocked; admin open/close/publish flow |
| Load | k6 | 200–500 concurrent ballot submissions; p95 latency and error-rate thresholds |
| Security | Manual + CI checks | Attempt double-vote via direct API, vote while closed, access admin APIs as voter, verify no service key in client bundle |
| UAT | Organizing committee | Dry-run election on the Preview deployment one week before the event |

**Acceptance criteria (go/no-go):** zero successful duplicate ballots in load + E2E tests; admin can complete a full election lifecycle without developer intervention; results page renders correctly on the event projector.

---

## 12. Project Milestones

| Week | Deliverable |
|---|---|
| 1 | Repo + Vercel + Supabase setup; schema migrations; auth flow working |
| 2 | Candidate management (admin CRUD + photo upload); voter import |
| 3 | Voting flow (candidate grid, ballot submission, duplicate rejection) |
| 4 | Admin dashboard: election control, live tally, turnout |
| 5 | Results computation, publish flow, winner reveal page; exports |
| 6 | Testing (unit/integration/E2E/load), security review, documentation |
| 7 | UAT dry run with organizers; fixes; production cutover |

---

## 13. Future Enhancements

- Multi-election support in the UI (Prince/Princess, Best Costume categories).
- Burmese-language UI toggle (full my-MM localization).
- QR-code-based kiosk voting for students without smartphones.
- Photo moderation workflow and candidate self-registration with admin approval.
- Realtime public turnout counter (without tallies) to encourage participation.
- Analytics dashboard: votes over time, turnout by department.

---

## 14. Appendix

### A. Technology Version Matrix

| Component | Version |
|---|---|
| Next.js | 15.x |
| React | 19.x |
| TypeScript | 5.x |
| Tailwind CSS | 4.x |
| Supabase JS | 2.x |
| PostgreSQL | 15+ |
| Node.js (Vercel) | 20.x |

### B. Glossary of Status Values

`elections.status`: `scheduled` → `open` → `closed` → `published` (one-way transitions, enforced in the state-change endpoints and audit-logged).

### C. Risk Register (summary)

| Risk | Likelihood | Mitigation |
|---|---|---|
| Burst traffic overwhelms DB connections | Medium | Supabase pooler (transaction mode); serverless auto-scaling; load test beforehand |
| Students share OTP links | Medium | OTP bound to email + short expiry; one session per voter row |
| Admin error (closing early/late) | Medium | Confirmation dialogs; scheduled auto-close cron as backstop; reopen capability with audit trail |
| Free-tier limits exceeded | Low | Single-event scale fits comfortably; monitor Supabase/Vercel usage dashboards |
| Tie for first place | Low | Flagged to admin (FR-3.5); committee decides per event rules |

---

*End of Software Requirements Specification v1.0*
