import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/auth-helper';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const isGuestParam = searchParams.get('guest') === '1';
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

    const solvedParam = searchParams.get('solved') || request.headers.get('x-guest-solved');
    const guestSolvedIds = !userId && solvedParam
      ? solvedParam.split(',').map(Number).filter(n => Number.isInteger(n) && n > 0)
      : [];

    const bookmarkedParam = searchParams.get('bookmarked') || request.headers.get('x-guest-bookmarked');
    const guestBookmarkedIds = !userId && bookmarkedParam
      ? bookmarkedParam.split(',').map(Number).filter(n => Number.isInteger(n) && n > 0)
      : [];

    if (!userId) {
      let guestSolvedProblems = guestSolvedIds.length;
      let guestEasySolved = 0;
      let guestMediumSolved = 0;
      let guestHardSolved = 0;
      let guestCompletedCompanies = 0;
      let guestStartedCompanies = 0;
      let guestRecentActivity: any[] = [];
      let guestBookmarkedProblems: any[] = [];

      if (guestSolvedIds.length > 0) {
        const guestIdList = guestSolvedIds.join(',');
        const difficultyCounts = await prisma.$queryRawUnsafe<{ difficulty: string; count: bigint }[]>(`
          SELECT difficulty, COUNT(id)::bigint as count
          FROM "Problem"
          WHERE id IN (${guestIdList})
          GROUP BY difficulty
        `);
        for (const dc of difficultyCounts) {
          if (dc.difficulty === 'Easy') guestEasySolved = Number(dc.count);
          if (dc.difficulty === 'Medium') guestMediumSolved = Number(dc.count);
          if (dc.difficulty === 'Hard') guestHardSolved = Number(dc.count);
        }

        const companyProgressCounts = await prisma.$queryRawUnsafe<{ solved_count: bigint; total_count: bigint }[]>(`
          WITH user_solved AS (
            SELECT cp."companyId", COUNT(cp."problemId")::bigint as solved_count
            FROM "CompanyProblem" cp
            WHERE cp."problemId" IN (${guestIdList})
            GROUP BY cp."companyId"
          ),
          company_totals AS (
            SELECT "companyId", COUNT("problemId")::bigint as total_count
            FROM "CompanyProblem"
            GROUP BY "companyId"
          )
          SELECT 
            us.solved_count,
            ct.total_count
          FROM user_solved us
          JOIN company_totals ct ON us."companyId" = ct."companyId"
        `);
        for (const cp of companyProgressCounts) {
          const s = Number(cp.solved_count);
          const t = Number(cp.total_count);
          if (s > 0) {
            guestStartedCompanies++;
            if (s >= t) {
              guestCompletedCompanies++;
            }
          }
        }

        const solvedProblemsRows = await prisma.problem.findMany({
          where: { id: { in: guestSolvedIds } },
          select: { id: true, title: true, difficulty: true },
        });
        const solvedMap = new Map(solvedProblemsRows.map(p => [p.id, p]));
        guestRecentActivity = guestSolvedIds
          .map(id => {
            const prob = solvedMap.get(id);
            if (!prob) return null;
            return {
              id: prob.id,
              problemId: prob.id,
              problemTitle: prob.title,
              difficulty: prob.difficulty,
              timestamp: new Date().toISOString(),
            };
          })
          .filter(Boolean);
      }

      if (guestBookmarkedIds.length > 0) {
        const bookmarkedProblemsRows = await prisma.problem.findMany({
          where: { id: { in: guestBookmarkedIds } },
          select: { id: true, title: true, difficulty: true, url: true },
        });
        guestBookmarkedProblems = bookmarkedProblemsRows.map(p => ({
          id: p.id,
          title: p.title,
          difficulty: p.difficulty,
          solved: guestSolvedIds.includes(p.id),
          url: p.url,
          updatedAt: new Date().toISOString(),
        }));
      }

      const overall = {
        totalProblems,
        solvedProblems: guestSolvedProblems,
        remainingProblems: Math.max(0, totalProblems - guestSolvedProblems),
        completionPercentage: totalProblems > 0 ? (guestSolvedProblems / totalProblems) * 100 : 0,
      };
      const difficulties = {
        easy: { solved: guestEasySolved, total: easyTotal },
        medium: { solved: guestMediumSolved, total: mediumTotal },
        hard: { solved: guestHardSolved, total: hardTotal },
      };
      const companies = {
        total: totalCompanies,
        completed: guestCompletedCompanies,
        started: guestStartedCompanies,
      };
      const syncConfigData = {
        leetcodeUser: '',
        lastSyncedAt: null,
        isDemoMode: false,
        hasSessionCookie: false,
      };

      // Guest Mode Stats Response (cached at Edge CDN for 5 minutes only if empty)
      const headers: Record<string, string> = {
        'Vary': 'Cookie',
      };
      if (isGuestParam && guestSolvedIds.length === 0 && guestBookmarkedIds.length === 0) {
        headers['Cache-Control'] = 'public, s-maxage=300, stale-while-revalidate=600';
      } else {
        headers['Cache-Control'] = 'private, no-cache, no-store, must-revalidate';
      }

      return NextResponse.json({
        overall,
        difficulties,
        companies,
        streak: 0,
        todaySolvedCount: 0,
        recentActivity: guestRecentActivity,
        bookmarkedProblems: guestBookmarkedProblems,
        bookmarkedCount: guestBookmarkedProblems.length,
        syncConfig: syncConfigData,
        // Flat aliases for backwards compatibility
        totalProblems,
        solvedProblems: guestSolvedProblems,
        remainingProblems: overall.remainingProblems,
        completionPercentage: overall.completionPercentage,
        difficultyBreakdown: difficulties,
        companyStats: companies,
        syncStatus: syncConfigData,
        isGuest: true,
      }, { headers });
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
