<div align="center">

# 🚀 LC Company Tracker

**A modern, high-performance web platform to track and master LeetCode company-wise interview questions.**

[![Next.js](https://img.shields.io/badge/Next.js-16.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.19-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Auth.js](https://img.shields.io/badge/Auth.js-NextAuth_v5-purple?style=for-the-badge&logo=nextauth)](https://authjs.dev/)
[![React Query](https://img.shields.io/badge/React_Query-TanStack-FF4154?style=for-the-badge&logo=react-query)](https://tanstack.com/query/latest)
[![Driver.js](https://img.shields.io/badge/Driver.js-Tour-FFA116?style=for-the-badge)](https://driverjs.com/)

</div>

---

## ✨ Features

- 🏢 **650+ Company Tracks**: Comprehensive question lists organized by target companies (Google, Meta, Amazon, Apple, Microsoft, Netflix, Uber, etc.).
- 🔄 **Automated LeetCode Sync**: Seamless background incremental & full sync via LeetCode GraphQL with optional encrypted `LEETCODE_SESSION` cookie support.
- 🔐 **Dual Authentication**: Google OAuth (NextAuth v5) for cloud persistence and Guest Mode for instant browser-local exploration.
- 🤖 **Automated Upstream Sync Worker**: Autonomous GitHub Action worker daily checks upstream repositories for question updates and applies non-destructive incremental Prisma upserts.
- 🎯 **Interactive Onboarding Tour**: Built-in Driver.js guided walkthrough with spotlight on LeetCode session cookie setup.
- ⚡ **Ultra-Fast Database Query Engine**: Supabase connection pooler, multi-tenant Prisma schema, and indexed aggregations (<20ms response time).
- 🔍 **Real-Time Debounced Search**: Instant search experience across 650+ companies with 250ms debouncing to prevent server load.
- 📊 **Interactive Analytics**: Global solve progress, difficulty breakdowns (Easy/Medium/Hard), daily streaks, and recent activity logs.
- 🎨 **Premium Obsidian Aesthetics**: Dark glassmorphic design system, gradient progress indicators, and dynamic micro-animations.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | [Next.js 16 (App Router + Turbopack)](https://nextjs.org/) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) |
| **Authentication** | [Auth.js / NextAuth v5](https://authjs.dev/) (Google OAuth + Guest Mode) |
| **Database & ORM** | [Supabase PostgreSQL](https://supabase.com/) via [Prisma ORM](https://www.prisma.io/) |
| **State Management** | [Zustand](https://github.com/pmndrs/zustand) & [TanStack React Query](https://tanstack.com/query) |
| **Guided Onboarding** | [Driver.js](https://driverjs.com/) |
| **Styling & UI** | [Tailwind CSS v4](https://tailwindcss.com/), [Lucide React](https://lucide.dev/), [Framer Motion](https://www.framer.com/motion/) |

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v20.0.0 or higher
- **npm**: v9.0.0 or higher
- **Supabase Account**: (or PostgreSQL database instance)

### 2. Environment Configuration

Copy `.env.example` to `.env` and fill in your connection strings and Google OAuth credentials:

```bash
cp .env.example .env
```

```env
DATABASE_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your_32_character_secret_here"
GOOGLE_CLIENT_ID="your_google_client_id"
GOOGLE_CLIENT_SECRET="your_google_client_secret"
ADMIN_EMAIL="your_admin_email@domain.com"
NEXT_PUBLIC_ADMIN_EMAIL="your_admin_email@domain.com"
```

### 3. Installation & Database Setup

```bash
# Navigate to webapp folder
cd webapp

# Install dependencies
npm install

# Push database schema & generate Prisma Client
npx prisma db push
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌐 Production Deployment (Vercel)

1. Connect the `01MASTERS/Leetcode-Companion` GitHub repository to [Vercel](https://vercel.com).
2. Set the **Root Directory** to `webapp` (or leave default root `/` as root `vercel.json` will route to webapp).
3. Under **Environment Variables**, add:
   - `DATABASE_URL` (Supabase transaction pooler port 6543)
   - `DIRECT_URL` (Supabase session port 5432)
   - `NEXTAUTH_SECRET` (Run `openssl rand -base64 32`)
   - `NEXTAUTH_URL` (`https://<your-project-name>.vercel.app`)
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `ADMIN_EMAIL`
   - `NEXT_PUBLIC_ADMIN_EMAIL`
4. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), add your production callback URL to **Authorized redirect URIs**:
   - `https://<your-project-name>.vercel.app/api/auth/callback/google`
5. Click **Deploy**.

---

## 📡 API Endpoints

- `GET /api/companies?search=&filter=&sort=&page=&limit=` - Returns filtered, sorted, paginated company list with completion stats.
- `GET /api/companies/[slug]` - Returns detailed question track for a specific company slug.
- `GET /api/stats` - Returns global overall statistics, difficulty breakdown, streak, and sync status.
- `POST /api/leetcode-sync` - Triggers full or incremental synchronization with user's LeetCode account.
- `GET /api/problems/[id]` - Returns problem metadata, company frequency breakdown, and personal notes.
- `GET /api/catalog/sync-status` - Returns latest upstream sync metadata, commit SHA, and company count.

---

## 🙏 Acknowledgments & Credits

Special credit and appreciation to **[Snehasish Roy](https://github.com/snehasishroy)** and the contributors to **[snehasishroy/leetcode-companywise-interview-questions](https://github.com/snehasishroy/leetcode-companywise-interview-questions)** for curating and maintaining the original question dataset that powers this application.

---

<div align="center">
  <sub>Built with ❤️ for algorithm interview preparation.</sub>
</div>

