# 🧭 Project State & Execution Tracker

> **Instructions for Agents & Developers**:  
> Always read this file at the start of any session to restore project context across chats.  
> Update this file whenever a phase, milestone, or major architectural decision is completed.

---

## 📌 Executive Summary

* **Project Name**: LeetCode Companion
* **Repository**: [https://github.com/01MASTERS/Leetcode-Companion](https://github.com/01MASTERS/Leetcode-Companion)
* **Current Status**: 🚀 **All 7 Phases Completed & Deployed to Main**
* **Active Status**: Production Ready & Monorepo Vercel Pre-Configured
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
| **4** | **Upstream Sync Pipeline** | ✅ **Completed** | Autonomous GitHub Action (`.github/workflows/upstream-sync.yml`) + incremental Prisma upsert worker (`scripts/sync-upstream.ts`) for zero-downtime updates. |
| **5** | **Catalog Freshness UI** | ✅ **Completed** | Minimalist relative time header banner (`Questions updated Today`), admin-only commit popover and full audit modal, and exact Git commit dates matched for all 658 companies. |
| **6** | **Driver.js Guided Tours** | ✅ **Completed** | Modular 3-step contextual tours for Dashboard, Company pages, and Settings with dark obsidian glassmorphic popovers. |
| **7** | **Production Deployment** | ✅ **Completed** | Vercel monorepo config (`vercel.json`), root `package.json` proxy scripts, GitHub Actions CI pipeline, Prisma postinstall generation hook, and comprehensive documentation. |

---

## 🏛️ Core Architectural Decisions (Locked)

1. **Database & Connection Pooling**:
   * **Supabase (PostgreSQL)** active in production/dev.
   * Transaction connection pooler on port 6543 (`?pgbouncer=true`) for Next.js App Router serverless invocations; session direct pooler on port 5432 for migrations and Prisma client generation.
   * Separate tables for master catalog data (`Company`, `Problem`, `CompanyProblem`) vs user progress (`UserProblemProgress`, `UserStats`, `UserSyncConfig`).
2. **Authentication & Access Control**:
   * **Auth.js v5 (NextAuth)** with **Google OAuth**.
   * **Guest Mode ("Continue as Guest")**: Unauthenticated visitors can browse all 650+ companies, search, and track solves locally in `localStorage`.
   * Cloud features (cloud sync, `LEETCODE_SESSION` cookie storage, cross-device notes) are gated with a sign-in modal.
3. **Question Catalog Freshness UI**:
   * **Minimalist Global Banner**: Kept clean and typography-focused in the header (`Questions updated Today` / `x days ago` with no green dot and no spark icon).
   * **Role-Gated Admin Tools**: Hover popover with upstream commit SHA and full sync audit modal are gated to administrator account (`ravisharma09030@gmail.com`).
   * **Per-Company Last Updated**: Clean relative timestamp matched against original repository Git commit dates across all 658 companies.
4. **Contextual Onboarding Tours (Driver.js)**:
   * Modular 3-step tours tailored for:
     - Dashboard (`/dashboard`): Search, Overall Metrics, Companies Grid.
     - Company Track (`/company/[slug]`): Recency Categories, Problem Matrix, Continue Learning Action.
     - Settings (`/settings`): Username, Session Cookie, and Why Note.
   * Re-launchable on any page via the `?` icon in the navbar or user dropdown.
5. **Production Deployment & Monorepo Structure**:
   * Pre-configured for seamless Vercel deployment with root `vercel.json` and `webapp/vercel.json`.
   * `"postinstall": "prisma generate"` script guarantees Prisma client generation during cloud builds.

---

## 📝 Recent Change Log

* **2026-09-11**:
  * **Phase 7 Completed**:
    * Added root `vercel.json` and `webapp/vercel.json` for monorepo routing.
    * Added root `package.json` forwarding `build`, `postinstall`, `lint`, and `sync:upstream` scripts to `webapp/`.
    * Added `"postinstall": "prisma generate"` to `webapp/package.json` for Vercel deployment.
    * Created GitHub Actions CI pipeline ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) validating builds on pushes and PRs.
    * Redrafted comprehensive `README.md` and `webapp/README.md` with architecture diagram, feature matrix, and acknowledgments to upstream repo `snehasishroy/leetcode-companywise-interview-questions`.
  * **Phase 6 Completed & Refined**:
    * Installed and configured `driver.js`.
    * Designed custom dark glassmorphism styling in `globals.css` (`.driver-popover`, orange `#ffa116` buttons, gold active outline).
    * Implemented modular, context-aware 3-step tours for Dashboard, Company pages, and Settings.
    * Replaced native HTML `<select>` on Dashboard with a custom glassmorphic dropdown, eliminating the default Windows OS blue highlight.
  * **Phase 5 Completed**:
    * Deployed Minimalist Header Freshness Badge displaying relative update timestamps.
    * Created `FreshnessBadge.tsx` and `SyncHistoryModal.tsx`.
    * Created `useIsAdmin` hook gating audit modal and commit popover strictly to administrator email.
    * Synced all 658 companies in Supabase PostgreSQL with exact Git commit timestamps from the original upstream repository.
  * **Phase 4 Completed**:
    * Built autonomous GitHub Actions ingestion worker ([`.github/workflows/upstream-sync.yml`](.github/workflows/upstream-sync.yml)).
    * Created incremental sync engine (`webapp/scripts/sync-upstream.ts`).
    * Created `/api/catalog/sync-status` API endpoint.

---

## 🎯 Next Opportunities (Post-v1.0 Enhancements)

With the core 7-phase roadmap 100% complete, potential future enhancements include:
1. **LeetCode Contest & Daily Challenge Tracker**: Real-time widget tracking today's daily question and upcoming contest reminders.
2. **Problem Solution Hints & Code Snippets**: Markdown notes editor with syntax highlighting and private solution scratchpad per problem.
3. **Company Tag Bundles & Custom Playlists**: Ability for users to create custom question playlists (e.g. "Google L4 Fast Track", "Meta Top 50").
4. **Mock Interview Timer Mode**: 45-minute timed simulation mode for any company track.
