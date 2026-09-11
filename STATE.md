# 🧭 Project State & Execution Tracker

> **Instructions for Agents & Developers**:  
> Always read this file at the start of any session to restore project context across chats.  
> Update this file whenever a phase, milestone, or major architectural decision is completed.

---

## 📌 Executive Summary

* **Project Name**: LeetCode Companion
* **Repository**: [https://github.com/01MASTERS/Leetcode-Companion](https://github.com/01MASTERS/Leetcode-Companion)
* **Current Status**: 🚀 **Phase 3 Completed — Ready for Phase 4 (Upstream Sync Pipeline)**
* **Active Phase**: **Phase 4: Autonomous Upstream Sync Pipeline (Approach 2 Engine)**
* **Upstream Data Source**: [snehasishroy/leetcode-companywise-interview-questions](https://github.com/snehasishroy/leetcode-companywise-interview-questions)
* **Cloud Database**: **Supabase (PostgreSQL 17.6)** (`nlvcttlenjcntekgarat` in `ap-south-1`)

---

## 📊 Phase Execution Progress

| Phase | Description | Status | Target Deliverable |
| :---: | :--- | :---: | :--- |
| **0** | **Repo Detach & Setup** | ✅ **Completed** | Standalone repo created on GitHub (`01MASTERS/Leetcode-Companion`), history cleaned, initial commit pushed. |
| **1** | **Cloud DB Migration** | ✅ **Completed** | Supabase (PostgreSQL) setup, multi-tenant Prisma schema (`UserProblemProgress`, `SyncMetadata`), 658 companies & 3,399 problems seeded, API routes updated & verified. |
| **2** | **Auth & Guest Mode** | ✅ **Completed** | Auth.js v5 with Google OAuth, Navbar user avatar/dropdown & Guest Mode sign-in buttons, GuestGateModal, role-gating on API routes (`/api/leetcode-sync`, `/api/problems/[id]`). |
| **3** | **Landing Page & Routing** | ✅ **Completed** | High-converting Public Landing at `/` focused on figures/metrics, auto-redirect to `/dashboard` for logged-in users, prominent Google Sign-In & Guest exploration CTAs. |
| **4** | **Upstream Sync Pipeline** | ⏳ **Ready to Start** | Autonomous GitHub Action + incremental Prisma upsert worker (Approach 2 Engine) for zero-downtime updates. |
| **5** | **Catalog Freshness UI** | ⏸️ Queued | Minimalist relative time header banner (`⚡ Questions updated: Yesterday`) with hover popover for exact details, per-company badge, audit log modal. |
| **6** | **Driver.js Tour** | ⏸️ Queued | Interactive step-by-step tooltip walkthrough with spotlight explaining the optional `LEETCODE_SESSION` cookie. |
| **7** | **Production Deployment** | ⏸️ Queued | Vercel deployment + production secrets + Google OAuth redirect URIs + end-to-end verification. |

---

## 🏛️ Core Architectural Decisions (Locked)

1. **Database**:
   * **Supabase (PostgreSQL)** active in production/dev.
   * Replaced local SQLite `dev.db`.
   * Separate tables for master catalog data (`Company`, `Problem`, `CompanyProblem`) vs user progress (`UserProblemProgress`, `UserStats`, `UserSyncConfig`).
2. **Authentication & Access Control**:
   * **Auth.js v5 (NextAuth)** with **Google OAuth**.
   * **Guest Mode ("Continue as Guest")**: Unauthenticated visitors can browse all 650+ companies, search, and track solves locally in `localStorage`.
   * Cloud features (cloud sync, `LEETCODE_SESSION` cookie storage, cross-device notes) are gated with a sign-in modal.
3. **Question Catalog Freshness UI**:
   * **Minimalist Global Banner**: Kept short in the header (e.g. `⚡ Questions updated: Yesterday` or `2 days ago` / `Last week` / `Last month`).
   * **Hover Popover**: Hovering reveals exact timestamp, upstream commit SHA link, and updated companies count. Clicking opens the full audit log modal.
   * **Per-Company Badge**: Shows recency of question updates inside each company view.
4. **Onboarding & LeetCode Session Spotlight**:
   * **Driver.js** guided tooltip tour for first-time visitors/users.
   * Includes a dedicated step explaining what the LeetCode Session Cookie is (100% exact solve tracking) while emphasizing it is **completely optional**.

---

## 📝 Recent Change Log

* **2026-09-11**:
  * **Critical Bug Fixes (Stats & LeetCode Sync Pipeline)**:
    * **Fix 1 (`stats.overall.solvedProblems` TypeError)**: Realigned `/api/stats` endpoint return structure to match frontend `Stats` interface (`stats.overall`, `stats.difficulties`, `stats.companies`, `stats.syncConfig`), and added defensive optional chaining across `Dashboard` KPI cards and `Navbar`.
    * **Fix 2 (`P2028: Transaction API timeout` on LeetCode Sync)**: Replaced sequential individual `tx.userProblemProgress.upsert` queries inside Prisma interactive transactions with high-performance PostgreSQL chunked batch upserts (`INSERT ... ON CONFLICT DO UPDATE`), cutting sync time from >10s (timeout) to ~1.3s for 100+ problems.
    * **Fix 3 (Cookie Token Parsing & Username Sanitization)**: Added robust `extractSessionCookie()` to strip quotes, `LEETCODE_SESSION=` prefixes, and header noise; added `cleanUsername()` to strip URL prefixes (e.g. `leetcode.com/u/xxx`); and exposed transparent cookie verification feedback in `SettingsPage`.
    * **Fix 4 (Recent Solves & Activity Log Sync Precision)**:
      * Fixed the Recent Solves section and `ActivityLog` on first sync. Previously, arbitrary filler questions were assigned `latestTimestamp` / `now()`, flooding Recent Solves with random problem IDs and identical timestamps.
      * Refactored `batchUpsertProgress` to set `solvedAt: Date` ONLY for problems present in LeetCode's accepted submissions (`recentAcSubmissionList`). All historical/filler solves receive `solvedAt: null`.
      * Preserved exact descending chronological order of LeetCode submissions and filtered strictly to problems that exist in our 3,399 dataset catalog.
      * Restricted `ActivityLog` entries exclusively to genuine recent solves matching our catalog.
      * Added `calculateStreak` helper to compute actual active daily solve streaks from real LeetCode submission timestamps.
      * Updated Google OAuth Client ID and Client Secret in `webapp/.env`.
  * **Phase 3 Completed**:
    * Created high-converting Public Landing Page at `/` with heavy emphasis on figures and real-time metrics:
      * 4 Core Metric cards: **658 Companies Active**, **3,399 Unique Questions Cataloged**, **17,819 Frequency Tags**, and **< 1.5s Batch Upsert Performance**.
      * Multi-segment difficulty distribution bar displaying the exact database split: 819 Easy (24.1%), 1,805 Medium (53.1%), and 775 Hard (22.8%).
      * Top Tech Giants leaderboard with real database problem counts (Google: 2,325, Amazon: 1,988, Microsoft: 1,386, Meta: 1,381, Bloomberg: 1,213, Uber: 362, TikTok: 349, Oracle: 313).
      * Feature pillars detailing Automated LeetCode Sync, Company Progress Analytics, and Interview Notes & Starred Bank.
      * High-visibility **"Sign in with Google"** and **"Explore as Guest"** CTA buttons with radiant glow.
    * Separated routes cleanly: relocated main company tracker to `/dashboard`.
    * Implemented seamless routing: authenticated users opening `/` are automatically redirected to `/dashboard`.
    * Conditionally hid `Sidebar` and `Navbar` when on `/` to provide a stunning full-width canvas.
    * Verified visual layout and guest navigation end-to-end via headless browser testing.
  * **Phase 2 Completed**:
    * Installed `next-auth@5.0.0-beta.32` and `@auth/prisma-adapter@2.11.3`.
    * Configured Auth.js with Google OAuth provider, JWT session strategy, and Prisma adapter in `webapp/auth.ts` and `webapp/app/api/auth/[...nextauth]/route.ts`.
    * Added Google OAuth credentials in `webapp/.env`.
    * Wrapped Root Layout with `<SessionProvider>` in `webapp/components/Providers.tsx`.
    * Updated `webapp/lib/auth-helper.ts` to seamlessly authenticate requests via `await auth()` returning session user ID.
    * Added Guest Mode access control across `/api/companies`, `/api/companies/[slug]`, `/api/problems/[id]`, `/api/stats`, and `/api/leetcode-sync`.
    * Built `webapp/components/GuestGateModal.tsx` for prompting guest visitors when attempting cloud-only actions.
    * Upgraded `webapp/components/Navbar.tsx` with user avatar dropdown, name/email, settings link, sign-out button, and guest mode badge with Google sign-in button.
    * Integrated guest modal triggers in `ProblemModal.tsx` (notes & bookmarks) and `company/[slug]/page.tsx` (solve toggling).
    * Enhanced `SettingsPage` with guest mode banner and sign-in CTA.
    * Verified with `npx tsc --noEmit` and production build (`npm run build`). Committed and pushed to `main`.
  * **Phase 1 Completed**:
    * Provisioned Supabase PostgreSQL project `leetcode-companion` (`nlvcttlenjcntekgarat`) in region `ap-south-1` via Supabase MCP.
    * Configured connection pooling and direct connection URLs in `webapp/.env` and `.env.example`.
    * Upgraded `schema.prisma` from SQLite to PostgreSQL with full multi-tenant data architecture (`User`, `Account`, `Session`, `UserProblemProgress`, `UserStats`, `UserSyncConfig`, `SyncMetadata`).
    * Pushed schema to Supabase (`npx prisma db push`).
    * Updated `prisma/seed.ts` with non-destructive PostgreSQL batch insertions; seeded 658 companies, 3,399 unique problems, and 17,819 company-problem relations in 21 seconds.
    * Rewrote all backend API routes to be PostgreSQL-compliant and multi-tenant aware.
    * Verified build with zero errors.
  * Established `STATE.md` and `ROADMAP.md` tracking all 7 phases.

---

## 🎯 Next Immediate Action

👉 **Execute Phase 4: Autonomous Upstream Sync Pipeline (Approach 2 Engine)**:
1. Create GitHub Actions workflow (`.github/workflows/upstream-sync.yml`) triggered on daily cron and manual `workflow_dispatch`.
2. Implement incremental sync worker script (`scripts/sync-upstream.ts`):
   - Clone/fetch upstream repository `snehasishroy/leetcode-companywise-interview-questions`.
   - Compute commit SHA diff or file hash checks against `SyncMetadata` in Supabase.
   - Incrementally parse new/modified company CSVs and batch upsert new problems and company-problem links without dropping user progress.
   - Record sync run in `SyncMetadata` (commit SHA, timestamp, companies updated count).
3. Test pipeline against Supabase database to verify zero-downtime execution.

