'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTrackerStore } from '@/store/useTrackerStore';
import { X, ExternalLink, Building2, Star, Save, Clipboard, CheckCircle, Circle } from 'lucide-react';
import { getDifficultyColor, formatPercent } from '@/utils/helpers';
import AnimatedList from '@/components/AnimatedList';
import { Analytics } from '@/lib/analytics';
import { useGuestProgress, updateGuestProblem } from '@/lib/guest-storage';

interface ProblemDetail {
  id: number;
  title: string;
  url: string;
  difficulty: string;
  solved: boolean;
  isManual?: boolean;
  notes: string;
  bookmarked: boolean;
  companies: Array<{
    id: number;
    name: string;
    slug: string;
    frequency: number;
  }>;
}

export default function ProblemModal() {
  const queryClient = useQueryClient();
  const { status } = useSession();
  const isGuest = status === 'unauthenticated';
  const { selectedProblemId, setSelectedProblemId, addToast, openGuestGate } = useTrackerStore();
  const [notesText, setNotesText] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const guestProgress = useGuestProgress();
  const guestItem = selectedProblemId ? guestProgress[selectedProblemId] : undefined;

  // Fetch problem details
  const { data: rawProblem, isLoading, error } = useQuery<ProblemDetail>({
    queryKey: ['problem', selectedProblemId, { isGuest }],
    queryFn: async () => {
      if (!selectedProblemId) return null;
      const res = await fetch(`/api/problems/${selectedProblemId}${isGuest ? '?guest=1' : ''}`);
      if (!res.ok) throw new Error('Problem not found');
      return res.json();
    },
    enabled: !!selectedProblemId && status !== 'loading',
  });

  const isProblemLoading = isLoading || status === 'loading';

  // Merge server data with local guest overrides if guest
  const problem: ProblemDetail | null = rawProblem
    ? {
        ...rawProblem,
        solved: isGuest && guestItem?.solved !== undefined ? Boolean(guestItem.solved) : rawProblem.solved,
        isManual: isGuest && guestItem?.solved !== undefined ? true : Boolean(rawProblem.isManual),
        bookmarked:
          isGuest && guestItem?.bookmarked !== undefined ? Boolean(guestItem.bookmarked) : rawProblem.bookmarked,
        notes: isGuest && guestItem?.notes !== undefined ? (guestItem.notes || '') : rawProblem.notes,
      }
    : null;

  // Sync state notes when data is loaded
  useEffect(() => {
    if (problem) {
      setNotesText(problem.notes || '');
      Analytics.problemOpen({
        id: problem.id,
        title: problem.title,
        difficulty: problem.difficulty,
      });
    }
  }, [problem?.id, isGuest ? guestItem?.notes : null]);

  // Mutation to toggle bookmark
  const toggleBookmarkMutation = useMutation({
    mutationFn: async (bookmarked: boolean) => {
      if (isGuest && selectedProblemId) {
        updateGuestProblem(selectedProblemId, { bookmarked });
        return { bookmarked };
      }
      const res = await fetch(`/api/problems/${selectedProblemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookmarked }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const err: any = new Error(data.error || 'Failed to update bookmark');
        err.isGuest = data.isGuest || res.status === 401;
        throw err;
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['problem', selectedProblemId] });
      queryClient.invalidateQueries({ queryKey: ['company'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      addToast(
        data.bookmarked ? 'Added problem to Bookmarks' : 'Removed from Bookmarks',
        'success'
      );
      if (selectedProblemId) {
        Analytics.bookmarkToggle({
          id: selectedProblemId,
          title: problem?.title,
          difficulty: problem?.difficulty,
          bookmarked: data.bookmarked,
        });
      }
    },
    onError: (err: any) => {
      if (err.isGuest || err.message?.includes('Sign in with Google')) {
        openGuestGate('Sign in with Google to bookmark problems across all your devices.');
      } else {
        addToast(err.message || 'Failed to update bookmark', 'error');
      }
    },
  });

  // Mutation to toggle solved status
  const toggleSolvedMutation = useMutation({
    mutationFn: async ({ problemId, solved }: { problemId: number; solved: boolean }) => {
      if (isGuest) {
        updateGuestProblem(problemId, { solved, isManual: true });
        return { id: problemId, solved, isManual: true };
      }
      const res = await fetch(`/api/problems/${problemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ solved }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const err: any = new Error(data.error || 'Failed to update solved status');
        err.isGuest = data.isGuest || res.status === 401;
        throw err;
      }
      return res.json();
    },
    onMutate: async ({ problemId, solved }) => {
      await queryClient.cancelQueries({ queryKey: ['problem', problemId] });
      const previousProblem = queryClient.getQueryData(['problem', problemId, { isGuest }]);
      queryClient.setQueryData(['problem', problemId, { isGuest }], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          solved,
          // Optimistically show green/verified; backend will reconcile to blue if manual
          isManual: solved ? false : false,
        };
      });
      return { previousProblem, problemId };
    },
    onError: (err: any, variables, context) => {
      const targetId = variables.problemId;
      if (context?.previousProblem) {
        queryClient.setQueryData(['problem', targetId, { isGuest }], context.previousProblem);
      }
      if (err.isGuest || err.message?.includes('Sign in with Google')) {
        openGuestGate('Sign in with Google to sync and track your solved problems.');
      } else {
        addToast(err.message || 'Failed to update solved status', 'error');
      }
    },
    onSuccess: (data, variables) => {
      const targetId = variables.problemId;
      // Reconcile problem cache with backend response
      queryClient.setQueryData(['problem', targetId, { isGuest }], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          solved: data.solved,
          isManual: data.isManual,
        };
      });
      queryClient.invalidateQueries({ queryKey: ['problem', targetId] });
      queryClient.invalidateQueries({ queryKey: ['company'] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      addToast(
        data.solved
          ? data.isManual
            ? 'Marked as manual'
            : 'Solved & verified'
          : 'Marked as unsolved',
        'success'
      );
      if (targetId) {
        Analytics.solveToggle({
          id: targetId,
          title: problem?.title,
          difficulty: problem?.difficulty,
          solved: data.solved,
        });
      }
    },
  });

  // Mutation to save notes
  const saveNotesMutation = useMutation({
    mutationFn: async (notes: string) => {
      setIsSavingNotes(true);
      if (isGuest && selectedProblemId) {
        updateGuestProblem(selectedProblemId, { notes });
        return { notes };
      }
      const res = await fetch(`/api/problems/${selectedProblemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const err: any = new Error(data.error || 'Failed to save notes');
        err.isGuest = data.isGuest || res.status === 401;
        throw err;
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['problem', selectedProblemId] });
      addToast('Notes saved successfully', 'success');
      setIsSavingNotes(false);
    },
    onError: (err: any) => {
      if (err.isGuest || err.message?.includes('Sign in with Google')) {
        openGuestGate('Sign in with Google to save notes to your personal cloud account.');
      } else {
        addToast(err.message || 'Failed to save notes.', 'error');
      }
      setIsSavingNotes(false);
    },
  });

  if (!selectedProblemId) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setSelectedProblemId(null)}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal Content Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="glass-blur w-full max-w-3xl rounded-2xl border border-border shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh] text-foreground"
        >
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-border flex items-start justify-between gap-3 sm:gap-4 flex-shrink-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <span className="text-muted-foreground font-mono text-xs sm:text-sm">#{selectedProblemId}</span>
                {problem && (
                  <span className={`px-2 sm:px-2.5 py-0.5 rounded-full border text-[10px] sm:text-xs font-semibold uppercase tracking-wider ${getDifficultyColor(problem.difficulty)}`}>
                    {problem.difficulty}
                  </span>
                )}

                {problem && (
                  problem.solved ? (
                    problem.isManual ? (
                      <span className="px-2 sm:px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-400 text-[10px] sm:text-xs font-semibold select-none flex items-center gap-1" title="Self-reported solve">
                        <CheckCircle className="h-3 sm:h-3.5 w-3 sm:w-3.5" /> Marked Solved
                      </span>
                    ) : (
                      <span className="px-2 sm:px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400 text-[10px] sm:text-xs font-semibold select-none flex items-center gap-1" title="Verified against LeetCode accepted submissions">
                        <CheckCircle className="h-3 sm:h-3.5 w-3 sm:w-3.5" /> Solved & Verified
                      </span>
                    )
                  ) : (
                    <span className="px-2 sm:px-2.5 py-0.5 rounded-full bg-muted/60 border border-border text-muted-foreground text-[10px] sm:text-xs font-semibold select-none flex items-center gap-1">
                      <Circle className="h-3 sm:h-3.5 w-3 sm:w-3.5 text-muted-foreground/50" /> Unsolved
                    </span>
                  )
                )}
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-foreground mt-1.5 sm:mt-2 select-text truncate sm:whitespace-normal">
                {isProblemLoading ? 'Loading Problem...' : problem?.title}
              </h2>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {problem && (
                <button
                  onClick={() => toggleBookmarkMutation.mutate(!problem.bookmarked)}
                  className={`p-1.5 sm:p-2 rounded-xl border transition-all cursor-pointer ${
                    problem.bookmarked
                      ? 'border-amber-200 text-amber-700 bg-amber-50 dark:border-yellow-500/40 dark:text-yellow-400 dark:bg-yellow-500/10 shadow-sm'
                      : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                  title={problem.bookmarked ? 'Remove bookmark' : 'Star/Bookmark problem'}
                >
                  <Star 
                    fill={problem.bookmarked ? "currentColor" : "none"} 
                    className={`h-4 sm:h-5 w-4 sm:w-5 ${problem.bookmarked ? 'text-amber-600 dark:text-yellow-400' : ''}`} 
                  />
                </button>
              )}
              <button
                onClick={() => setSelectedProblemId(null)}
                className="p-1.5 sm:p-2 border border-border rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="h-4 sm:h-5 w-4 sm:w-5" />
              </button>
            </div>
          </div>

          {/* Loading / Error states */}
          {isProblemLoading && (
            <div className="flex-1 p-8 sm:p-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <span className="text-xs sm:text-sm">Fetching details from database...</span>
            </div>
          )}

          {error && (
            <div className="flex-1 p-8 sm:p-12 flex flex-col items-center justify-center gap-3 text-rose-500 text-xs sm:text-sm">
              <span>Could not load problem details.</span>
              <button
                onClick={() => setSelectedProblemId(null)}
                className="px-4 py-2 bg-muted border border-border text-foreground rounded-xl hover:bg-muted/80 transition-colors cursor-pointer"
              >
                Close Modal
              </button>
            </div>
          )}

          {/* Body */}
          {problem && (
            <div className="flex-grow p-4 sm:p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-12 gap-5 sm:gap-6">
              {/* Left Column: Actions & Notes */}
              <div className="md:col-span-7 flex flex-col gap-5">
                {/* Actions Panel */}
                <div className="bg-muted/40 border border-border p-4 rounded-xl flex items-center justify-between gap-3">
                  <button
                    onClick={() => {
                      if (selectedProblemId && !toggleSolvedMutation.isPending) {
                        toggleSolvedMutation.mutate({ problemId: selectedProblemId, solved: !problem.solved });
                      }
                    }}
                    disabled={toggleSolvedMutation.isPending}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-sm font-bold transition-all ${
                      toggleSolvedMutation.isPending ? 'opacity-80 cursor-wait' : 'cursor-pointer'
                    } ${
                      problem.solved
                        ? problem.isManual
                          ? 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20'
                          : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20'
                        : 'border-border bg-card text-foreground hover:bg-muted/80'
                    }`}
                    title={problem.solved ? 'Click to mark as unsolved' : 'Click to mark as solved'}
                  >
                    {problem.solved ? (
                      problem.isManual ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          <span>Marked Solved</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-500" />
                          <span>Solved & Verified ✓</span>
                        </>
                      )
                    ) : (
                      <>
                        <Circle className="h-4 w-4 text-muted-foreground" />
                        <span>Mark as Solved</span>
                      </>
                    )}
                  </button>

                  <a
                    href={problem.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      Analytics.solveOnLeetCodeClick({
                        id: problem.id,
                        title: problem.title,
                        url: problem.url,
                      });
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-primary bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/10 cursor-pointer"
                  >
                    <span>Solve on LeetCode</span>
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>

                {/* Notes Block */}
                <div className="flex-grow flex flex-col gap-2 min-h-[200px]">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Clipboard className="h-4 w-4 text-primary" />
                      Notes
                    </label>
                    <button
                      onClick={() => saveNotesMutation.mutate(notesText)}
                      disabled={isSavingNotes || problem.notes === notesText}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        problem.notes !== notesText
                          ? 'border-primary/30 text-primary bg-primary/10 hover:bg-primary/20'
                          : 'border-border text-muted-foreground bg-transparent pointer-events-none'
                      }`}
                    >
                      <Save className="h-3.5 w-3.5" />
                      Save
                    </button>
                  </div>
                  <textarea
                    value={notesText}
                    onChange={(e) => setNotesText(e.target.value)}
                    placeholder="Write down notes, solutions approaches, or key reminders here..."
                    className="w-full flex-grow bg-input-bg border border-border rounded-xl p-4 text-sm text-foreground outline-none focus:border-primary/50 transition-colors resize-none placeholder:text-zinc-400 dark:placeholder:text-zinc-600 min-h-[160px]"
                  />
                </div>
              </div>

              {/* Right Column: Company Listings */}
              <div className="md:col-span-5 flex flex-col gap-3 max-h-[400px] md:max-h-full">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-primary" />
                  Companies ({problem.companies.length})
                </div>

                {/* Helper Banner for Duplicate Detection */}
                {problem.companies.length > 1 && (
                  <div className="p-3 bg-muted/60 border border-border rounded-xl text-[11px] text-muted-foreground leading-relaxed select-none">
                    ⭐ This problem exists in <strong className="text-foreground">{problem.companies.length} companies</strong>.
                    Solving it updates progress for all of them simultaneously!
                  </div>
                )}

                <div className="flex-grow min-h-0">
                  <AnimatedList
                    items={problem.companies}
                    showGradients={false}
                    displayScrollbar={problem.companies.length > 5}
                    enableArrowNavigation={false}
                    renderItem={(cp, index, isSelected) => (
                      <div
                        className={`flex items-center justify-between p-3.5 border rounded-xl transition-all duration-200 ${
                          isSelected
                            ? 'bg-muted/80 border-primary/50 text-primary'
                            : 'bg-muted/20 border-border text-foreground hover:bg-muted/30'
                        }`}
                      >
                        <span className="text-sm font-semibold">{cp.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-medium text-muted-foreground">Freq:</span>
                          <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border">
                            {formatPercent(cp.frequency)}
                          </span>
                        </div>
                      </div>
                    )}
                  />
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
