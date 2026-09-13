'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { pageview, setUserId, setUserProperties, GA_MEASUREMENT_ID } from '@/lib/analytics';

export default function GoogleAnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const isFirstRender = useRef(true);

  // 1. Unify User Identity across devices for accurate DAU/MAU measurement
  useEffect(() => {
    if (!GA_MEASUREMENT_ID || status === 'loading') return;

    if (session?.user?.id) {
      setUserId(session.user.id);
      setUserProperties({
        account_status: 'registered',
      });
    } else {
      setUserProperties({
        account_status: 'guest',
      });
    }
  }, [session?.user?.id, status]);

  // 2. Track SPA route navigation pageviews (skipping first render since gtag config already sent it)
  useEffect(() => {
    if (!GA_MEASUREMENT_ID) return;

    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const query = searchParams?.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    
    pageview(url);
  }, [pathname, searchParams]);

  return null;
}
