'use client';

import React, { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { driver, Driver } from 'driver.js';
import { useTrackerStore } from '@/store/useTrackerStore';

export default function OnboardingTour() {
  const router = useRouter();
  const pathname = usePathname();
  const { tourRunning, startTour, stopTour } = useTrackerStore();
  const driverRef = useRef<Driver | null>(null);
  const pendingStartRef = useRef<boolean>(false);

  // Initialize or re-create driver instance
  const getDriverInstance = () => {
    return driver({
      animate: true,
      showProgress: true,
      progressText: 'Step {{current}} of {{total}}',
      nextBtnText: 'Next →',
      prevBtnText: '← Back',
      doneBtnText: 'Got It! 🚀',
      overlayOpacity: 0.75,
      stagePadding: 8,
      stageRadius: 14,
      allowClose: true,
      steps: [
        {
          element: '#tour-search',
          popover: {
            title: '🔍 Instant Search & Quick Lookup',
            description:
              'Quickly search across 650+ tech companies, or find specific LeetCode questions by title, number, or concept.',
            side: 'bottom',
            align: 'start',
          },
        },
        {
          element: '#tour-stats',
          popover: {
            title: '📊 Real-Time Metrics & Streaks',
            description:
              'Track your overall solved count, track completion percentages, active companies in progress, and daily coding streaks.',
            side: 'bottom',
            align: 'center',
          },
        },
        {
          element: '#tour-filters',
          popover: {
            title: '⚡ Smart Status Filters',
            description:
              'Filter company interview tracks by Completed, In Progress, or Not Started, and sort by most complete, least complete, or alphabetical order.',
            side: 'bottom',
            align: 'start',
          },
        },
        {
          element: '#tour-company-grid',
          popover: {
            title: '🏢 650+ Company Interview Tracks',
            description:
              'Click any company card (e.g. Google, Meta, Microsoft) to open its curated interview questions prioritized by interview frequency % and recency windows.',
            side: 'top',
            align: 'center',
          },
        },
        {
          element: '#tour-nav-settings',
          popover: {
            title: '⚙️ LeetCode Session Setup (Spotlight)',
            description: `
              <div class="space-y-2 mt-1">
                <p class="text-xs text-zinc-300 leading-relaxed">
                  Sync your solved LeetCode questions automatically! You can track progress via your public username, or configure your optional <code class="px-1.5 py-0.5 rounded bg-zinc-800 text-amber-400 font-mono text-[11px]">LEETCODE_SESSION</code> cookie for 100% exact private sync.
                </p>
                <div class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-300/90 leading-relaxed">
                  🔒 <strong>Completely Optional & Safe:</strong> Stored securely in Supabase and only used to fetch your solved problem history.
                </div>
                <div class="pt-1">
                  <a href="/settings" class="tour-settings-link inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors">
                    Configure Session Cookie in Settings &rarr;
                  </a>
                </div>
              </div>
            `,
            side: 'right',
            align: 'start',
            onPopoverRender: (popover) => {
              const link = popover.wrapper.querySelector('.tour-settings-link');
              if (link) {
                link.addEventListener('click', (e) => {
                  e.preventDefault();
                  if (driverRef.current) {
                    driverRef.current.destroy();
                  }
                  router.push('/settings');
                });
              }
            },
          },
        },
        {
          element: '#tour-nav-statistics',
          popover: {
            title: '📈 Comprehensive Analytics',
            description:
              'Visualize your problem-solving distribution across Easy, Medium, and Hard, acceptance breakdown, and streak metrics.',
            side: 'right',
            align: 'start',
          },
        },
      ],
      onDestroyStarted: () => {
        stopTour();
        try {
          localStorage.setItem('lc_onboarding_completed', 'true');
        } catch {
          // Ignore localStorage errors
        }
        if (driverRef.current) {
          driverRef.current.destroy();
          driverRef.current = null;
        }
      },
    });
  };

  // Run tour helper
  const runTour = () => {
    // Wait a brief tick for DOM stability
    setTimeout(() => {
      // If we are not on /dashboard, redirect first
      if (window.location.pathname !== '/dashboard') {
        pendingStartRef.current = true;
        router.push('/dashboard');
        return;
      }

      // Check if target element exists
      const hasFirstElement = document.querySelector('#tour-search') || document.querySelector('#tour-stats');
      if (!hasFirstElement) {
        // Retry shortly if dashboard is still rendering
        setTimeout(runTour, 300);
        return;
      }

      if (driverRef.current) {
        driverRef.current.destroy();
      }

      const instance = getDriverInstance();
      driverRef.current = instance;
      instance.drive();
    }, 150);
  };

  // Listen to tourRunning from store
  useEffect(() => {
    if (tourRunning) {
      runTour();
    } else if (driverRef.current && driverRef.current.isActive()) {
      driverRef.current.destroy();
      driverRef.current = null;
    }
  }, [tourRunning]);

  // Handle route change when pending start
  useEffect(() => {
    if (pendingStartRef.current && pathname === '/dashboard') {
      pendingStartRef.current = false;
      setTimeout(() => {
        runTour();
      }, 300);
    }
  }, [pathname]);

  // Auto-launch for first-time visitors on dashboard
  useEffect(() => {
    if (pathname !== '/dashboard') return;

    try {
      const completed = localStorage.getItem('lc_onboarding_completed');
      if (!completed) {
        const timer = setTimeout(() => {
          startTour();
        }, 800);
        return () => clearTimeout(timer);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [pathname, startTour]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (driverRef.current) {
        driverRef.current.destroy();
      }
    };
  }, []);

  return null;
}
