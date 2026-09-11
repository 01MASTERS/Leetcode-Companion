<div align="center">

# 🚀 LeetCode Companion & Company Tracker

**A modern, cloud-native full-stack platform to practice, track, and master LeetCode interview questions curated from 650+ top tech companies.**

[![Next.js 16](https://img.shields.io/badge/Next.js-16.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.19-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Auth.js](https://img.shields.io/badge/Auth.js-NextAuth_v5-purple?style=for-the-badge&logo=nextauth)](https://authjs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![Driver.js](https://img.shields.io/badge/Driver.js-Tour-FFA116?style=for-the-badge)](https://driverjs.com/)
[![CI / Upstream Cron](https://img.shields.io/badge/GitHub_Actions-Automated_Sync-2088FF?style=for-the-badge&logo=github-actions)](https://github.com/01MASTERS/Leetcode-Companion/actions)

<br/>

</div>

---

## 🌟 Overview

Preparing for technical coding interviews requires focusing on the **exact questions companies actually ask**, prioritized by **interview frequency** and **recency**.

Traditional question lists often come trapped inside static CSV files or unmaintained markdown tables that require manual file editing and lack automated progress synchronization. 

**LeetCode Companion** transforms raw company-wise question datasets into a high-performance, real-time web application. It features automated LeetCode progress synchronization, dual authentication (Google OAuth & Guest Mode), interactive onboarding walkthroughs, and an autonomous daily ingestion pipeline.

---

## ✨ Key Features

| Feature | Description |
| :--- | :--- |
| 🏢 **650+ Company Tracks** | Curated question sets for Google, Meta, Amazon, Microsoft, Apple, Netflix, Uber, Bloomberg, and 640+ others. |
| ⏱️ **Recency Buckets** | Filter questions asked in the **Last 30 Days**, **Last 3 Months**, **Last 6 Months**, **Last 1 Year**, or **All-Time**. |
| 🔄 **Automated LeetCode Sync** | Incremental background sync queries your LeetCode solved history via public username or optional encrypted `LEETCODE_SESSION` cookie. |
| 🔐 **Dual Auth & Guest Mode** | Immediate guest access saved locally to browser storage, or Google sign-in for cross-device cloud sync and notes. |
| 🎯 **Contextual Guided Tours** | 3-step Driver.js walkthroughs customized for the Dashboard, individual Company Tracks, and Settings. |
| 🤖 **Autonomous Upstream Pipeline**| Scheduled daily GitHub Actions worker that pulls upstream question updates and applies non-destructive incremental Prisma upserts. |
| 📊 **Analytics & Daily Streaks** | Track overall solved statistics, completion percentages, difficulty distribution (Easy/Medium/Hard), and consecutive coding streaks. |
| 🎨 **Obsidian Glassmorphism** | Obsidian dark aesthetic, responsive fluid layouts, smooth animated transitions, and zero unstyled native elements. |

---

## 🏗️ Architecture

```mermaid
graph TD
    subgraph Data Sources
        UP[Upstream Question Repo<br/>snehasishroy/leetcode-companywise-interview-questions] -->|Daily Cron / Workflow| GA[GitHub Actions Worker]
        LC[LeetCode GraphQL API] -->|Auto-Sync Engine| API[Next.js App Router API]
    end

    subgraph Backend & Storage
        GA -->|Prisma Upsert| DB[(Supabase PostgreSQL)]
        API -->|Prisma ORM| DB
    end

    subgraph Client Application
        API -->|JSON Data| WEB[Next.js 16 Webapp]
        WEB --> NAV[Navbar & Freshness Indicator]
        WEB --> DASH[Dashboard & 650+ Companies]
        WEB --> COMP[Company Tracks & Problem Matrix]
        WEB --> SETT[Settings & LeetCode Session Setup]
        WEB --> TOUR[Driver.js Guided Tours]
    end
```

---

## 📁 Repository Structure

```
Leetcode-companion/
├── webapp/                 # 🌐 Full-stack Next.js 16 + Tailwind CSS v4 application
│   ├── app/                # App Router (/, /dashboard, /company/[slug], /settings, /statistics)
│   │   ├── api/            # REST API endpoints (companies, stats, sync, auth)
│   │   ├── globals.css     # Design tokens & Driver.js glassmorphic overrides
│   │   └── layout.tsx      # Root layout with providers, navigation & global modals
│   ├── components/         # Reusable UI components (Navbar, Sidebar, ProblemModal, etc.)
│   ├── prisma/             # Multi-tenant Prisma schema and Supabase configurations
│   ├── scripts/            # Upstream ingestion & Git commit date matching scripts
│   └── store/              # Zustand global tracker state
├── question-lists/         # 📊 650+ company folders containing CSV interview problem sets
├── scraper/                # 🕷️ Java Selenium scraper to update question datasets
├── .github/workflows/      # ⚙️ CI pipeline and scheduled daily upstream sync cron
├── run-backend.bat         # ⚡ Windows one-click launcher for the web application
├── run-webapp.bat          # ⚡ Alias launcher for the web application
├── vercel.json             # 🚀 Vercel production deployment configuration
└── ROADMAP.md              # 🗺️ Detailed 7-phase milestone roadmap and specifications
```

---

## 🚀 Getting Started (Local Development)

### 1. Prerequisites
- **Node.js**: v20.0.0 or higher
- **npm**: v9.0.0 or higher
- **Supabase**: Free Supabase PostgreSQL project (or any standard PostgreSQL instance)

### 2. Environment Configuration

Navigate to the `webapp/` directory and configure `.env`:

```bash
cd webapp
cp .env.example .env
```

Fill in your connection strings and Google OAuth credentials:

```env
# Supabase Transaction connection pooler (port 6543)
DATABASE_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"

# Supabase Direct connection / session pooler (port 5432)
DIRECT_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

# NextAuth v5
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate_a_random_32_character_secret"

# Google OAuth Credentials
GOOGLE_CLIENT_ID="your_google_client_id"
GOOGLE_CLIENT_SECRET="your_google_client_secret"

# Admin Account (Unlocks catalog audit history and commit inspector)
ADMIN_EMAIL="your_admin_email@domain.com"
NEXT_PUBLIC_ADMIN_EMAIL="your_admin_email@domain.com"
```

### 3. Install & Initialize Database

```bash
# Install dependencies
npm install

# Push Prisma schema to Supabase & generate client
npx prisma db push
```

### 4. Run Development Server

```bash
npm run dev
```

Or on Windows, simply double-click **`run-backend.bat`**.

Open [http://localhost:3000](http://localhost:3000) to access the application.

---

## 🌐 Production Deployment (Vercel)

This repository includes full monorepo and subfolder deployment configuration:

1. Import `01MASTERS/Leetcode-Companion` on [Vercel](https://vercel.com).
2. Set **Root Directory** to `webapp` (or leave default root `/`, as root `vercel.json` and `package.json` automatically forward builds).
3. Configure the **Environment Variables** in Vercel:
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL` (`https://<your-project>.vercel.app`)
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `ADMIN_EMAIL`
   - `NEXT_PUBLIC_ADMIN_EMAIL`
4. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), add your production callback URL to **Authorized redirect URIs**:
   - `https://<your-project>.vercel.app/api/auth/callback/google`
5. In GitHub repository settings under **Secrets and variables > Actions**, add `DATABASE_URL` to enable automated daily upstream syncing.

---

## 🤖 Automated Upstream Sync Pipeline

The repository includes a standalone background worker workflow ([`.github/workflows/upstream-sync.yml`](.github/workflows/upstream-sync.yml)):
- Runs automatically **every day at 04:00 UTC** and supports manual dispatch (`workflow_dispatch`).
- Checks upstream commits, downloads newly modified company CSV files, and runs incremental upserts.
- **100% Non-Destructive**: Never overwrites user solved records, completion progress, or personal problem notes.
- Logs each sync run to the database audit trail viewable by administrators.

---

## 🙏 Acknowledgments & Credits

Special thanks and credit go to **[Snehasish Roy](https://github.com/snehasishroy)** and the contributors of the original **[snehasishroy/leetcode-companywise-interview-questions](https://github.com/snehasishroy/leetcode-companywise-interview-questions)** repository. 

Their dedication in collecting, scraping, and maintaining the raw company-wise CSV question lists provided the foundational dataset that inspired and powers the question catalog in this application. This project builds upon that data by delivering an automated, full-stack tracker, cloud database layer, and modern web experience for the developer community.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

<div align="center">
  <sub>Built with ❤️ for algorithm mastery and interview success.</sub>
</div>
