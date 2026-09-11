'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTrackerStore } from '@/store/useTrackerStore';
import { Search, Flame, Trophy, ArrowUpRight, RefreshCw, User, LogOut, Settings as SettingsIcon, ChevronDown, Sparkles } from 'lucide-react';
import { Stats } from '@/types';

export default function Navbar() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { data: session, status } = useSession();
  const { globalSearch, setGlobalSearch, addToast, openGuestGate } = useTrackerStore();
  const [searchInput, setSearchInput] = React.useState(globalSearch);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [theme, setTheme] = React.useState<'dark' | 'light'>('dark');
  const [userDropdownOpen, setUserDropdownOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close user dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keep local search input in sync if global search is cleared
  React.useEffect(() => {
    setSearchInput(globalSearch);
  }, [globalSearch]);

  // Debounce updating global search in Zustand store by 250ms
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setGlobalSearch(searchInput);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput, setGlobalSearch]);

  // Load and apply theme on start
  React.useEffect(() => {
    const savedTheme = (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
    setTheme(savedTheme);
    document.documentElement.classList.toggle('light', savedTheme === 'light');
  }, []);

  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.documentElement.classList.toggle('light', nextTheme === 'light');
  };

  // Fetch stats for the Navbar indicator
  const { data: stats } = useQuery<Stats>({
    queryKey: ['stats'],
    queryFn: async () => {
      const res = await fetch('/api/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
    refetchInterval: 60000,
  });

  const leetcodeUser = stats?.syncConfig?.leetcodeUser;
  const isDemoMode = stats?.syncConfig?.isDemoMode;

  // Background incremental sync on mount and every 60 seconds (only if user is authenticated)
  React.useEffect(() => {
    if (!leetcodeUser || isDemoMode || status !== 'authenticated') return;

    let isMounted = true;

    const performSync = async () => {
      try {
        setIsSyncing(true);
        const res = await fetch('/api/leetcode-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: leetcodeUser,
            action: 'incremental',
          }),
        });

        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.success && data.syncedCount > 0) {
            addToast(`Auto-Sync: Found and marked ${data.syncedCount} new question(s) solved!`, 'success');
            queryClient.invalidateQueries({ queryKey: ['stats'] });
            queryClient.invalidateQueries({ queryKey: ['companies'] });
            queryClient.invalidateQueries({ queryKey: ['company'] });
          }
        }
      } catch (err) {
        console.error('Background incremental sync error:', err);
      } finally {
        if (isMounted) {
          setIsSyncing(false);
        }
      }
    };

    performSync();
    const intervalId = setInterval(performSync, 60000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [leetcodeUser, isDemoMode, status, addToast, queryClient]);

  const getPlaceholderText = () => {
    if (pathname.startsWith('/company/')) {
      return 'Search questions inside this company...';
    }
    return 'Search 650+ companies...';
  };

  return (
    <header className="glass-blur h-16 border-b border-border flex items-center justify-between px-6 sticky top-0 z-20 w-full text-foreground select-none">
      {/* Search Input */}
      <div className="flex-1 max-w-md relative">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-muted-foreground">
          <Search className="h-4 w-4" />
        </div>
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={getPlaceholderText()}
          className="w-full bg-input-bg border border-border text-sm text-foreground rounded-xl py-2 pl-9 pr-4 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-zinc-500"
        />
        {searchInput && (
          <button
            onClick={() => {
              setSearchInput('');
              setGlobalSearch('');
            }}
            className="absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Right Stats & Profile items */}
      <div className="flex items-center gap-4">
        {/* Sync Status Badge */}
        {leetcodeUser && status === 'authenticated' && (
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 bg-muted/80 border border-border rounded-xl text-xs select-none">
            {isSyncing ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 text-primary animate-spin" />
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Syncing...</span>
              </>
            ) : (
              <>
                <div className={`h-1.5 w-1.5 rounded-full ${isDemoMode ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider truncate max-w-[120px]">
                  {isDemoMode ? 'Demo Mode' : `Synced: ${leetcodeUser}`}
                </span>
              </>
            )}
          </div>
        )}

        {/* Streak counter */}
        {stats && stats.streak > 0 && status === 'authenticated' && (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-lg text-xs font-semibold select-none animate-pulse">
            <Flame className="h-4 w-4 fill-amber-500" />
            <span>{stats.streak} Day Streak</span>
          </div>
        )}

        {/* Global Progress mini-indicator */}
        {stats && status === 'authenticated' && (
          <div className="hidden xl:flex items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Solved</div>
              <div className="text-sm font-bold text-foreground">
                {stats.overall.solvedProblems} <span className="text-muted-foreground">/ {stats.overall.totalProblems}</span>
              </div>
            </div>
            <div className="w-16 bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-primary h-full rounded-full transition-all duration-500"
                style={{ width: `${stats.overall.completionPercentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Theme Switch */}
        <label className="ui-switch flex-shrink-0" title={theme === 'light' ? "Switch to Dark Mode" : "Switch to Light Mode"}>
          <input
            type="checkbox"
            checked={theme === 'dark'}
            onChange={handleToggleTheme}
          />
          <div className="slider">
            <div className="circle"></div>
          </div>
        </label>

        {/* LeetCode Direct Link */}
        <a
          href="https://leetcode.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden md:flex text-muted-foreground hover:text-primary p-2 rounded-lg hover:bg-muted transition-colors items-center gap-1 text-xs font-semibold"
        >
          LeetCode
          <ArrowUpRight className="h-3 w-3" />
        </a>

        {/* Divider */}
        <div className="h-4 w-[1px] bg-border" />

        {/* Auth / Profile Area */}
        {status === 'loading' ? (
          <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
        ) : session?.user ? (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-muted/80 transition-colors border border-transparent hover:border-border"
              aria-label="User profile menu"
            >
              {session.user.image ? (
                <img
                  src={session.user.image}
                  alt={session.user.name || 'User'}
                  className="w-7 h-7 rounded-full border border-border/60 object-cover"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs">
                  {session.user.name?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
              <span className="hidden md:block text-xs font-medium max-w-[100px] truncate text-foreground">
                {session.user.name || 'User'}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>

            {/* Dropdown Menu */}
            {userDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 glass bg-card border border-border/80 rounded-2xl shadow-xl py-2 z-50 text-foreground animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-4 py-2.5 border-b border-border/60">
                  <p className="text-xs font-semibold text-foreground truncate">{session.user.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{session.user.email}</p>
                </div>

                <div className="py-1">
                  <Link
                    href="/settings"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-xs text-foreground hover:bg-muted transition-colors"
                  >
                    <SettingsIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Settings & Sync</span>
                  </Link>
                </div>

                <div className="border-t border-border/60 pt-1">
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      signOut({ callbackUrl: '/' });
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-xs text-destructive hover:bg-destructive/10 transition-colors text-left"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {/* Guest pill */}
            <button
              onClick={() => openGuestGate()}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-[11px] font-medium text-amber-500 hover:bg-amber-500/20 transition-colors"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              Guest Mode
            </button>

            {/* Sign In Button */}
            <button
              onClick={() => signIn('google')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-foreground text-background text-xs font-semibold hover:opacity-90 transition-all shadow-sm active:scale-95"
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
              <span>Sign In</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
