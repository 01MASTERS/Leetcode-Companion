import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/auth-helper';

// Helper to fetch exact solved question slugs using the session cookie
async function fetchExactSolvedProblems(cookie: string): Promise<string[]> {
  const res = await fetch('https://leetcode.com/api/problems/all/', {
    method: 'GET',
    headers: {
      'Cookie': `LEETCODE_SESSION=${cookie}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  if (!res.ok) {
    throw new Error(`LeetCode authenticated API returned status ${res.status}`);
  }

  const data = await res.json();
  if (!data.user_name) {
    throw new Error('LeetCode session cookie has expired or is invalid (user_name is empty)');
  }

  const pairs = data.stat_status_pairs || [];
  
  return pairs
    .filter((p: any) => p.status === 'ac')
    .map((p: any) => p.stat.question__title_slug)
    .filter(Boolean);
}

// Helper to fetch user solved counts by difficulty
async function fetchLeetCodeStats(username: string) {
  const query = `
    query userProblemsSolved($username: String!) {
      matchedUser(username: $username) {
        submitStatsGlobal {
          acSubmissionNum {
            difficulty
            count
          }
        }
      }
    }
  `;

  const res = await fetch('https://leetcode.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    body: JSON.stringify({ query, variables: { username } }),
  });

  if (!res.ok) {
    throw new Error(`LeetCode Stats API returned status ${res.status}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors[0]?.message || 'GraphQL Error fetching stats');
  }

  const stats = json.data?.matchedUser?.submitStatsGlobal?.acSubmissionNum || [];
  
  let easy = 0;
  let medium = 0;
  let hard = 0;

  for (const item of stats) {
    if (item.difficulty === 'Easy') easy = item.count;
    if (item.difficulty === 'Medium') medium = item.count;
    if (item.difficulty === 'Hard') hard = item.count;
  }

  return { easy, medium, hard };
}

// Helper to fetch recent accepted submissions
interface LeetCodeSubmission {
  title: string;
  titleSlug: string;
  timestamp: string;
}

async function fetchRecentSubmissions(username: string, limit = 50): Promise<LeetCodeSubmission[]> {
  const query = `
    query recentAcSubmissions($username: String!, $limit: Int!) {
      recentAcSubmissionList(username: $username, limit: $limit) {
        title
        titleSlug
        timestamp
      }
    }
  `;

  const res = await fetch('https://leetcode.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
    body: JSON.stringify({ query, variables: { username, limit } }),
  });

  if (!res.ok) {
    throw new Error(`LeetCode Submissions API returned status ${res.status}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors[0]?.message || 'GraphQL Error fetching submissions');
  }

  return json.data?.recentAcSubmissionList || [];
}

export async function POST(request: Request) {
  try {
    const { username, action, isSimulation, leetcodeSession } = await request.json();

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const userId = await getCurrentUserId();

    // Get or create current sync configuration for user
    let config = await prisma.userSyncConfig.findUnique({ where: { userId } });
    if (!config) {
      config = await prisma.userSyncConfig.create({
        data: { userId, leetcodeUser: '', leetcodeSession: '', lastSubmissionTimestamp: 0, isDemoMode: false },
      });
    }

    let targetAction = action || 'full';
    let cachedRecentSubs: LeetCodeSubmission[] = [];

    // Recovery Detection: Check if we need to upgrade to full sync
    if (targetAction === 'incremental') {
      const now = new Date();
      const lastSync = config.lastSyncedAt ? new Date(config.lastSyncedAt) : null;
      
      // 1. Recovery Check: If never synced, or last synced > 7 days ago
      if (!lastSync || (now.getTime() - lastSync.getTime()) > 7 * 24 * 60 * 60 * 1000) {
        console.log('Recovery Triggered: Last sync was more than a week ago. Performing Full Sync.');
        targetAction = 'full';
      } else {
        // 2. Recovery Check: Fetch recent submissions and check for gaps
        try {
          cachedRecentSubs = await fetchRecentSubmissions(username, 50);
          if (cachedRecentSubs.length > 0) {
            const lowestFetchedTimestamp = parseInt(cachedRecentSubs[cachedRecentSubs.length - 1].timestamp);
            if (config.lastSubmissionTimestamp > 0 && lowestFetchedTimestamp > config.lastSubmissionTimestamp) {
              console.log('Recovery Triggered: Recent submissions window exceeded. Performing Full Sync.');
              targetAction = 'full';
            }
          }
        } catch (e: any) {
          console.warn('Failed to fetch recent submissions for recovery check, falling back to incremental', e.message);
        }
      }
    }

    // ==========================================
    // ACTION 1: FULL SYNC
    // ==========================================
    if (targetAction === 'full') {
      console.log(`Starting Full Sync for user: ${username}`);

      // Clear existing solved states for THIS user to start a fresh sync
      await prisma.$transaction([
        prisma.userProblemProgress.updateMany({
          where: { userId, solved: true },
          data: { solved: false, solvedAt: null },
        }),
        prisma.activityLog.deleteMany({
          where: { userId },
        }),
      ]);

      let solvedSlugs: Set<string> = new Set();
      let latestTimestamp = 0;
      let isDemoMode = !!isSimulation;
      let cookieValid = false;
      const recentSubmissionMap = new Map<string, Date>();

      // Determine session cookie to use
      const activeCookie = leetcodeSession !== undefined 
        ? leetcodeSession 
        : (config.leetcodeUser === username ? config.leetcodeSession : '');

      if (isDemoMode || username.toLowerCase() === 'demo' || username.toLowerCase() === 'simulation') {
        isDemoMode = true;
        console.log('Seeding simulated solved questions for demo...');
        const popularProblems = await prisma.problem.findMany({
          take: 120,
          orderBy: { id: 'asc' },
        });
        
        solvedSlugs = new Set(popularProblems.map(p => p.titleSlug));
        latestTimestamp = Math.floor(Date.now() / 1000);
      } else {
        // Fetch recent accepted submissions to get real solve timestamps
        try {
          const recentSubs = cachedRecentSubs.length > 0 
            ? cachedRecentSubs 
            : await fetchRecentSubmissions(username, 50);

          for (const sub of recentSubs) {
            const ts = parseInt(sub.timestamp);
            if (ts > latestTimestamp) {
              latestTimestamp = ts;
            }
            if (!recentSubmissionMap.has(sub.titleSlug)) {
              recentSubmissionMap.set(sub.titleSlug, new Date(ts * 1000));
            }
            solvedSlugs.add(sub.titleSlug);
          }
          console.log(`Fetched ${recentSubs.length} recent accepted submissions (${recentSubmissionMap.size} unique solved slugs).`);
        } catch (subErr: any) {
          console.warn('Could not fetch recent submissions for timestamps:', subErr.message);
        }

        // 1. Precise Sync via LeetCode Session Cookie
        if (activeCookie && activeCookie.trim()) {
          console.log(`Performing Authenticated Cookie Sync...`);
          try {
            const exactSlugs = await fetchExactSolvedProblems(activeCookie.trim());
            exactSlugs.forEach(slug => solvedSlugs.add(slug));
            cookieValid = true;
            console.log(`Found exactly ${solvedSlugs.size} solved question slugs using session cookie.`);
          } catch (cookieError: any) {
            console.error('Authenticated cookie fetch failed, falling back to public stats sync:', cookieError.message);
          }
        }

        // 2. Fallback to public counts sync if cookie was not provided or failed
        if (!cookieValid) {
          console.log('Performing Public Stats Sync (Counts-Filler mode)...');
          try {
            const { easy, medium, hard } = await fetchLeetCodeStats(username);
            console.log(`User stats on LeetCode: Easy: ${easy}, Medium: ${medium}, Hard: ${hard}`);

            // Count how many we already have from recent submissions
            let currentEasy = 0;
            let currentMedium = 0;
            let currentHard = 0;

            if (solvedSlugs.size > 0) {
              const currentProblems = await prisma.problem.findMany({
                where: { titleSlug: { in: Array.from(solvedSlugs) } },
                select: { difficulty: true },
              });
              for (const p of currentProblems) {
                if (p.difficulty === 'Easy') currentEasy++;
                if (p.difficulty === 'Medium') currentMedium++;
                if (p.difficulty === 'Hard') currentHard++;
              }
            }

            const neededEasy = Math.max(0, easy - currentEasy);
            const neededMedium = Math.max(0, medium - currentMedium);
            const neededHard = Math.max(0, hard - currentHard);

            console.log(`Needed filler problems: Easy: ${neededEasy}, Medium: ${neededMedium}, Hard: ${neededHard}`);

            const fetchFillerSlugs = async (diff: string, count: number) => {
              if (count <= 0) return [];
              const rawProblems = await prisma.problem.findMany({
                where: {
                  difficulty: diff,
                  titleSlug: { notIn: Array.from(solvedSlugs) },
                },
                orderBy: { id: 'asc' },
                take: count,
                select: { titleSlug: true },
              });
              return rawProblems.map(p => p.titleSlug);
            };

            const [fillEasy, fillMed, fillHard] = await Promise.all([
              fetchFillerSlugs('Easy', neededEasy),
              fetchFillerSlugs('Medium', neededMedium),
              fetchFillerSlugs('Hard', neededHard),
            ]);

            [...fillEasy, ...fillMed, ...fillHard].forEach(slug => solvedSlugs.add(slug));
            console.log(`Total filled solved problems set: ${solvedSlugs.size}`);
          } catch (statsErr: any) {
            console.warn('Could not fetch public solved stats:', statsErr.message);
          }
        }
      }

      // Find matched problems in our database
      const matchedProblems = await prisma.problem.findMany({
        where: { titleSlug: { in: Array.from(solvedSlugs) } },
        select: { id: true, titleSlug: true },
      });

      console.log(`Matched ${matchedProblems.length} solved problems with database catalog.`);

      // Update user progress in a transaction
      if (matchedProblems.length > 0) {
        await prisma.$transaction(async (tx) => {
          for (const p of matchedProblems) {
            const solvedAt = recentSubmissionMap.get(p.titleSlug) || (latestTimestamp > 0 ? new Date(latestTimestamp * 1000) : new Date());
            await tx.userProblemProgress.upsert({
              where: { userId_problemId: { userId, problemId: p.id } },
              create: {
                userId,
                problemId: p.id,
                solved: true,
                solvedAt,
                notes: '',
                bookmarked: false,
              },
              update: {
                solved: true,
                solvedAt,
              },
            });
          }

          // Create activity logs
          const activities = matchedProblems.map(p => {
            const solvedDate = recentSubmissionMap.get(p.titleSlug);
            return {
              userId,
              problemId: p.id,
              action: 'SOLVED',
              timestamp: solvedDate || new Date(),
            };
          });
          await tx.activityLog.createMany({
            data: activities,
          });

          // Reset streak
          const lastSolvedDateStr = latestTimestamp > 0
            ? new Date(latestTimestamp * 1000).toLocaleDateString('sv-SE')
            : new Date().toLocaleDateString('sv-SE');

          await tx.userStats.upsert({
            where: { userId },
            create: { userId, streak: 1, lastSolvedDate: lastSolvedDateStr },
            update: { streak: 1, lastSolvedDate: lastSolvedDateStr },
          });
        });
      }

      // Update sync config in DB
      await prisma.userSyncConfig.upsert({
        where: { userId },
        create: {
          userId,
          leetcodeUser: username,
          leetcodeSession: cookieValid ? (activeCookie || '') : '',
          lastSyncedAt: new Date(),
          lastSubmissionTimestamp: latestTimestamp,
          isDemoMode,
        },
        update: {
          leetcodeUser: username,
          leetcodeSession: cookieValid ? (activeCookie || '') : '',
          lastSyncedAt: new Date(),
          lastSubmissionTimestamp: latestTimestamp,
          isDemoMode,
        },
      });

      return NextResponse.json({
        success: true,
        action: 'full',
        syncedCount: matchedProblems.length,
        isDemoMode,
        hasSessionCookie: cookieValid,
        lastSubmissionTimestamp: latestTimestamp,
      });
    }

    // ==========================================
    // ACTION 2: INCREMENTAL SYNC
    // ==========================================
    if (targetAction === 'incremental') {
      console.log(`Starting Incremental Sync for user: ${username}`);
      
      if (config.isDemoMode) {
        return NextResponse.json({
          success: true,
          action: 'incremental',
          message: 'Currently running in Demo Mode. Incremental sync skipped.',
          syncedCount: 0,
        });
      }

      let recentSubs: LeetCodeSubmission[] = cachedRecentSubs;
      if (recentSubs.length === 0) {
        try {
          recentSubs = await fetchRecentSubmissions(username, 20);
        } catch (e: any) {
          console.error('Failed to fetch recent submissions for incremental sync:', e.message);
          return NextResponse.json({ error: 'Failed to query LeetCode GraphQL' }, { status: 502 });
        }
      }

      const newSubs = recentSubs.filter(sub => parseInt(sub.timestamp) > config.lastSubmissionTimestamp);
      console.log(`Found ${newSubs.length} new submissions since last sync (last timestamp: ${config.lastSubmissionTimestamp}).`);

      if (newSubs.length === 0) {
        await prisma.userSyncConfig.update({
          where: { userId },
          data: { lastSyncedAt: new Date() },
        });

        return NextResponse.json({
          success: true,
          action: 'incremental',
          message: 'Already in sync. No new solved problems found.',
          syncedCount: 0,
        });
      }

      const newSlugs = newSubs.map(s => s.titleSlug);
      
      const matchedNewProblems = await prisma.problem.findMany({
        where: {
          titleSlug: { in: newSlugs },
        },
      });

      let latestTimestamp = config.lastSubmissionTimestamp;
      for (const sub of newSubs) {
        const ts = parseInt(sub.timestamp);
        if (ts > latestTimestamp) {
          latestTimestamp = ts;
        }
      }

      if (matchedNewProblems.length > 0) {
        await prisma.$transaction(async (tx) => {
          for (const problem of matchedNewProblems) {
            const sub = newSubs.find(s => s.titleSlug === problem.titleSlug);
            const solvedDate = sub ? new Date(parseInt(sub.timestamp) * 1000) : new Date();
            await tx.userProblemProgress.upsert({
              where: { userId_problemId: { userId, problemId: problem.id } },
              create: {
                userId,
                problemId: problem.id,
                solved: true,
                solvedAt: solvedDate,
                notes: '',
                bookmarked: false,
              },
              update: {
                solved: true,
                solvedAt: solvedDate,
              },
            });
          }

          const activities = matchedNewProblems.map(p => {
            const sub = newSubs.find(s => s.titleSlug === p.titleSlug);
            const solvedDate = sub ? new Date(parseInt(sub.timestamp) * 1000) : new Date();
            return {
              userId,
              problemId: p.id,
              action: 'SOLVED',
              timestamp: solvedDate,
            };
          });
          await tx.activityLog.createMany({
            data: activities,
          });

          // Update Streak
          const stats = await tx.userStats.findUnique({ where: { userId } });
          const todayStr = new Date().toLocaleDateString('sv-SE');
          if (stats) {
            let newStreak = stats.streak;
            const lastSolved = stats.lastSolvedDate;

            if (!lastSolved) {
              newStreak = 1;
            } else if (lastSolved !== todayStr) {
              const lastSolvedDateObj = new Date(lastSolved);
              const todayDateObj = new Date(todayStr);
              const diffTime = Math.abs(todayDateObj.getTime() - lastSolvedDateObj.getTime());
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              
              if (diffDays === 1) {
                newStreak += 1;
              } else {
                newStreak = 1;
              }
            }

            await tx.userStats.upsert({
              where: { userId },
              create: {
                userId,
                streak: newStreak,
                lastSolvedDate: todayStr,
              },
              update: {
                streak: newStreak,
                lastSolvedDate: todayStr,
              },
            });
          }
        });
      }

      await prisma.userSyncConfig.update({
        where: { userId },
        data: {
          lastSyncedAt: new Date(),
          lastSubmissionTimestamp: latestTimestamp,
        },
      });

      return NextResponse.json({
        success: true,
        action: 'incremental',
        syncedCount: matchedNewProblems.length,
        lastSubmissionTimestamp: latestTimestamp,
      });
    }

    return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 });
  } catch (error: any) {
    console.error('Error synchronizing with LeetCode:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
