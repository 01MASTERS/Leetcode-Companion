'use client';

import React, { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useTrackerStore } from '@/store/useTrackerStore';
import { CompanyDetail, Problem } from '@/types';
import { getDifficultyColor, formatPercent, formatRelativeTime } from '@/utils/helpers';
import { ArrowLeft, Play, ExternalLink, Bookmark, CheckCircle, Circle, Star, HelpCircle, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';

type RecencyFilter = 'all' | 'thirtyDays' | 'threeMonths' | 'sixMonths' | 'moreThanSixMonths';

export default function CompanyPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const queryClient = useQueryClient();
  const { status } = useSession();
  const isGuest = status !== 'authenticated';
  
  const { globalSearch, setGlobalSearch, setSelectedProblemId, addToast, openGuestGate } = useTrackerStore();
  
  // Local page filters
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | 'Easy' | 'Medium' | 'Hard'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'solved' | 'unsolved' | 'starred'>('all');
  const [recencyFilter, setRecencyFilter] = useState<RecencyFilter>('all');

  // Pagination state (50 items per page by default for sub-50ms instant rendering)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'all'>(50);

  // Fetch company details
  const { data: company, isLoading, error } = useQuery<CompanyDetail>({
    queryKey: ['company', slug, { isGuest }],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${slug}${isGuest ? '?guest=1' : ''}`);
      if (!res.ok) throw new Error('Company not found');
      return res.json();
    },
  });

  // Reset page whenever search, filters, or page size change
  React.useEffect(() => {
    setPage(1);
  }, [globalSearch, difficultyFilter, statusFilter, recencyFilter, pageSize]);

  // Reset global search when entering/leaving page
  React.useEffect(() => {
    return () => setGlobalSearch('');
  }, [setGlobalSearch]);

  // Filter questions list
  const filteredProblems = useMemo(() => {
    if (!company) return [];
    
    return company.problems.filter(prob => {
      // 1. Text Search (title or ID)
      const matchesSearch = 
        prob.title.toLowerCase().includes(globalSearch.toLowerCase()) ||
        prob.id.toString().includes(globalSearch);

      // 2. Difficulty Filter
      const matchesDifficulty = difficultyFilter === 'all' || prob.difficulty === difficultyFilter;

      // 3. Solved / Starred Status Filter
      const matchesStatus = 
        statusFilter === 'all' ||
        (statusFilter === 'solved' && prob.solved) ||
        (statusFilter === 'unsolved' && !prob.solved) ||
        (statusFilter === 'starred' && prob.bookmarked);

      // 4. Recency CSV Category Filter
      let matchesRecency = true;
      if (recencyFilter !== 'all') {
        matchesRecency = !!prob.categories[recencyFilter];
      }

      return matchesSearch && matchesDifficulty && matchesStatus && matchesRecency;
    });
  }, [company, globalSearch, difficultyFilter, statusFilter, recencyFilter]);

  // Paginated problem slice for sub-50ms DOM rendering
  const totalFiltered = filteredProblems.length;
  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(totalFiltered / (pageSize as number)));
  const paginatedProblems = useMemo(() => {
    if (pageSize === 'all') return filteredProblems;
    const size = pageSize as number;
    const start = (page - 1) * size;
    return filteredProblems.slice(start, start + size);
  }, [filteredProblems, page, pageSize]);

  const toggleSolvedMutation = useMutation({
    mutationFn: async ({ id, solved }: { id: number; solved: boolean }) => {
      const res = await fetch(`/api/problems/${id}`, {
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
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['company', slug] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['problem', variables.id] });
      addToast(variables.solved ? 'Verified with LeetCode & marked as solved! 🎉' : 'Marked problem as unsolved', 'success');
    },
    onError: (err: any) => {
      if (err.isGuest || err.message?.includes('Sign in with Google')) {
        openGuestGate('Sign in with Google to sync and track your solved problems across devices.');
      } else {
        addToast(err.message || 'Failed to update solved status', 'error');
      }
    },
  });

  const handleContinueLearning = () => {
    if (!company || !company.firstUnsolved) {
      addToast('All questions solved for this company! 🎉', 'success');
      return;
    }
    const problem = company.firstUnsolved;
    // Open in LeetCode in a new tab
    window.open(problem.url, '_blank');
    // Open details modal in-app
    setSelectedProblemId(problem.id);
  };

  if (isLoading) {
    return (
      <div className="p-8 flex flex-col gap-6 max-w-7xl mx-auto text-foreground">
        <div className="h-6 w-24 bg-muted rounded-lg shimmer" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-2">
            <div className="h-10 w-64 bg-muted rounded-lg shimmer" />
            <div className="h-5 w-44 bg-muted rounded-lg shimmer" />
          </div>
          <div className="h-12 w-48 bg-muted rounded-xl shimmer" />
        </div>
        <div className="h-16 w-full bg-muted rounded-xl shimmer" />
        <div className="h-[400px] w-full bg-muted rounded-xl shimmer mt-4" />
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="p-8 flex flex-col items-center justify-center gap-4 min-h-[60vh] text-muted-foreground">
        <h3 className="text-lg font-bold text-foreground">Company Not Found</h3>
        <p className="text-sm">The company you are looking for does not exist or has no question data.</p>
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-2 px-4 py-2 border border-border bg-card rounded-xl hover:bg-muted transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>
      </div>
    );
  }

  const { stats, name } = company;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto flex flex-col gap-5 sm:gap-6 select-text text-foreground animate-in fade-in duration-300">
      {/* Back button */}
      <div>
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors py-1 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>
      </div>

      {/* Sticky Progress Bar & Title Area */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-5">
        <div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">{name}</h1>
            {company.updatedAt && (
              <span className="text-xs text-muted-foreground font-medium">
                Last updated: {formatRelativeTime(company.updatedAt)}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 flex items-center gap-2 flex-wrap">
            <span>Progress:</span>
            <strong className="text-foreground">{stats.solvedProblems}</strong> solved
            <span className="text-muted-foreground/60">/</span>
            <span>{stats.totalProblems} questions</span>
            <span className="text-muted-foreground/60">•</span>
            <span className="text-primary font-bold">{formatPercent(stats.completionPercentage)}</span> Complete
          </p>
        </div>

        {/* Continue Learning Button */}
        <button
          id="tour-company-continue"
          onClick={handleContinueLearning}
          className="flex items-center justify-center gap-2 px-5 py-2.5 sm:py-3 border border-primary bg-primary text-primary-foreground font-bold text-sm rounded-xl hover:bg-primary/95 transition-all shadow-xl shadow-primary/10 cursor-pointer w-full sm:w-auto shrink-0"
        >
          <Play className="h-4.5 w-4.5 fill-current" />
          <span>Continue Learning</span>
        </button>
      </div>

      {/* Embedded Sticky Progress Bar */}
      <div className="w-full bg-card border border-border/80 p-3.5 sm:p-4 rounded-2xl flex items-center gap-3 sm:gap-4 flex-wrap sm:flex-nowrap shadow-sm">
        <div className="flex-grow w-full bg-muted/60 dark:bg-muted/80 h-3 rounded-full overflow-hidden border border-border/50">
          <div
            className="bg-gradient-to-r from-primary to-amber-500 h-full rounded-full transition-all duration-700"
            style={{ width: `${stats.completionPercentage}%` }}
          />
        </div>
        <div className="flex-shrink-0 text-xs font-mono font-bold text-foreground/80 dark:text-muted-foreground">
          {stats.solvedProblems} / {stats.totalProblems} ({stats.completionPercentage.toFixed(0)}%)
        </div>
      </div>

      {/* Recency Categories & Filters Panel */}
      <div id="tour-company-recency" className="flex flex-col gap-4">
        {/* Recency Tabs */}
        <div className="flex items-center gap-1.5 border-b border-border pb-3 overflow-x-auto no-scrollbar flex-nowrap sm:flex-wrap">
          {(
            [
              { id: 'all', label: 'All Questions', icon: HelpCircle },
              { id: 'thirtyDays', label: 'Last 30 Days', icon: Calendar },
              { id: 'threeMonths', label: 'Last 3 Months', icon: Calendar },
              { id: 'sixMonths', label: 'Last 6 Months', icon: Calendar },
              { id: 'moreThanSixMonths', label: 'More than 6 Months', icon: Calendar },
            ] as const
          ).map((tab) => {
            const isActive = recencyFilter === tab.id;
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setRecencyFilter(tab.id)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm font-bold border-primary'
                    : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <TabIcon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Difficulty & Status Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 justify-between">
          {/* Left: Status filters */}
          <div className="flex items-center gap-1 sm:gap-1.5 bg-muted/40 p-1 border border-border rounded-xl overflow-x-auto no-scrollbar flex-nowrap">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'solved', label: 'Solved' },
                { id: 'unsolved', label: 'Unsolved' },
                { id: 'starred', label: '⭐ Starred' },
              ] as const
            ).map((f) => {
              const active = statusFilter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id)}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm border border-primary'
                      : 'border border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* Right: Difficulty filters */}
          <div className="flex items-center gap-1 sm:gap-1.5 bg-muted/40 p-1 border border-border rounded-xl overflow-x-auto no-scrollbar flex-nowrap">
            {(
              [
                { id: 'all', label: 'All Difficulties' },
                { id: 'Easy', label: 'Easy' },
                { id: 'Medium', label: 'Medium' },
                { id: 'Hard', label: 'Hard' },
              ] as const
            ).map((d) => {
              const active = difficultyFilter === d.id;
              return (
                <button
                  key={d.id}
                  onClick={() => setDifficultyFilter(d.id)}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm border border-primary'
                      : 'border border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Questions List */}
      <div id="tour-company-table" className="border border-border bg-card rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[560px] sm:min-w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs font-bold text-muted-foreground uppercase tracking-wider select-none">
                <th className="py-3 px-2 sm:px-4 w-12 sm:w-16 text-center">Status</th>
                <th className="hidden sm:table-cell py-3 px-3 sm:px-4 w-16 sm:w-20">ID</th>
                <th className="py-3 px-3 sm:px-6">Problem Title</th>
                <th className="py-3 px-2 sm:px-4 w-24 sm:w-28 text-center sm:text-left">Difficulty</th>
                <th className="py-3 px-2 sm:px-4 w-24 sm:w-32">Frequency</th>
                <th className="py-3 px-2 sm:px-4 w-14 sm:w-20 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {paginatedProblems.length > 0 ? (
                paginatedProblems.map((prob) => (
                  <tr
                    key={prob.id}
                    className={`hover:bg-muted/30 transition-colors group ${
                      prob.solved ? 'opacity-80 bg-zinc-50/10 dark:bg-zinc-950/10' : ''
                    }`}
                  >
                    {/* Status column */}
                    <td className="py-3 px-2 sm:px-4 text-center">
                      <button
                        onClick={() => toggleSolvedMutation.mutate({ id: prob.id, solved: !prob.solved })}
                        disabled={toggleSolvedMutation.isPending && (toggleSolvedMutation.variables as any)?.id === prob.id}
                        className="p-1.5 rounded-lg hover:bg-muted/80 transition-all cursor-pointer inline-flex items-center justify-center group/status focus:outline-none"
                        title={
                          toggleSolvedMutation.isPending && (toggleSolvedMutation.variables as any)?.id === prob.id
                            ? "Verifying with LeetCode..."
                            : prob.solved
                            ? "Solved — Click to mark as unsolved"
                            : "Click to verify & mark as solved"
                        }
                      >
                        {toggleSolvedMutation.isPending && (toggleSolvedMutation.variables as any)?.id === prob.id ? (
                          <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                        ) : prob.solved ? (
                          <CheckCircle className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-500 group-hover/status:scale-110 transition-transform" />
                        ) : (
                          <Circle className="h-4.5 w-4.5 text-muted-foreground/40 group-hover/status:text-emerald-600 dark:group-hover/status:text-emerald-500 group-hover/status:scale-110 transition-all" />
                        )}
                      </button>
                    </td>

                    {/* ID column - hidden on mobile */}
                    <td className="hidden sm:table-cell py-3 px-3 sm:px-4 text-sm font-mono text-muted-foreground">
                      #{prob.id}
                    </td>

                    {/* Title column */}
                    <td className="py-3 px-3 sm:px-6">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedProblemId(prob.id)}
                          className="text-xs sm:text-sm font-semibold text-foreground hover:text-primary transition-colors text-left focus:outline-none cursor-pointer"
                        >
                          {prob.title}
                        </button>
                        {prob.bookmarked && (
                          <Star fill="currentColor" className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                        )}
                        {prob.notes && (
                          <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded border border-border shrink-0" title="Has Notes">
                            Notes
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Difficulty Badge column */}
                    <td className="py-3 px-2 sm:px-4 text-center sm:text-left">
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider inline-block ${getDifficultyColor(prob.difficulty)}`}>
                        {prob.difficulty}
                      </span>
                    </td>

                    {/* Frequency Column */}
                    <td className="py-3 px-2 sm:px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-10 sm:w-12 bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden shrink-0">
                          <div
                            className="bg-primary h-full rounded-full"
                            style={{ width: `${prob.frequency}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono font-bold text-muted-foreground">
                          {formatPercent(prob.frequency)}
                        </span>
                      </div>
                    </td>

                    {/* Open Button Column - visible on touch/mobile without hover */}
                    <td className="py-3 px-2 sm:px-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <a
                          href={prob.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 border border-border rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition-all cursor-pointer inline-flex items-center justify-center"
                          title="Open LeetCode URL"
                        >
                          <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 px-6 text-center text-muted-foreground text-sm">
                    No questions found matching your filters. Try checking other categories or clear the search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalFiltered > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-muted/20 border-t border-border select-none">
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <span>
                Showing{' '}
                <span className="font-bold text-foreground">
                  {pageSize === 'all' ? 1 : Math.min(totalFiltered, (page - 1) * (pageSize as number) + 1)}
                </span>
                {' '}–{' '}
                <span className="font-bold text-foreground">
                  {pageSize === 'all' ? totalFiltered : Math.min(totalFiltered, page * (pageSize as number))}
                </span>
                {' '}of <span className="font-bold text-foreground">{totalFiltered}</span> questions
              </span>

              {/* Page Size Selector */}
              <div className="hidden sm:flex items-center gap-1.5 ml-2 pl-3 border-l border-border">
                <span className="text-[11px]">Show:</span>
                {([50, 100, 200, 'all'] as const).map((sz) => (
                  <button
                    key={sz}
                    onClick={() => {
                      setPageSize(sz);
                      setPage(1);
                    }}
                    className={`px-2 py-0.5 text-[11px] rounded-md font-bold transition-all cursor-pointer ${
                      pageSize === sz
                        ? 'bg-primary text-primary-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    {sz === 'all' ? 'All' : sz}
                  </button>
                ))}
              </div>
            </div>

            {/* Prev / Next Controls */}
            {pageSize !== 'all' && totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => {
                    setPage((p) => Math.max(1, p - 1));
                    const tableElem = document.getElementById('tour-company-table');
                    if (tableElem) tableElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="px-3 py-1.5 text-xs font-bold border border-border rounded-xl bg-card text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  Previous
                </button>

                <span className="text-xs font-semibold text-muted-foreground px-1">
                  Page <span className="font-bold text-foreground">{page}</span> of {totalPages}
                </span>

                <button
                  disabled={page >= totalPages}
                  onClick={() => {
                    setPage((p) => Math.min(totalPages, p + 1));
                    const tableElem = document.getElementById('tour-company-table');
                    if (tableElem) tableElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="px-3 py-1.5 text-xs font-bold border border-border rounded-xl bg-card text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
