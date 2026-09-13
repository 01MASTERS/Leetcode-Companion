'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
import { getGuestProgress, removeGuestProblems } from '@/lib/guest-storage';
import { useTrackerStore } from '@/store/useTrackerStore';

export default function GuestMigrator() {
  const { status } = useSession();
  const queryClient = useQueryClient();
  const { addToast } = useTrackerStore();
  const isMigratingRef = useRef(false);

  useEffect(() => {
    if (status !== 'authenticated' || isMigratingRef.current) return;

    const guestData = getGuestProgress();
    const keys = Object.keys(guestData);

    if (keys.length === 0) return;

    isMigratingRef.current = true;

    async function migrate() {
      try {
        const res = await fetch('/api/guest-migrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ progress: guestData }),
        });

        if (!res.ok) {
          throw new Error('Migration failed');
        }

        const result = await res.json();
        if (result.success && result.count > 0) {
          const snapshotProblemIds = Object.keys(guestData).map(Number).filter(n => Number.isInteger(n) && n > 0);
          removeGuestProblems(snapshotProblemIds);
          queryClient.invalidateQueries({ queryKey: ['stats'] });
          queryClient.invalidateQueries({ queryKey: ['companies'] });
          queryClient.invalidateQueries({ queryKey: ['company'] });
          queryClient.invalidateQueries({ queryKey: ['problem'] });

          addToast(
            `Migrated ${result.count} offline question(s) & notes to your cloud account! 🎉`,
            'success'
          );
        }
      } catch (err) {
        console.error('Failed to migrate guest progress:', err);
      } finally {
        isMigratingRef.current = false;
      }
    }

    migrate();
  }, [status, queryClient, addToast]);

  return null;
}
