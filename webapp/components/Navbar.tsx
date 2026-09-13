'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTrackerStore } from '@/store/useTrackerStore';
import { Search, Flame, ArrowUpRight, LogOut, Settings as SettingsIcon, ChevronDown, HelpCircle, Menu } from 'lucide-react';
import { Stats } from '@/types';
import FreshnessBadge from '@/components/FreshnessBadge';

export default function Navbar() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { data: session, status } = useSession();
  const { globalSearch, setGlobalSearch, addToast, openGuestGate, startTour, toggleMobileSidebar } = useTrackerStore();
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

  // Automatically clear search query when navigating between pages or companies
  React.useEffect(() => {
    setSearchInput('');
    setGlobalSearch('');
  }, [pathname, setGlobalSearch]);

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

  const isGuest = status === 'unauthenticated';

  // Fetch stats for the Navbar indicator
  const { data: stats } = useQuery<Stats>({
    queryKey: ['stats', { isGuest }],
    queryFn: async () => {
      const res = await fetch(`/api/stats${isGuest ? '?guest=1' : ''}`);
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
    enabled: status !== 'loading',
    refetchInterval: 1000 * 60 * 10, // 10 minutes
  });

  const leetcodeUser = stats?.syncConfig?.leetcodeUser;

  // Track in-flight state and timestamp to prevent request storms and redundant calls
  const isSyncingRef = React.useRef(false);
  const lastSyncTimeRef = React.useRef(0);

  // Background incremental sync: Visibility-aware and Focus-triggered
  React.useEffect(() => {
    if (!leetcodeUser || status !== 'authenticated') return;

    let isMounted = true;

    const performSync = async (reason = 'timer') => {
      // 1. Page Visibility Check: Never poll when browser tab is minimized or hidden
      if (typeof document !== 'undefined' && document.hidden) return;

      // 2. Prevent overlapping concurrent sync calls
      if (isSyncingRef.current) return;

      // 3. Cooldown: For window focus / visibility triggers, throttle to at least 30 seconds
      const now = Date.now();
      if ((reason === 'focus' || reason === 'visibility') && now - lastSyncTimeRef.current < 30000) {
        return;
      }

      try {
        isSyncingRef.current = true;
        setIsSyncing(true);
        lastSyncTimeRef.current = now;

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
          isSyncingRef.current = false;
          setIsSyncing(false);
        }
      }
    };

    // Initial sync on mount
    performSync('mount');

    // Regular active-interval poll (only runs when tab is actively visible, spaced to 10 mins when idle)
    const intervalId = setInterval(() => performSync('timer'), 1000 * 60 * 10);

    // Event 1: Window Focus (triggers immediately when user returns from solving on LeetCode)
    const handleFocus = () => performSync('focus');
    window.addEventListener('focus', handleFocus);

    // Event 2: Page Visibility change (triggers when tab is un-minimized / brought to foreground)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        performSync('visibility');
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [leetcodeUser, status, addToast, queryClient]);

  const getPlaceholderText = () => {
    if (pathname.startsWith('/company/')) {
      return 'Search questions inside this company...';
    }
    return 'Search 650+ companies...';
  };

  // Hide dashboard navbar on public landing page
  if (pathname === '/') return null;

  return (
    <header className="glass-blur h-16 border-b border-border flex items-center justify-between px-3 sm:px-6 sticky top-0 z-20 w-full text-foreground select-none">
      {/* Left: Mobile hamburger menu & Search Input */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0 max-w-xs sm:max-w-md mr-2">
        <button
          onClick={toggleMobileSidebar}
          className="md:hidden p-2 -ml-1 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer shrink-0"
          title="Open Menu"
          aria-label="Open Navigation Menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Search Input */}
        <div id="tour-search" className="flex-1 min-w-0 relative">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-muted-foreground">
            <Search className="h-4 w-4 shrink-0" />
          </div>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={getPlaceholderText()}
            className="w-full bg-input-bg border border-border text-xs sm:text-sm text-foreground rounded-xl py-2 pl-9 pr-4 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-zinc-500 truncate"
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
      </div>

      {/* Right Stats & Profile items */}
      <div className="flex items-center gap-1.5 sm:gap-3 md:gap-4 shrink-0">
        {/* Catalog Freshness Badge */}
        <FreshnessBadge />

        {/* Streak counter */}
        {stats && stats.streak > 0 && status === 'authenticated' && (
          <div
            className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400 rounded-xl text-xs font-semibold select-none"
            title={`${stats.streak} Day Streak`}
          >
            <Flame className="h-3.5 w-3.5 fill-amber-600 text-amber-600 dark:fill-amber-400 dark:text-amber-400" />
            <span>{stats.streak}</span>
          </div>
        )}

        {/* Help & Tour Trigger */}
        <button
          onClick={() => startTour()}
          className="p-1.5 rounded-xl hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          title="Take Guided Tour"
          aria-label="Take Guided Tour"
        >
          <HelpCircle className="h-4 w-4" />
        </button>

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

        {/* Divider */}
        <div className="h-4 w-[1px] bg-border" />

        {/* Auth / Profile Area */}
        {status === 'loading' ? (
          <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
        ) : session?.user ? (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-1.5 p-1 rounded-xl hover:bg-muted/80 transition-colors border border-transparent hover:border-border"
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
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>

            {/* Dropdown Menu */}
            {userDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 glass bg-card border border-border/80 rounded-2xl shadow-xl py-2 z-50 text-foreground animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-4 py-2.5 border-b border-border/60 space-y-1">
                  <p className="text-xs font-semibold text-foreground truncate">{session.user.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{session.user.email}</p>
                  {leetcodeUser && (
                    <div className="flex items-center gap-1.5 pt-1 text-[11px] text-emerald-400 font-medium">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span>LC: <span className="font-mono text-foreground font-semibold">{leetcodeUser}</span></span>
                    </div>
                  )}
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

                  <a
                    href="https://leetcode.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center justify-between px-4 py-2 text-xs text-foreground hover:bg-muted transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>LeetCode Profile</span>
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">↗</span>
                  </a>

                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      startTour();
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-xs text-foreground hover:bg-muted transition-colors text-left cursor-pointer"
                  >
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Take Guided Tour</span>
                  </button>
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
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-full text-[11px] font-medium text-amber-800 hover:bg-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400 dark:hover:bg-amber-500/20 transition-colors"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-600 dark:bg-amber-500 animate-pulse" />
              Guest Mode
            </button>

            {/* Sign in with Google Button */}
            <button
              onClick={() => signIn('google')}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-xl border border-border/80 bg-card hover:bg-muted/70 hover:border-border text-foreground text-xs font-semibold transition-all shadow-sm active:scale-95 cursor-pointer shrink-0"
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
              <span className="hidden sm:inline">Sign in with Google</span>
              <span className="sm:hidden">Sign In</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
