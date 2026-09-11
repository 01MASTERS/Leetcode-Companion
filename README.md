# LeetCode Companion & Company-Wise Question Tracker

![leetcode-companywise-interview-questions](https://socialify.git.ci/snehasishroy/leetcode-companywise-interview-questions/image?description=1&font=JetBrains+Mono&forks=1&language=1&name=1&owner=1&pattern=Solid&stargazers=1&theme=Dark)

A cloud-native, full-stack platform to track, master, and practice LeetCode interview questions curated from 650+ tech companies categorized by recency (Last 30 Days, Last 3 Months, Last 6 Months, Last 1 Year, All-Time), with automated LeetCode progress synchronization, Google OAuth, and an interactive onboarding tour.

---

## 📁 Repository Architecture

```
Leetcode-companion/
├── webapp/                 # 🌐 Modern Next.js 16 + Tailwind CSS v4 web platform
│   ├── app/                # App Router pages (/, /dashboard, /company/[slug], /settings, /statistics)
│   ├── components/         # UI components, Navbar, Sidebar, Modals & OnboardingTour
│   ├── prisma/             # Multi-tenant Supabase schema.prisma & migrations
│   ├── scripts/            # Autonomous upstream sync & date matching scripts
│   └── store/              # Zustand global tracker state
├── question-lists/         # 📊 650+ company folders containing CSV interview problem sets
├── scraper/                # 🕷️ Java Selenium scraper to update question datasets
├── .github/workflows/      # ⚙️ GitHub Actions CI pipeline & daily upstream sync cron
├── run-backend.bat         # ⚡ Windows one-click script to start the web application
├── run-webapp.bat          # ⚡ Alias launcher for the web application
├── vercel.json             # 🚀 Vercel production deployment configuration
└── ROADMAP.md              # 🗺️ Complete milestone roadmap and execution specs
```

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- Node.js 20+
- npm 9+
- Supabase PostgreSQL database

### 2. Launching Locally
Double-click `run-backend.bat` (or `run-webapp.bat`), or run in terminal:

```bash
# Install dependencies and start dev server
cd webapp
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌐 Production Deployment (Vercel)

This repository is pre-configured for automated Vercel deployment:

1. Import `01MASTERS/Leetcode-Companion` on [Vercel](https://vercel.com).
2. Set Root Directory to `webapp` (or leave default root `/` as root `vercel.json` will route commands to `webapp`).
3. Add the following **Environment Variables** in Vercel project settings:
   - `DATABASE_URL`: Supabase Transaction Pooler (port 6543)
   - `DIRECT_URL`: Supabase Session Pooler (port 5432)
   - `NEXTAUTH_SECRET`: Random 32+ character string
   - `NEXTAUTH_URL`: Production domain (e.g. `https://your-app.vercel.app`)
   - `GOOGLE_CLIENT_ID`: Google Cloud OAuth Client ID
   - `GOOGLE_CLIENT_SECRET`: Google Cloud OAuth Client Secret
   - `ADMIN_EMAIL`: Admin email for audit history
   - `NEXT_PUBLIC_ADMIN_EMAIL`: Admin email for audit history
4. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), add your production callback:
   - `https://your-app.vercel.app/api/auth/callback/google`
5. In GitHub repository settings under **Secrets and variables > Actions**, add:
   - `DATABASE_URL`: Enables the daily background upstream ingestion workflow.

---

## 🔄 Automated Upstream Ingestion Engine

A scheduled GitHub Action (`.github/workflows/upstream-sync.yml`) runs daily to:
1. Check the upstream source repository for new question commits.
2. Incrementally upsert questions and company mappings into Supabase PostgreSQL.
3. Keep user progress, custom notes, and solved statuses 100% intact.

---

## 💡 Contributing & Scraper

- To scrape new company question sets using LeetCode Premium, open the `scraper/` directory.
- Driver code is located in `scraper/src/main/java/Scraper.java`.
- Once questions are updated, submit a Pull Request.

---

## Happy LeetCoding. May the force be with you!
