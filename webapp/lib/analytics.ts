// Google Analytics 4 (GA4) integration utilities

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID;

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

/**
 * Ensures gtag and dataLayer exist so calls before the script finishes loading
 * are cleanly queued and never dropped.
 */
const getGtag = () => {
  if (typeof window === 'undefined' || !GA_MEASUREMENT_ID) return null;
  if (typeof window.gtag === 'function') return window.gtag;

  window.dataLayer = window.dataLayer || [];
  const gtagStub = function (...args: any[]) {
    window.dataLayer!.push(args);
  };
  window.gtag = gtagStub;
  return gtagStub;
};

/**
 * Sends pageview events to Google Analytics on route transition.
 */
export const pageview = (url: string) => {
  const gtag = getGtag();
  if (!gtag || !GA_MEASUREMENT_ID) return;

  gtag('config', GA_MEASUREMENT_ID, {
    page_path: url,
  });
};

/**
 * Sets user ID for unified cross-device DAU/MAU measurement.
 */
export const setUserId = (userId: string | null) => {
  const gtag = getGtag();
  if (!gtag || !GA_MEASUREMENT_ID || !userId) return;

  gtag('set', { user_id: userId });
};

/**
 * Sets user properties (e.g. account_status: registered vs guest).
 */
export const setUserProperties = (properties: Record<string, string | number | boolean>) => {
  const gtag = getGtag();
  if (!gtag || !GA_MEASUREMENT_ID) return;

  gtag('set', 'user_properties', properties);
};

/**
 * Generic event dispatcher. Safe to call anywhere:
 * gracefully queues in dataLayer even if GA script is still loading.
 */
export const trackEvent = (
  action: string,
  params?: Record<string, string | number | boolean | null | undefined>
) => {
  const gtag = getGtag();
  if (!gtag || !GA_MEASUREMENT_ID) return;

  // Filter out undefined values to keep GA4 payloads clean
  const cleanParams: Record<string, string | number | boolean | null> = {};
  if (params) {
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined) {
        cleanParams[key] = val;
      }
    }
  }

  gtag('event', action, cleanParams);
};

// ==========================================
// Strongly-Typed Meaningful Product Events
// ==========================================

export const Analytics = {
  // 1. Company View
  companyView: (data: { slug: string; name?: string; totalProblems?: number; solvedProblems?: number }) => {
    trackEvent('view_company', {
      company_slug: data.slug,
      company_name: data.name || data.slug,
      total_problems: data.totalProblems,
      solved_problems: data.solvedProblems,
    });
  },

  // 2. Problem Detail Modal Opened
  problemOpen: (data: { id: number; title: string; difficulty: string }) => {
    trackEvent('open_problem', {
      problem_id: data.id,
      problem_title: data.title,
      difficulty: data.difficulty,
    });
  },

  // 3. Mark Problem Solved / Unsolved
  solveToggle: (data: { id: number; title?: string; difficulty?: string; solved: boolean }) => {
    trackEvent('solve_toggle', {
      problem_id: data.id,
      problem_title: data.title,
      difficulty: data.difficulty,
      is_solved: data.solved,
    });
  },

  // 4. Bookmark Toggle
  bookmarkToggle: (data: { id: number; title?: string; difficulty?: string; bookmarked: boolean }) => {
    trackEvent('bookmark_toggle', {
      problem_id: data.id,
      problem_title: data.title,
      difficulty: data.difficulty,
      is_bookmarked: data.bookmarked,
    });
  },

  // 5. Outbound click to practice on LeetCode
  solveOnLeetCodeClick: (data: { id: number; title: string; url: string }) => {
    trackEvent('click_solve_on_leetcode', {
      problem_id: data.id,
      problem_title: data.title,
      target_url: data.url,
    });
  },

  // 6. Guest Gate Triggered (Conversion funnel)
  guestGatePrompt: (data: { reason: string }) => {
    trackEvent('guest_gate_prompt', {
      gate_reason: data.reason,
    });
  },

  // 7. Guest Gate Google Sign In Clicked
  guestGateSignInClick: (data?: { reason?: string }) => {
    trackEvent('guest_gate_sign_in_click', {
      gate_reason: data?.reason,
    });
  },

  // 8. Auto / Background LeetCode Sync Completed
  leetcodeSync: (data: { reason: string; syncedCount: number }) => {
    trackEvent('leetcode_sync', {
      sync_trigger: data.reason,
      new_problems_synced: data.syncedCount,
    });
  },

  // 9. Catalog / Problem Search
  search: (data: { query: string; location: 'navbar_global' | 'company_page' | 'companies_catalog' }) => {
    if (!data.query.trim()) return;
    trackEvent('search', {
      search_term: data.query.trim().toLowerCase(),
      search_location: data.location,
    });
  },
};
