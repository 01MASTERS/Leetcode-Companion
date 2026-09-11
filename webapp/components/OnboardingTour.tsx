'use client';

import React, { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { driver, Driver, DriveStep } from 'driver.js';
import { useTrackerStore } from '@/store/useTrackerStore';

interface TourConfig {
  storageKey: string;
  steps: DriveStep[];
}

export default function OnboardingTour() {
  const router = useRouter();
  const pathname = usePathname();
  const { tourRunning, startTour, stopTour } = useTrackerStore();
  const driverRef = useRef<Driver | null>(null);
  const activeStorageKeyRef = useRef<string>('');

  // Define steps for each section/page
  const getTourConfig = (path: string): TourConfig | null => {
    // 1. Dashboard / Companies Tab (Max 3 sections)
    if (path === '/dashboard') {
      return {
        storageKey: 'lc_tour_dashboard_completed',
        steps: [
          {
            element: '#tour-search',
            popover: {
              title: '🔍 Instant Search & Quick Lookup',
              description:
                'Quickly search across 650+ tech companies or find specific LeetCode questions by title, number, or concept.',
              side: 'bottom',
              align: 'start',
            },
          },
          {
            element: '#tour-stats',
            popover: {
              title: '📊 Overall Metrics & Streaks',
              description:
                'Track your total solved count, company completion percentages, active companies in progress, and your daily coding streak.',
              side: 'bottom',
              align: 'center',
            },
          },
          {
            element: '#tour-company-grid',
            popover: {
              title: '🏢 650+ Company Interview Tracks',
              description:
                'Click any company card (e.g. Google, Meta, Microsoft, Amazon) to open its curated interview question track prioritized by hiring frequency.',
              side: 'top',
              align: 'center',
            },
          },
        ],
      };
    }

    // 2. Specific Company Page (Important sections)
    if (path.startsWith('/company/')) {
      return {
        storageKey: 'lc_tour_company_completed',
        steps: [
          {
            element: '#tour-company-recency',
            popover: {
              title: '📅 Recency Categories & Filters',
              description:
                'Focus on recent hiring trends by filtering questions by Last 30 Days, 3 Months, 6 Months, or All-Time, along with difficulty and solved filters.',
              side: 'bottom',
              align: 'start',
            },
          },
          {
            element: '#tour-company-table',
            popover: {
              title: '📋 Interview Problem Matrix',
              description:
                'View question frequencies, difficulty tiers, and mark problems as solved. Click any row to view full problem details, hints, and personal notes.',
              side: 'top',
              align: 'center',
            },
          },
          {
            element: '#tour-company-continue',
            popover: {
              title: '🚀 One-Click Continue Learning',
              description:
                'Jump directly into your highest-frequency unsolved question on LeetCode with personal notes ready at your fingertips.',
              side: 'bottom',
              align: 'end',
            },
          },
        ],
      };
    }

    // 3. Settings Page (Username, Session Cookie & Why Note)
    if (path === '/settings') {
      return {
        storageKey: 'lc_tour_settings_completed',
        steps: [
          {
            element: '#tour-settings-username',
            popover: {
              title: '👤 Public LeetCode Username',
              description:
                'Enter your public LeetCode handle (e.g. neetcode) to automatically synchronize your solved questions list without needing credentials.',
              side: 'bottom',
              align: 'start',
            },
          },
          {
            element: '#tour-settings-cookie',
            popover: {
              title: '🍪 LeetCode Session Cookie (Optional)',
              description:
                'Paste your LEETCODE_SESSION cookie from browser DevTools (F12 → Storage/Application → Cookies) to unlock instant, rate-limit-free synchronization.',
              side: 'bottom',
              align: 'start',
            },
          },
          {
            element: '#tour-settings-why-note',
            popover: {
              title: '💡 Why Use a Session Cookie?',
              description:
                'Public profile queries can experience caching delays. The session cookie directly queries your private submission log for 100% exact tracking. It is safely encrypted and completely optional.',
              side: 'top',
              align: 'start',
            },
          },
        ],
      };
    }

    return null;
  };

  // Launch tour for current route
  const runTourForRoute = (currentPath: string, isManualTrigger = false) => {
    const config = getTourConfig(currentPath);
    if (!config) {
      if (isManualTrigger) {
        // If triggered on unknown route, route to dashboard first
        router.push('/dashboard');
      }
      return;
    }

    activeStorageKeyRef.current = config.storageKey;

    let retryCount = 0;
    const tryLaunch = () => {
      // Check if the first step's target element is in DOM
      const firstTarget = typeof config.steps[0]?.element === 'string'
        ? document.querySelector(config.steps[0].element)
        : null;

      if (!firstTarget && retryCount < 6) {
        retryCount++;
        setTimeout(tryLaunch, 250);
        return;
      }

      if (driverRef.current) {
        driverRef.current.destroy();
      }

      const instance = driver({
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
        steps: config.steps,
        onDestroyStarted: () => {
          stopTour();
          if (activeStorageKeyRef.current) {
            try {
              localStorage.setItem(activeStorageKeyRef.current, 'true');
            } catch {
              // Ignore localStorage errors
            }
          }
          if (driverRef.current) {
            driverRef.current.destroy();
            driverRef.current = null;
          }
        },
      });

      driverRef.current = instance;
      instance.drive();
    };

    setTimeout(tryLaunch, 150);
  };

  // Listen to manual tour trigger from Navbar / User dropdown
  useEffect(() => {
    if (tourRunning) {
      runTourForRoute(pathname, true);
    } else if (driverRef.current && driverRef.current.isActive()) {
      driverRef.current.destroy();
      driverRef.current = null;
    }
  }, [tourRunning, pathname]);

  // Auto-launch for first-time visitors on each supported page
  useEffect(() => {
    const config = getTourConfig(pathname);
    if (!config) return;

    try {
      const completed = localStorage.getItem(config.storageKey);
      if (!completed) {
        const timer = setTimeout(() => {
          // Double check tour isn't already running
          if (!driverRef.current?.isActive()) {
            runTourForRoute(pathname, false);
          }
        }, 750);
        return () => clearTimeout(timer);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [pathname]);

  // Clean up on unmount or route change
  useEffect(() => {
    return () => {
      if (driverRef.current) {
        driverRef.current.destroy();
      }
    };
  }, [pathname]);

  return null;
}
