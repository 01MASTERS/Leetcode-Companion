import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/auth-helper';

export async function GET() {
  try {
    const todayStr = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD
    const startOfToday = new Date(todayStr + 'T00:00:00');
    const userId = await getCurrentUserId();

    // Run all independent queries in parallel
    const [
      totalProblems,
      solvedProblems,
      easySolved,
      easyTotal,
      mediumSolved,
      mediumTotal,
      hardSolved,
      hardTotal,
      todaySolvedCount,
      recentActivityProblems,
      userStats,
      bookmarkedProgressList,
      syncConfig,
      companyStatsRaw,
    ] = await Promise.all([
      prisma.problem.count(),
      prisma.userProblemProgress.count({ where: { userId, solved: true } }),
      prisma.userProblemProgress.count({
        where: { userId, solved: true, problem: { difficulty: 'Easy' } },
      }),
      prisma.problem.count({ where: { difficulty: 'Easy' } }),
      prisma.userProblemProgress.count({
        where: { userId, solved: true, problem: { difficulty: 'Medium' } },
      }),
      prisma.problem.count({ where: { difficulty: 'Medium' } }),
      prisma.userProblemProgress.count({
        where: { userId, solved: true, problem: { difficulty: 'Hard' } },
      }),
      prisma.problem.count({ where: { difficulty: 'Hard' } }),
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
        take: 10,
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
      prisma.$queryRawUnsafe<Array<{ totalCompanies: bigint; completedCompanies: bigint; startedCompanies: bigint }>>(`
        SELECT 
          (SELECT COUNT(*) FROM "Company") as "totalCompanies",
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

    const totalCompanies = Number(companyStatsRaw[0]?.totalCompanies || 0);
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

    return NextResponse.json({
      totalProblems,
      solvedProblems,
      remainingProblems,
      completionPercentage,
      difficultyBreakdown: {
        easy: { solved: easySolved, total: easyTotal },
        medium: { solved: mediumSolved, total: mediumTotal },
        hard: { solved: hardSolved, total: hardTotal },
      },
      streak,
      todaySolvedCount,
      companyStats: {
        total: totalCompanies,
        completed: completedCompanies,
        started: startedCompanies,
        notStarted: totalCompanies - startedCompanies - completedCompanies,
      },
      recentActivity,
      bookmarkedProblems,
      syncStatus: {
        username: syncConfig?.leetcodeUser || '',
        lastSyncedAt: syncConfig?.lastSyncedAt || null,
        isDemoMode: !!syncConfig?.isDemoMode,
        hasSessionCookie: !!syncConfig?.leetcodeSession,
      },
    });
  } catch (error: any) {
    console.error('Error fetching statistics:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
