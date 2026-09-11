'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import { motion } from 'framer-motion';
import {
  Building2,
  Code2,
  Database,
  Flame,
  Trophy,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  RefreshCw,
  BarChart3,
  Layers,
  Compass,
  Star,
  ChevronRight,
  Zap,
} from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const topCompanies = [
    { name: 'Google', slug: 'google', count: 2325, color: 'from-blue-500/20 to-blue-600/10', border: 'border-blue-500/30', text: 'text-blue-400' },
    { name: 'Amazon', slug: 'amazon', count: 1988, color: 'from-amber-500/20 to-amber-600/10', border: 'border-amber-500/30', text: 'text-amber-400' },
    { name: 'Microsoft', slug: 'microsoft', count: 1386, color: 'from-cyan-500/20 to-cyan-600/10', border: 'border-cyan-500/30', text: 'text-cyan-400' },
    { name: 'Meta', slug: 'meta', count: 1381, color: 'from-indigo-500/20 to-indigo-600/10', border: 'border-indigo-500/30', text: 'text-indigo-400' },
    { name: 'Bloomberg', slug: 'bloomberg', count: 1213, color: 'from-purple-500/20 to-purple-600/10', border: 'border-purple-500/30', text: 'text-purple-400' },
    { name: 'Uber', slug: 'uber', count: 362, color: 'from-emerald-500/20 to-emerald-600/10', border: 'border-emerald-500/30', text: 'text-emerald-400' },
    { name: 'TikTok', slug: 'tiktok', count: 349, color: 'from-pink-500/20 to-pink-600/10', border: 'border-pink-500/30', text: 'text-pink-400' },
    { name: 'Oracle', slug: 'oracle', count: 313, color: 'from-rose-500/20 to-rose-600/10', border: 'border-rose-500/30', text: 'text-rose-400' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20 selection:text-primary relative overflow-x-hidden">
      {/* Background Ambient Lights */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/10 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="fixed top-1/3 -left-40 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="fixed bottom-10 -right-40 w-[600px] h-[600px] bg-amber-500/5 rounded-full blur-[140px] pointer-events-none -z-10" />

      {/* Landing Floating Header */}
      <header className="sticky top-0 z-50 px-4 sm:px-8 py-3.5 border-b border-border/80 glass-blur bg-background/75 backdrop-blur-md transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <img
              src="/logo.png"
              alt="LC Companion Logo"
              className="h-9 w-9 rounded-xl object-contain shadow-md group-hover:scale-105 transition-transform"
            />
            <div className="flex flex-col">
              <span className="font-extrabold text-base tracking-tight text-foreground flex items-center gap-1.5">
                LC Companion
                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-primary/10 border border-primary/25 text-primary rounded-full">
                  2026
                </span>
              </span>
            </div>
          </Link>

          {/* Center Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-muted-foreground">
            <a href="#metrics" className="hover:text-foreground transition-colors">
              Metrics & Figures
            </a>
            <a href="#companies" className="hover:text-foreground transition-colors">
              658+ Companies
            </a>
            <a href="#features" className="hover:text-foreground transition-colors">
              Features
            </a>
            <a
              href="https://github.com/01MASTERS/Leetcode-Companion"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors flex items-center gap-1"
            >
              GitHub <ExternalLink className="h-3 w-3" />
            </a>
          </nav>

          {/* Right Action CTAs */}
          <div className="flex items-center gap-2.5">
            {status === 'authenticated' ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-primary text-black hover:opacity-90 transition-all shadow-md active:scale-95"
              >
                <span>Dashboard</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/dashboard"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border border-border bg-card/60 hover:bg-muted/80 text-foreground transition-all active:scale-95"
                >
                  Explore as Guest
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>

                <button
                  onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
                  className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-border/80 bg-card hover:bg-muted/70 hover:border-border text-foreground text-xs font-semibold transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Sign in with Google</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-16 pb-12 sm:pt-24 sm:pb-20 px-4 sm:px-6 max-w-5xl mx-auto flex flex-col items-center text-center">
        {/* Release / Status Pill */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-primary text-xs font-bold mb-6 shadow-sm"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Verified 2026 Interview Frequency Datasets</span>
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-foreground leading-[1.08] max-w-4xl"
        >
          Master Company-Specific <br className="hidden sm:inline" />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-400 via-primary to-orange-500">
            LeetCode Questions.
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mt-6 text-sm sm:text-lg text-muted-foreground max-w-2xl leading-relaxed"
        >
          Target <strong>3,399 curated interview problems</strong> asked across <strong>658+ top tech companies</strong>.
          Seamlessly sync your accepted LeetCode solves in real time with exact timestamps, notes, and streak tracking.
        </motion.p>

        {/* Dual Primary CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mt-8 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
        >
          {status === 'authenticated' ? (
            <Link
              href="/dashboard"
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-2xl bg-primary text-black font-bold text-sm hover:opacity-90 transition-all shadow-md active:scale-[0.98]"
            >
              <span>Go to Dashboard</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <>
              {/* Sign in with Google Button */}
              <button
                onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
                className="w-full sm:w-auto flex items-center justify-center gap-3 px-6 py-3.5 rounded-2xl border border-border/90 bg-card hover:bg-muted/70 hover:border-border text-foreground font-semibold text-sm transition-all shadow-md active:scale-[0.98] cursor-pointer"
              >
                <svg className="h-4.5 w-4.5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Sign in with Google</span>
              </button>

              {/* Explore as Guest Button */}
              <Link
                href="/dashboard"
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl glass border border-border/90 hover:border-primary/50 text-foreground font-semibold text-sm hover:bg-muted/60 transition-all active:scale-[0.98]"
              >
                <span>Explore as Guest</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </>
          )}
        </motion.div>

        {/* Trust Badges Row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-6 flex items-center gap-5 text-xs text-muted-foreground font-medium flex-wrap justify-center"
        >
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Free Forever & Open Source
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Instant Setup (No CSVs)
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Official LeetCode GraphQL Sync
          </span>
        </motion.div>
      </section>

      {/* KEY FIGURES & METRICS HIGHLIGHT STRIP (Core Focus) */}
      <section id="metrics" className="py-12 px-4 sm:px-6 max-w-7xl mx-auto w-full">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
            Key Figures & Real-Time Metrics
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1.5">
            Precise catalog numbers powered by live Supabase database queries.
          </p>
        </div>

        {/* 4 Core Number Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Stat 1: Companies */}
          <div className="glass border border-border/80 hover:border-blue-500/50 hover:bg-blue-500/[0.03] rounded-2xl p-6 relative overflow-hidden group transition-all duration-300 hover:-translate-y-1">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Companies Tracked</span>
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
                <Building2 className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-4xl font-black text-foreground tracking-tight">658</span>
              <span className="text-xs text-blue-400 font-bold ml-1.5">Active</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              FAANG, Tier-1 giants, high-growth startups, and Wall Street FinTech.
            </p>
          </div>

          {/* Stat 2: Unique Problems */}
          <div className="glass border border-border/80 hover:border-amber-500/50 hover:bg-amber-500/[0.03] rounded-2xl p-6 relative overflow-hidden group transition-all duration-300 hover:-translate-y-1">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Unique Questions</span>
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                <Code2 className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-4xl font-black text-foreground tracking-tight">3,399</span>
              <span className="text-xs text-amber-400 font-bold ml-1.5">Cataloged</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Indexed with difficulty, acceptance rate, and direct LeetCode links.
            </p>
          </div>

          {/* Stat 3: Company-Problem Pairings */}
          <div className="glass border border-border/80 hover:border-emerald-500/50 hover:bg-emerald-500/[0.03] rounded-2xl p-6 relative overflow-hidden group transition-all duration-300 hover:-translate-y-1">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Interview Pairings</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
                <Layers className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-4xl font-black text-foreground tracking-tight">17,819</span>
              <span className="text-xs text-emerald-400 font-bold ml-1.5">Frequency Tags</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Frequency weightings identifying which questions get asked most often.
            </p>
          </div>

          {/* Stat 4: Sync Speed & Accuracy */}
          <div className="glass border border-border/80 hover:border-purple-500/50 hover:bg-purple-500/[0.03] rounded-2xl p-6 relative overflow-hidden group transition-all duration-300 hover:-translate-y-1">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Sync Performance</span>
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
                <Zap className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-4xl font-black text-foreground tracking-tight">&lt; 1.5s</span>
              <span className="text-xs text-purple-400 font-bold ml-1.5">Batch Upsert</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Optimized PostgreSQL chunked engine with exact solve timestamps.
            </p>
          </div>
        </div>

        {/* Difficulty Breakdown Multi-Segment Metrics Bar */}
        <div className="glass border border-border/80 rounded-2xl p-6 mt-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
            <div>
              <h3 className="font-extrabold text-sm text-foreground">Catalog Difficulty Distribution</h3>
              <p className="text-xs text-muted-foreground">Comprehensive coverage across foundational to advanced algorithms.</p>
            </div>
            <span className="text-xs font-mono font-bold text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-lg border border-border">
              Total: 3,399 Problems
            </span>
          </div>

          {/* Visual Progress Stack */}
          <div className="w-full h-3.5 bg-muted rounded-full overflow-hidden flex gap-0.5 p-0.5 border border-border">
            <div
              style={{ width: '24.1%' }}
              className="h-full bg-emerald-500 rounded-l-full"
              title="Easy: 819 problems (24.1%)"
            />
            <div
              style={{ width: '53.1%' }}
              className="h-full bg-amber-500"
              title="Medium: 1,805 problems (53.1%)"
            />
            <div
              style={{ width: '22.8%' }}
              className="h-full bg-rose-500 rounded-r-full"
              title="Hard: 775 problems (22.8%)"
            />
          </div>

          {/* Legend with exact figures */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-3 border-t border-border/60">
            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
              <div>
                <p className="text-xs font-bold text-foreground">819 Easy Questions</p>
                <p className="text-[11px] text-muted-foreground">24.1% • Arrays, strings, two-pointers</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
              <div>
                <p className="text-xs font-bold text-foreground">1,805 Medium Questions</p>
                <p className="text-[11px] text-muted-foreground">53.1% • Trees, graphs, dynamic programming</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0" />
              <div>
                <p className="text-xs font-bold text-foreground">775 Hard Questions</p>
                <p className="text-[11px] text-muted-foreground">22.8% • Advanced graphs, segment trees, game theory</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TOP TECH GIANTS FREQUENCY GRID (`#companies`) */}
      <section id="companies" className="py-12 px-4 sm:px-6 max-w-7xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary mb-1">
              <Building2 className="h-4 w-4" />
              Company Intelligence
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
              Top Interview Question Banks
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Real problem counts curated from interview rounds at Tier-1 companies.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
          >
            Browse all 658 companies <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Company Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {topCompanies.map((c) => (
            <Link
              key={c.slug}
              href={`/company/${c.slug}`}
              className={`glass border ${c.border} rounded-2xl p-5 flex flex-col justify-between h-36 relative group hover:-translate-y-1 hover:shadow-xl transition-all duration-300 overflow-hidden bg-gradient-to-br ${c.color}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-extrabold text-base text-foreground group-hover:text-primary transition-colors">
                    {c.name}
                  </h3>
                  <span className="text-[11px] text-muted-foreground font-semibold block mt-0.5">
                    Interview Track
                  </span>
                </div>
                <div className="p-1.5 rounded-lg bg-card/60 text-muted-foreground group-hover:text-foreground transition-colors">
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-2xl font-black ${c.text}`}>{c.count.toLocaleString()}</span>
                  <span className="text-[11px] text-muted-foreground font-semibold">Questions</span>
                </div>
                <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-foreground/40 rounded-full w-full" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS / FEATURE PILLARS (`#features`) */}
      <section id="features" className="py-12 px-4 sm:px-6 max-w-7xl mx-auto w-full">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
            Engineered for High-Yield Interview Prep
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 max-w-xl mx-auto">
            Everything you need to focus on what matters most and eliminate preparation fatigue.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <div className="glass border border-border/80 rounded-2xl p-6 flex flex-col justify-between hover:border-primary/50 transition-all group">
            <div>
              <div className="p-3 rounded-2xl bg-primary/10 text-primary w-fit mb-4">
                <RefreshCw className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-foreground mb-2">
                Automated LeetCode Sync
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Connect via public username or optional session cookie. Accepted solves are pulled with exact timestamps and mapped to our 3,399 dataset without manual tracking.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-border/60 flex items-center gap-2 text-xs font-semibold text-primary">
              <span>Zero-friction polling</span>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="glass border border-border/80 rounded-2xl p-6 flex flex-col justify-between hover:border-primary/50 transition-all group">
            <div>
              <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500 w-fit mb-4">
                <BarChart3 className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-foreground mb-2">
                Company Progress Analytics
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                See your completion percentage per company. Filter by completed, in-progress, or not started, and sort by most-asked or least-complete to prioritize efficiently.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-border/60 flex items-center gap-2 text-xs font-semibold text-amber-500">
              <span>Dynamic KPI dashboard</span>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="glass border border-border/80 rounded-2xl p-6 flex flex-col justify-between hover:border-primary/50 transition-all group">
            <div>
              <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500 w-fit mb-4">
                <Star className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-foreground mb-2">
                Interview Notes & Starred Bank
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Bookmark tricky questions and write Markdown takeaways for quick revision before your technical phone screens and onsite interview loops.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-border/60 flex items-center gap-2 text-xs font-semibold text-emerald-500">
              <span>Cloud persistent notes</span>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL BOTTOM CONVERSION CTA BANNER */}
      <section className="py-16 px-4 sm:px-6 max-w-5xl mx-auto w-full">
        <div className="glass border border-primary/30 rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden bg-gradient-to-b from-primary/10 via-background to-background">
          <div className="absolute -top-24 -right-24 w-60 h-60 bg-primary/20 rounded-full blur-3xl pointer-events-none" />

          <h2 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
            Start Prepping Smarter Today.
          </h2>
          <p className="mt-3 text-sm text-muted-foreground max-w-md mx-auto">
            Choose your target company, view real question frequencies, and track every single solve automatically.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            {status === 'authenticated' ? (
              <Link
                href="/dashboard"
                className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-2xl bg-primary text-black font-bold text-sm hover:opacity-90 transition-all shadow-md active:scale-95"
              >
                <span>Open Your Dashboard</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <button
                onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
                className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl border border-border/90 bg-card hover:bg-muted/70 hover:border-border text-foreground font-semibold text-sm transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Sign in with Google</span>
              </button>
            )}
            {status !== 'authenticated' && (
              <Link
                href="/dashboard"
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl glass border border-border hover:border-primary/50 text-foreground font-semibold text-sm hover:bg-muted/60 transition-all active:scale-95 text-center"
              >
                Explore as Guest
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="mt-auto border-t border-border/80 py-8 px-4 sm:px-6 text-xs text-muted-foreground">
        <div className="max-w-7xl mx-auto flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Logo" className="h-5 w-5 rounded-md object-contain" />
              <span className="font-bold text-foreground">LC Companion</span>
              <span>&bull;</span>
              <span>Open Source Community Project</span>
            </div>

            <div className="flex items-center gap-4 flex-wrap justify-center">
              <Link href="/dashboard" className="hover:text-foreground transition-colors">
                Companies (658)
              </Link>
              <Link href="/statistics" className="hover:text-foreground transition-colors">
                Statistics
              </Link>
              <Link href="/settings" className="hover:text-foreground transition-colors">
                Sync Settings
              </Link>
              <a
                href="https://github.com/01MASTERS/Leetcode-Companion"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors flex items-center gap-1 font-semibold"
              >
                GitHub <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          {/* Upstream Attribution & Credits (Subtle & respectful) */}
          <div className="pt-4 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground/75 text-center sm:text-left">
            <p>
              Special credits to{' '}
              <a
                href="https://github.com/snehasishroy/leetcode-companywise-interview-questions"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors underline decoration-border/60 hover:decoration-primary underline-offset-4"
              >
                Snehasish Roy (snehasishroy/leetcode-companywise-interview-questions)
              </a>{' '}
              for the original curated company-wise interview frequency datasets.
            </p>
            <p>© {new Date().getFullYear()} LC Companion.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
