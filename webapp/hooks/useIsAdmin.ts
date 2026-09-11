'use client';

import { useSession } from 'next-auth/react';

/**
 * Returns true if the currently authenticated user's email matches the configured admin email list.
 */
export function useIsAdmin(): boolean {
  const { data: session } = useSession();
  const adminConfig = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  if (!session?.user?.email || !adminConfig) return false;

  const adminEmails = adminConfig
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return adminEmails.includes(session.user.email.toLowerCase());
}
