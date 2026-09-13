'use client';

import { useState, useEffect } from 'react';

export interface GuestProblemProgress {
  solved?: boolean;
  isManual?: boolean;
  solvedAt?: string | null;
  bookmarked?: boolean;
  notes?: string;
}

export type GuestProgressMap = Record<number, GuestProblemProgress>;

const STORAGE_KEY = 'lc_guest_progress';
const EVENT_NAME = 'lc_guest_progress_updated';

export function getGuestProgress(): GuestProgressMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch (e) {
    console.error('Failed to read guest progress from localStorage', e);
    return {};
  }
}

export function saveGuestProgress(data: GuestProgressMap): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save guest progress to localStorage', e);
  }
}

export function updateGuestProblem(problemId: number, patch: Partial<GuestProblemProgress>): GuestProgressMap {
  const current = getGuestProgress();
  const existing = current[problemId] || {};
  const updated: GuestProblemProgress = {
    ...existing,
    ...patch,
  };

  // If problem is marked solved, ensure solvedAt is recorded
  if (patch.solved === true && !patch.solvedAt && !existing.solvedAt) {
    updated.solvedAt = new Date().toISOString();
  } else if (patch.solved === false) {
    updated.solvedAt = null;
  }

  current[problemId] = updated;
  saveGuestProgress(current);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { problemId, progress: updated } }));
  }

  return current;
}

export function clearGuestProgress(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: {} }));
  } catch (e) {
    console.error('Failed to clear guest progress', e);
  }
}

export function removeGuestProblems(problemIds: number[]): void {
  if (typeof window === 'undefined' || !problemIds || problemIds.length === 0) return;
  try {
    const current = getGuestProgress();
    let changed = false;
    for (const id of problemIds) {
      if (id in current) {
        delete current[id];
        changed = true;
      }
    }
    if (changed) {
      saveGuestProgress(current);
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: {} }));
    }
  } catch (e) {
    console.error('Failed to remove migrated guest problems', e);
  }
}

export function useGuestProgress(): GuestProgressMap {
  const [progress, setProgress] = useState<GuestProgressMap>(() => {
    if (typeof window === 'undefined') return {};
    return getGuestProgress();
  });

  useEffect(() => {
    // Initial sync upon mount
    setProgress(getGuestProgress());

    const handler = () => {
      setProgress(getGuestProgress());
    };

    window.addEventListener(EVENT_NAME, handler);
    window.addEventListener('storage', handler);

    return () => {
      window.removeEventListener(EVENT_NAME, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  return progress;
}
