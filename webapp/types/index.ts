export interface Company {
  id: number;
  name: string;
  slug: string;
  totalProblems: number;
  solvedProblems: number;
  completionPercentage: number;
  remainingProblems: number;
  firstUnsolved: {
    id: number;
    title: string;
    url: string;
    difficulty: string;
  } | null;
}

export interface Problem {
  id: number;
  title: string;
  url: string;
  difficulty: string;
  solved: boolean;
  isManual?: boolean;
  notes: string;
  bookmarked: boolean;
  frequency: number;
  categories: {
    thirtyDays: boolean;
    threeMonths: boolean;
    sixMonths: boolean;
    moreThanSixMonths: boolean;
    all: boolean;
  };
}

export interface BookmarkedProblem {
  id: number;
  title: string;
  difficulty: string;
  solved: boolean;
  url: string;
  updatedAt: string;
}

export interface Stats {
  overall: {
    totalProblems: number;
    solvedProblems: number;
    remainingProblems: number;
    completionPercentage: number;
  };
  difficulties: {
    easy: { solved: number; total: number };
    medium: { solved: number; total: number };
    hard: { solved: number; total: number };
  };
  companies: {
    total: number;
    completed: number;
    started: number;
  };
  todaySolvedCount: number;
  streak: number;
  recentActivity: Array<{
    id: number;
    problemId: number;
    problemTitle: string;
    difficulty: string;
    timestamp: string;
  }>;
  bookmarkedCount?: number;
  bookmarkedProblems?: BookmarkedProblem[];
  syncConfig: {
    leetcodeUser: string;
    lastSyncedAt: string | null;
    isDemoMode: boolean;
    hasSessionCookie: boolean;
  };
}

export interface CompanyDetail {
  id: number;
  name: string;
  slug: string;
  updatedAt?: string;
  stats: {
    totalProblems: number;
    solvedProblems: number;
    completionPercentage: number;
    remainingProblems: number;
  };
  firstUnsolved: Problem | null;
  problems: Problem[];
}

export interface SyncAuditItem {
  id: number;
  shortSha: string;
  commitUrl: string;
  syncedAt: string;
  summary: string | null;
}

export interface CatalogSyncStatus {
  latest: {
    id: number;
    commitSha: string;
    shortSha: string;
    commitUrl: string;
    syncedAt: string;
    totalCompanies: number;
    totalProblems: number;
    summary: string | null;
    updatedCompanySlugs: string[];
  } | null;
  history: SyncAuditItem[];
}

