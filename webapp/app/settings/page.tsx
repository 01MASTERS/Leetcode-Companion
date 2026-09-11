'use client';

import React, { useState, useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTrackerStore } from '@/store/useTrackerStore';
import { RefreshCw, Info, AlertTriangle } from 'lucide-react';
import { formatDate } from '@/utils/helpers';
import { Stats } from '@/types';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: session, status } = useSession();
  const { addToast, openGuestGate } = useTrackerStore();
  const [username, setUsername] = useState('');
  const [leetcodeSession, setLeetcodeSession] = useState('');
  const [isSimulation, setIsSimulation] = useState(true);

  // Fetch current statistics (which contains sync configurations)
  const { data: stats } = useQuery<Stats>({
    queryKey: ['stats'],
    queryFn: async () => {
      const res = await fetch('/api/stats');
      if (!res.ok) throw new Error('Failed to load stats');
      return res.json();
    },
  });

  const syncConfig = stats?.syncConfig;

  const [isDetecting, setIsDetecting] = useState(false);

  // Auto-detect username from cookie
  const handleDetectUsername = async (cookieValue?: string) => {
    const rawVal = cookieValue !== undefined ? cookieValue : leetcodeSession;
    if (!rawVal || rawVal === '••••••••••••••••') {
      addToast('Please enter or paste a LEETCODE_SESSION cookie first.', 'info');
      return;
    }
    try {
      setIsDetecting(true);
      const res = await fetch('/api/leetcode-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'detect-cookie',
          leetcodeSession: rawVal,
        }),
      });
      const data = await res.json();
      if (res.ok && data.username) {
        setUsername(data.username);
        addToast(`Successfully detected LeetCode username: @${data.username}`, 'success');
      } else {
        addToast(data.error || 'Could not detect username from cookie.', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Error checking session cookie.', 'error');
    } finally {
      setIsDetecting(false);
    }
  };

  // Prefill the form inputs once the settings configurations load from the DB
  useEffect(() => {
    if (syncConfig?.leetcodeUser) {
      setUsername(syncConfig.leetcodeUser);
      setIsSimulation(syncConfig.isDemoMode);
      if (syncConfig.hasSessionCookie) {
        setLeetcodeSession('••••••••••••••••');
      }
    }
  }, [syncConfig]);

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      // If session field is the dots placeholder, don't overwrite the stored cookie
      const sessionToSend = leetcodeSession === '••••••••••••••••' ? undefined : leetcodeSession;

      const res = await fetch('/api/leetcode-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          action: 'full',
          isSimulation,
          leetcodeSession: sessionToSend,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const err: any = new Error(data.details || data.error || 'Sync failed');
        err.isGuest = data.isGuest || res.status === 401;
        throw err;
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['company'] });
      
      if (data.success) {
        addToast(
          `Sync successful! Marked ${data.syncedCount} questions as solved (${data.isDemoMode ? 'Demo' : 'Real'} mode).`,
          'success'
        );
        if (data.cookieWarning) {
          addToast(`Cookie note: ${data.cookieWarning} (Synced via public profile instead)`, 'info');
        }
      } else {
        addToast(data.message || 'Sync completed with no changes.', 'info');
      }
    },
    onError: (err: any) => {
      if (err.isGuest || err.message?.includes('Sign in with Google')) {
        openGuestGate('Sign in with Google to enable automated LeetCode progress synchronization.');
      } else {
        addToast(err.message || 'LeetCode Sync failed. Check username, cookie validity, or network.', 'error');
      }
    },
  });

  const handleSyncSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() && !leetcodeSession.trim()) {
      addToast('Please enter a valid LeetCode username or paste a session cookie.', 'error');
      return;
    }
    syncMutation.mutate();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto flex flex-col gap-6 select-text text-foreground animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-black text-foreground tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure and manage your LC tracker account settings.</p>
      </div>

      {/* Guest Mode Notice */}
      {status === 'unauthenticated' && (
        <div className="glass border border-amber-500/25 bg-amber-500/5 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              You are browsing in Guest Mode
            </h4>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Sign in with Google to link your LeetCode profile, sync solves across devices, and save personal notes.
            </p>
          </div>
          <button
            onClick={() => signIn('google')}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-border/80 bg-card hover:bg-muted/80 hover:border-border text-foreground font-medium text-xs transition-all shrink-0 active:scale-95 shadow-sm cursor-pointer"
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
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {/* LeetCode Sync Panel */}
        <div className="glass border border-border rounded-2xl p-6 flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 border border-primary/20 p-2.5 rounded-xl text-primary animate-pulse">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">LeetCode Auto-Sync</h2>
              <p className="text-xs text-muted-foreground">Automatically sync your solved problems list with your LeetCode profile.</p>
            </div>
          </div>

          {/* Sync warning/helper */}
          <div className="p-4 bg-muted/60 border border-border rounded-xl text-xs text-muted-foreground leading-relaxed flex items-start gap-3">
            <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-foreground">How Sync works:</p>
              <p>
                We query the LeetCode GraphQL endpoint to retrieve your solved questions and overall solved counts.
                You can also secure <strong>100% exact question sync</strong> by providing your LeetCode Session Cookie.
                Without a cookie, older questions will be populated using representative popular questions of matching difficulties.
              </p>
            </div>
          </div>

          {/* Warning banner if demo mode solved states exist and switching to real sync */}
          {syncConfig && syncConfig.isDemoMode && !isSimulation && (
            <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl text-xs text-orange-400 leading-relaxed flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5 animate-bounce" />
              <div className="space-y-1">
                <p className="font-semibold text-orange-650 dark:text-orange-350">Warning: Switching to Real Sync</p>
                <p>
                  You are switching from Demo Mode to a Real Sync. Starting a real sync will
                  automatically clear all 120 Demo Mode solved questions and start fresh with
                  your real profile's solved questions!
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSyncSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-baseline">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  LeetCode Username
                </label>
                {username && (
                  <span className="text-[11px] font-semibold text-primary">
                    @{username}
                  </span>
                )}
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. neetcode, lc_master"
                className="bg-input-bg border border-border text-sm text-foreground rounded-xl p-3 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-muted-foreground"
              />
            </div>

            {/* Authenticated Cookie Input */}
            {!isSimulation && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  LeetCode Session Cookie (Optional)
                </label>
                <input
                  type="password"
                  value={leetcodeSession}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLeetcodeSession(val);
                    if (val && val.length > 50 && val !== '••••••••••••••••') {
                      handleDetectUsername(val);
                    }
                  }}
                  placeholder={syncConfig?.hasSessionCookie ? "Session cookie saved (securely stored locally)" : "Enter LEETCODE_SESSION cookie value"}
                  className="bg-input-bg border border-border text-sm text-foreground rounded-xl p-3 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-muted-foreground"
                />
                <p className="text-[10px] text-muted-foreground leading-relaxed leading-normal">
                  How to get it: Log in to LeetCode &rarr; Open DevTools (F12) &rarr; Application/Storage &rarr; Cookies &rarr; Copy the value of <strong>LEETCODE_SESSION</strong>.
                </p>
              </div>
            )}

            {/* Simulation mode switch */}
            <div className="flex items-center justify-between p-3.5 bg-muted/40 border border-border rounded-xl">
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-foreground">Simulation / Demonstration Mode</span>
                <span className="text-xs text-muted-foreground">Run a simulated solve import to populate the dashboard</span>
              </div>
              <button
                type="button"
                onClick={() => setIsSimulation(!isSimulation)}
                className={`w-12 h-6.5 rounded-full p-1 transition-colors outline-none cursor-pointer ${
                  isSimulation ? 'bg-primary' : 'bg-muted border border-border'
                }`}
              >
                <div
                  className={`w-4.5 h-4.5 rounded-full bg-black transition-transform ${
                    isSimulation ? 'translate-x-5.5' : 'translate-x-0 bg-muted-foreground'
                  }`}
                />
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={syncMutation.isPending}
              className="mt-2 flex items-center justify-center gap-2 py-3 px-4 bg-primary text-black font-bold text-sm rounded-xl hover:bg-primary/95 transition-all cursor-pointer shadow-lg shadow-primary/5"
            >
              {syncMutation.isPending ? (
                <>
                  <RefreshCw className="h-4.5 w-4.5 animate-spin" />
                  <span>Syncing Solved Questions...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="h-4.5 w-4.5" />
                  <span>Sync Now</span>
                </>
              )}
            </button>
          </form>

          {/* Sync Stats footer */}
          {syncConfig && (
            <div className="border-t border-border pt-4 flex justify-between text-xs text-muted-foreground">
              <span>Last Synced Username: <strong className="text-foreground">{syncConfig.leetcodeUser || 'Never'}</strong></span>
              <span>Last Sync: <strong className="text-foreground">{syncConfig.lastSyncedAt ? formatDate(syncConfig.lastSyncedAt) : 'Never'}</strong></span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
