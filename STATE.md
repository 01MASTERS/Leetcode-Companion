# 🧭 Project State & Execution Tracker

> **Instructions for Agents & Developers**:  
> Always read this file at the start of any session to restore project context across chats.  
> Update this file whenever a phase, milestone, or major architectural decision is completed.

---

## 📌 Executive Summary

* **Project Name**: LeetCode Companion
* **Repository**: [https://github.com/01MASTERS/Leetcode-Companion](https://github.com/01MASTERS/Leetcode-Companion)
* **Current Status**: 🚀 **Phase 1 Completed — Ready for Phase 2 (Google OAuth & Guest Mode)**
* **Active Phase**: **Phase 2: Auth.js Google OAuth & Guest Mode Access Control**
* **Upstream Data Source**: [snehasishroy/leetcode-companywise-interview-questions](https://github.com/snehasishroy/leetcode-companywise-interview-questions)
* **Cloud Database**: **Supabase (PostgreSQL 17.6)** (`nlvcttlenjcntekgarat` in `ap-south-1`)

---

## 📊 Phase Execution Progress

| Phase | Description | Status | Target Deliverable |
| :---: | :--- | :---: | :--- |
| **0** | **Repo Detach & Setup** | ✅ **Completed** | Standalone repo created on GitHub (`01MASTERS/Leetcode-Companion`), history cleaned, initial commit pushed. |
| **1** | **Cloud DB Migration** | ✅ **Completed** | Supabase (PostgreSQL) setup, multi-tenant Prisma schema (`UserProblemProgress`, `SyncMetadata`), 658 companies & 3,399 problems seeded, API routes updated & verified. |
| **2** | **Auth & Guest Mode** | ⏳ **Ready to Start** | Auth.js v5 with Google OAuth, Navbar avatar/logout, Guest Mode with `localStorage` fallback & cloud lockouts. |
| **3** | **Landing Page & Routing** | ⏸️ Queued | Public Hero Landing at `/` for guests, auto-redirect to `/dashboard` for logged-in users, CTAs for Google Sign-In & Guest exploration. |
| **4** | **Upstream Sync Pipeline** | ⏸️ Queued | Autonomous GitHub Action + incremental Prisma upsert worker (Approach 2 Engine) for zero-downtime updates. |
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
  * **Phase 1 Completed**:
    * Provisioned Supabase PostgreSQL project `leetcode-companion` (`nlvcttlenjcntekgarat`) in region `ap-south-1` via Supabase MCP.
    * Configured connection pooling and direct connection URLs in `webapp/.env` and `.env.example`.
    * Upgraded `schema.prisma` from SQLite to PostgreSQL with full multi-tenant data architecture (`User`, `Account`, `Session`, `UserProblemProgress`, `UserStats`, `UserSyncConfig`, `SyncMetadata`).
    * Pushed schema to Supabase (`npx prisma db push`).
    * Updated `prisma/seed.ts` with non-destructive PostgreSQL batch insertions; seeded 658 companies, 3,399 unique problems, and 17,819 company-problem relations in 21 seconds.
    * Rewrote all backend API routes (`/api/companies`, `/api/companies/[slug]`, `/api/problems/[id]`, `/api/stats`, `/api/leetcode-sync`) to be PostgreSQL-compliant and multi-tenant aware.
    * Verified full TypeScript type checking (`npx tsc --noEmit`) and production build (`npm run build`) with zero errors.
  * Established `STATE.md` and `ROADMAP.md` tracking all 7 phases and Approach 2 engine.

---

## 🎯 Next Immediate Action

👉 **Execute Phase 2**:
1. Install Auth.js v5 (`next-auth@beta`, `@auth/prisma-adapter`).
2. Configure Google OAuth provider and route handler `/api/auth/[...nextauth]/route.ts`.
3. Build Navbar User Profile dropdown (avatar, name, sign-in, logout).
4. Implement Guest Mode state handling with `localStorage` fallback and cloud-feature lockouts.

