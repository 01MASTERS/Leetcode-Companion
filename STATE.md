# 🧭 Project State & Execution Tracker

> **Instructions for Agents & Developers**:  
> Always read this file at the start of any session to restore project context across chats.  
> Update this file whenever a phase, milestone, or major architectural decision is completed.

---

## 📌 Executive Summary

* **Project Name**: LeetCode Companion
* **Repository**: [https://github.com/01MASTERS/Leetcode-Companion](https://github.com/01MASTERS/Leetcode-Companion)
* **Current Status**: 🚀 **Architecture & Planning Finalized — Ready for Phase 1**
* **Active Phase**: **Phase 1: Cloud Database Migration (Supabase PostgreSQL)**
* **Upstream Data Source**: [snehasishroy/leetcode-companywise-interview-questions](https://github.com/snehasishroy/leetcode-companywise-interview-questions)

---

## 📊 Phase Execution Progress

| Phase | Description | Status | Target Deliverable |
| :---: | :--- | :---: | :--- |
| **0** | **Repo Detach & Setup** | ✅ **Completed** | Standalone repo created on GitHub (`01MASTERS/Leetcode-Companion`), history cleaned, initial commit pushed. |
| **1** | **Cloud DB Migration** | ⏳ **In Progress** | Supabase (PostgreSQL) setup, multi-tenant Prisma schema (`UserProblemProgress`, `SyncMetadata`), non-destructive upsert seed. |
| **2** | **Auth & Guest Mode** | ⏸️ Queued | Auth.js v5 with Google OAuth, Navbar avatar/logout, Guest Mode with `localStorage` fallback & cloud lockouts. |
| **3** | **Landing Page & Routing** | ⏸️ Queued | Public Hero Landing at `/` for guests, auto-redirect to `/dashboard` for logged-in users, CTAs for Google Sign-In & Guest exploration. |
| **4** | **Upstream Sync Pipeline** | ⏸️ Queued | Autonomous GitHub Action + incremental Prisma upsert worker (Approach 2 Engine) for zero-downtime updates. |
| **5** | **Catalog Freshness UI** | ⏸️ Queued | Minimalist relative time header banner (`⚡ Questions updated: Yesterday`) with hover popover for exact details, per-company badge, audit log modal. |
| **6** | **Driver.js Tour** | ⏸️ Queued | Interactive step-by-step tooltip walkthrough with spotlight explaining the optional `LEETCODE_SESSION` cookie. |
| **7** | **Production Deployment** | ⏸️ Queued | Vercel deployment + production secrets + Google OAuth redirect URIs + end-to-end verification. |


---

## 🏛️ Core Architectural Decisions (Locked)

1. **Database**:
   * **Supabase (PostgreSQL)** selected as the cloud database.
   * Replaces local SQLite `dev.db`.
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
  * Created standalone GitHub repository `01MASTERS/Leetcode-Companion`.
  * Detached local repository from upstream fork, removed legacy git history, and established fresh `main` branch with `Initial commit`.
  * Clarified and finalized all 6 core product requirements from Google Keep checklist.
  * Formulated and committed comprehensive [ROADMAP.md](file:///c:/Users/ravis/OneDrive/Desktop/Projectsgpt/Leetcode-companion/ROADMAP.md).
  * Refined Phase 4 banner to use concise relative timestamps with rich hover popovers.
  * Established `STATE.md` for continuous cross-chat context persistence.

---

## 🎯 Next Immediate Action

👉 **Execute Phase 1**:
1. Obtain Supabase PostgreSQL connection string (`DATABASE_URL` and `DIRECT_URL`).
2. Update `webapp/prisma/schema.prisma` datasource from `sqlite` to `postgresql`.
3. Restructure schema for multi-tenancy (`UserProblemProgress`, `SyncMetadata`).
4. Update `seed.ts` with batch upsert queries and push schema to Supabase (`npx prisma db push`).
