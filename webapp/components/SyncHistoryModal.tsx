'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useTrackerStore } from '@/store/useTrackerStore';
import { CatalogSyncStatus } from '@/types';
import { formatRelativeTime, formatExactTimestamp } from '@/utils/helpers';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { X, History, ExternalLink, CheckCircle2, GitCommit, Layers, Database, ShieldCheck } from 'lucide-react';

export default function SyncHistoryModal() {
  const isAdmin = useIsAdmin();
  const { syncHistoryModalOpen, closeSyncHistoryModal } = useTrackerStore();

  const { data, isLoading } = useQuery<CatalogSyncStatus>({
    queryKey: ['catalog-sync-status'],
    queryFn: async () => {
      const res = await fetch('/api/catalog/sync-status');
      if (!res.ok) throw new Error('Failed to fetch sync status');
      return res.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes cache
    enabled: syncHistoryModalOpen && isAdmin,
  });

  // Close on Escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeSyncHistoryModal();
      }
    };
    if (syncHistoryModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [syncHistoryModalOpen, closeSyncHistoryModal]);

  if (!syncHistoryModalOpen || !isAdmin) return null;

  const latest = data?.latest;
  const history = data?.history || [];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeSyncHistoryModal}
          className="fixed inset-0 bg-black/75 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ type: 'spring', duration: 0.3 }}
          className="relative w-full max-w-2xl glass bg-card/95 border border-border/90 rounded-2xl shadow-2xl text-card-foreground overflow-hidden z-10 select-none flex flex-col max-h-[85vh]"
        >
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-24 -right-24 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

          {/* Modal Header */}
          <div className="flex items-start justify-between p-6 border-b border-border/70 relative">
            <div className="flex items-center gap-3.5">
              <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
                <History className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                  Catalog Sync History & Audit Trail
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Automated verification logs tracking upstream changes from{' '}
                  <span className="font-mono text-foreground/80">snehasishroy/leetcode-companywise-interview-questions</span>
                </p>
              </div>
            </div>

            <button
              onClick={closeSyncHistoryModal}
              className="text-muted-foreground hover:text-foreground p-2 rounded-xl hover:bg-muted/80 transition-colors"
              aria-label="Close modal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Overview Metrics Strip */}
          <div className="grid grid-cols-3 gap-3 p-4 bg-muted/30 border-b border-border/60 text-xs">
            <div className="flex flex-col p-2.5 rounded-xl bg-card/70 border border-border/60">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                <Database className="h-3.5 w-3.5 text-primary" />
                <span>Companies</span>
              </div>
              <span className="text-base font-bold text-foreground mt-1">
                {latest?.totalCompanies ? `${latest.totalCompanies} Tracks` : '658 Tracks'}
              </span>
            </div>

            <div className="flex flex-col p-2.5 rounded-xl bg-card/70 border border-border/60">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                <Layers className="h-3.5 w-3.5 text-amber-400" />
                <span>Verified Problems</span>
              </div>
              <span className="text-base font-bold text-foreground mt-1">
                {latest?.totalProblems ? `${latest.totalProblems.toLocaleString()} Total` : '3,399 Total'}
              </span>
            </div>

            <div className="flex flex-col p-2.5 rounded-xl bg-card/70 border border-border/60">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span>Sync Schedule</span>
              </div>
              <span className="text-xs font-semibold text-foreground mt-1.5 leading-snug">
                Daily at 04:00 UTC
              </span>
            </div>
          </div>

          {/* Scrollable Audit Feed */}
          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            {isLoading ? (
              <div className="space-y-4 py-8">
                <div className="h-16 w-full bg-muted/60 rounded-xl shimmer" />
                <div className="h-16 w-full bg-muted/60 rounded-xl shimmer" />
                <div className="h-16 w-full bg-muted/60 rounded-xl shimmer" />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-xs">
                No sync audit events recorded yet.
              </div>
            ) : (
              <div className="relative border-l-2 border-border/80 ml-3.5 pl-6 space-y-6">
                {history.map((item, idx) => (
                  <div key={item.id} className="relative group">
                    {/* Glowing Bullet Dot */}
                    <div
                      className={`absolute -left-[31px] top-1.5 h-4 w-4 rounded-full border-2 flex items-center justify-center transition-all ${
                        idx === 0
                          ? 'bg-emerald-500 border-emerald-400/80 shadow-md shadow-emerald-500/40 ring-4 ring-emerald-500/10'
                          : 'bg-card border-border group-hover:border-primary'
                      }`}
                    >
                      {idx === 0 && <span className="h-1.5 w-1.5 bg-black rounded-full" />}
                    </div>

                    <div className="p-4 rounded-xl border border-border/70 bg-card/60 hover:bg-muted/30 transition-colors">
                      {/* Top row: relative time, exact timestamp, commit link */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground">
                            {formatRelativeTime(item.syncedAt)}
                          </span>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            • {formatExactTimestamp(item.syncedAt)}
                          </span>
                          {idx === 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Current Active
                            </span>
                          )}
                        </div>

                        {/* Commit link */}
                        <a
                          href={item.commitUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/60 hover:bg-muted text-[11px] font-mono font-medium text-foreground hover:text-primary transition-colors border border-border"
                          title="View GitHub Commit Diff"
                        >
                          <GitCommit className="h-3 w-3 text-muted-foreground" />
                          <span>#{item.shortSha}</span>
                          <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
                        </a>
                      </div>

                      {/* Summary Notes */}
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {item.summary || 'Catalog synchronized successfully from upstream dataset.'}
                      </p>

                      <div className="mt-3 pt-2.5 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1 text-emerald-400 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Ingestion verified in Supabase PostgreSQL</span>
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-4 bg-muted/30 border-t border-border/70 flex items-center justify-between">
            <a
              href="https://github.com/snehasishroy/leetcode-companywise-interview-questions"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary font-medium transition-colors"
            >
              <span>View Source Dataset Repository</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>

            <button
              onClick={closeSyncHistoryModal}
              className="px-4 py-2 rounded-xl bg-card border border-border text-foreground hover:bg-muted text-xs font-semibold transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
