import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/auth-helper';

export async function GET() {
  try {
    const todayStr = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD
    const startOfToday = new Date(todayStr + 'T00:00:00');
    const userId = await getCurrentUserId();

    // Catalog queries run for all visitors
    const [totalProblems, easyTotal, mediumTotal, hardTotal, totalCompanies] = await Promise.all([
      prisma.problem.count(),
      prisma.problem.count({ where: { difficulty: 'Easy' } }),
      prisma.problem.count({ where: { difficulty: 'Medium' } }),
      prisma.problem.count({ where: { difficulty: 'Hard' } }),
      prisma.company.count(),
    ]);

    if (!userId) {
      const overall = {
        totalProblems,
        solvedProblems: 0,
        remainingProblems: totalProblems,
        completionPercentage: 0,
      };
      const difficulties = {
        easy: { solved: 0, total: easyTotal },
        medium: { solved: 0, total: mediumTotal },
        hard: { solved: 0, total: hardTotal },
      };
      const companies = {
        total: totalCompanies,
        completed: 0,
        started: 0,
      };
      const syncConfigData = {
        leetcodeUser: '',
        lastSyncedAt: null,
        isDemoMode: false,
        hasSessionCookie: false,
      };

      // Guest Mode Stats Response (cached at Edge CDN for 5 minutes)
      return NextResponse.json({
        overall,
        difficulties,
        companies,
        streak: 0,
        todaySolvedCount: 0,
        recentActivity: [],
        bookmarkedProblems: [],
        bookmarkedCount: 0,
        syncConfig: syncConfigData,
        // Flat aliases for backwards compatibility
        totalProblems,
        solvedProblems: 0,
        remainingProblems: totalProblems,
        completionPercentage: 0,
        difficultyBreakdown: difficulties,
        companyStats: companies,
        syncStatus: syncConfigData,
        isGuest: true,
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      });
    }

    // Authenticated User Queries
    const [
      solvedProblems,
      easySolved,
      mediumSolved,
      hardSolved,
      todaySolvedCount,
      recentActivityProblems,
      userStats,
      bookmarkedProgressList,
      syncConfig,
      companyStatsRaw,
    ] = await Promise.all([
      prisma.userProblemProgress.count({ where: { userId, solved: true } }),
      prisma.userProblemProgress.count({
        where: { userId, solved: true, problem: { difficulty: 'Easy' } },
      }),
      prisma.userProblemProgress.count({
        where: { userId, solved: true, problem: { difficulty: 'Medium' } },
      }),
      prisma.userProblemProgress.count({
        where: { userId, solved: true, problem: { difficulty: 'Hard' } },
      }),
      prisma.userProblemProgress.count({
        where: {
          userId,
          solved: true,
          solvedAt: { gte: startOfToday },
        },
      }),
      prisma.userProblemProgress.findMany({
        where: { userId, solved: true, solvedAt: { not: null } },
        orderBy: [{ solvedAt: 'desc' }, { id: 'desc' }],
        take: 20,
        select: {
          problem: {
            select: { id: true, title: true, difficulty: true },
          },
          solvedAt: true,
        },
      }),
      prisma.userStats.findUnique({ where: { userId } }),
      prisma.userProblemProgress.findMany({
        where: { userId, bookmarked: true },
        orderBy: { updatedAt: 'desc' },
        select: {
          problem: {
            select: { id: true, title: true, difficulty: true, url: true },
          },
          solved: true,
          updatedAt: true,
        },
      }),
      prisma.userSyncConfig.findUnique({ where: { userId } }),
      prisma.$queryRawUnsafe<Array<{ completedCompanies: bigint; startedCompanies: bigint }>>(`
        SELECT 
          COUNT(CASE WHEN total_cnt > 0 AND solved_cnt = total_cnt THEN 1 END) as "completedCompanies",
          COUNT(CASE WHEN solved_cnt > 0 AND solved_cnt < total_cnt THEN 1 END) as "startedCompanies"
        FROM (
          SELECT cp."companyId",
                 COUNT(cp."problemId") as total_cnt,
                 SUM(CASE WHEN upp.solved = TRUE THEN 1 ELSE 0 END) as solved_cnt
          FROM "CompanyProblem" cp
          LEFT JOIN "UserProblemProgress" upp ON cp."problemId" = upp."problemId" AND upp."userId" = $1
          GROUP BY cp."companyId"
        ) sub
      `, userId),
    ]);

    const remainingProblems = totalProblems - solvedProblems;
    const completionPercentage = totalProblems > 0 ? (solvedProblems / totalProblems) * 100 : 0;

    const completedCompanies = Number(companyStatsRaw[0]?.completedCompanies || 0);
    const startedCompanies = Number(companyStatsRaw[0]?.startedCompanies || 0);

    const recentActivity = recentActivityProblems.map((p) => ({
      id: p.problem.id,
      problemId: p.problem.id,
      problemTitle: p.problem.title,
      difficulty: p.problem.difficulty,
      timestamp: p.solvedAt,
    }));

    const streak = userStats?.streak || 0;

    const bookmarkedProblems = bookmarkedProgressList.map((p) => ({
      id: p.problem.id,
      title: p.problem.title,
      difficulty: p.problem.difficulty,
      solved: p.solved,
      url: p.problem.url,
      updatedAt: p.updatedAt.toISOString(),
    }));

    const overall = {
      totalProblems,
      solvedProblems,
      remainingProblems,
      completionPercentage,
    };
    const difficulties = {
      easy: { solved: easySolved, total: easyTotal },
      medium: { solved: mediumSolved, total: mediumTotal },
      hard: { solved: hardSolved, total: hardTotal },
    };
    const companies = {
      total: totalCompanies,
      completed: completedCompanies,
      started: startedCompanies,
    };
    const syncConfigData = {
      leetcodeUser: syncConfig?.leetcodeUser || '',
      lastSyncedAt: syncConfig?.lastSyncedAt || null,
      isDemoMode: !!syncConfig?.isDemoMode,
      hasSessionCookie: !!syncConfig?.leetcodeSession,
    };

    return NextResponse.json({
      overall,
      difficulties,
      companies,
      streak,
      todaySolvedCount,
      recentActivity,
      bookmarkedProblems,
      bookmarkedCount: bookmarkedProblems.length,
      syncConfig: syncConfigData,
      // Flat aliases for backwards compatibility
      totalProblems,
      solvedProblems,
      remainingProblems,
      completionPercentage,
      difficultyBreakdown: difficulties,
      companyStats: companies,
      syncStatus: syncConfigData,
      isGuest: false,
    }, {
      headers: {
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('Error fetching statistics:', error);
    const details = process.env.NODE_ENV === 'development' ? error.message : undefined;
    return NextResponse.json({ error: 'Internal Server Error', ...(details ? { details } : {}) }, { status: 500 });
  }
}
