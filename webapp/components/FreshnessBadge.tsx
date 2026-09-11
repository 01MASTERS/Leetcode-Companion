'use client';

import React, { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTrackerStore } from '@/store/useTrackerStore';
import { CatalogSyncStatus } from '@/types';
import { formatRelativeTime, formatExactTimestamp } from '@/utils/helpers';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { Zap, ExternalLink, GitCommit, ChevronRight, CheckCircle2 } from 'lucide-react';

export default function FreshnessBadge() {
  const isAdmin = useIsAdmin();
  const { openSyncHistoryModal } = useTrackerStore();
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { data } = useQuery<CatalogSyncStatus>({
    queryKey: ['catalog-sync-status'],
    queryFn: async () => {
      const res = await fetch('/api/catalog/sync-status');
      if (!res.ok) throw new Error('Failed to fetch sync status');
      return res.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });

  const latest = data?.latest;

  const handleMouseEnter = () => {
    if (!isAdmin) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    if (!isAdmin) return;
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 200);
  };

  if (!latest) {
    return null;
  }

  const relativeText = formatRelativeTime(latest.syncedAt);

  // For regular users and guests: only display the title badge, no hover popover, no modal click
  if (!isAdmin) {
    return (
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-card border border-border/80 text-xs text-muted-foreground select-none"
        title={`Questions updated: ${relativeText}`}
      >
        <Zap className="h-3 w-3 text-amber-400" />
        <span className="text-[11px] font-medium hidden md:inline">Questions updated:</span>
        <span className="text-[11px] font-bold text-foreground">{relativeText}</span>
      </div>
    );
  }

  return (
    <div
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Trigger Badge */}
      <button
        onClick={() => openSyncHistoryModal()}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-card border border-border/80 hover:border-border hover:bg-muted/60 transition-all text-xs text-muted-foreground hover:text-foreground cursor-pointer group shadow-sm select-none"
        title="Click to view catalog sync audit history"
        aria-label="Catalog freshness status"
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <Zap className="h-3 w-3 text-amber-400 group-hover:scale-110 transition-transform" />
        <span className="text-[11px] font-medium hidden md:inline">Questions updated:</span>
        <span className="text-[11px] font-bold text-foreground">{relativeText}</span>
      </button>

      {/* Glassmorphic Hover Popover */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-80 glass bg-card/95 backdrop-blur-xl border border-border/90 rounded-2xl shadow-2xl p-4 z-50 text-foreground animate-in fade-in slide-in-from-top-1 duration-150 select-none"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <span className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </span>
              <span className="text-xs font-bold text-foreground">Catalog Freshness</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Live & Verified
            </span>
          </div>

          {/* Details */}
          <div className="py-3 space-y-2.5 text-xs">
            <div>
              <div className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">
                Last Verified Sync
              </div>
              <div className="font-medium text-foreground text-xs mt-0.5">
                {formatExactTimestamp(latest.syncedAt)}
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div>
                <div className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">
                  Upstream Commit
                </div>
                <a
                  href={latest.commitUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-primary hover:underline text-xs font-semibold mt-0.5"
                  title="View upstream commit on GitHub"
                >
                  <GitCommit className="h-3 w-3" />
                  <span>#{latest.shortSha}</span>
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </div>

              <div className="text-right">
                <div className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">
                  Catalog Scope
                </div>
                <div className="font-semibold text-foreground text-xs mt-0.5">
                  {latest.totalCompanies} Cos • {latest.totalProblems.toLocaleString()} Qs
                </div>
              </div>
            </div>

            {/* Ingestion Notes */}
            {latest.summary && (
              <div className="bg-muted/40 border border-border/60 rounded-xl p-2.5 text-[11px] text-muted-foreground leading-relaxed">
                {latest.summary}
              </div>
            )}
          </div>

          {/* Action to open full audit modal */}
          <div className="pt-2 border-t border-border/60">
            <button
              onClick={() => {
                setIsOpen(false);
                openSyncHistoryModal();
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-muted/60 hover:bg-muted text-xs font-semibold text-foreground transition-colors cursor-pointer"
            >
              <span>View Full Sync Audit Trail</span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
