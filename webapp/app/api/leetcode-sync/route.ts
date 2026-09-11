import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/auth-helper';

// Helper to extract clean LEETCODE_SESSION cookie token
function extractSessionCookie(rawInput: string): string {
  if (!rawInput) return '';
  let val = rawInput.trim();

  // If user pasted a full Cookie header string like "csrftoken=...; LEETCODE_SESSION=xyz; other=..."
  if (val.includes('LEETCODE_SESSION=')) {
    const match = val.match(/LEETCODE_SESSION=([^;,\s]+)/);
    if (match) {
      val = match[1].trim();
    }
  }

  // If user pasted something with semicolons
  if (val.includes(';')) {
    val = val.split(';')[0].trim();
  }

  // Strip leading LEETCODE_SESSION= if still present
  val = val.replace(/^LEETCODE_SESSION=/, '').trim();

  // Strip surrounding quotes
  val = val.replace(/^["']|["']$/g, '').trim();

  return val;
}

// Helper to clean username (removes URL prefixes, trailing slashes, etc.)
function cleanUsername(rawUsername: string): string {
  let u = (rawUsername || '').trim();
  if (u.includes('leetcode.com')) {
    const match = u.match(/leetcode\.com\/(?:u\/)?([^/\s?#]+)/);
    if (match) {
      u = match[1];
    }
  }
  return u.replace(/^@/, '').replace(/\/$/, '').trim();
}

// Helper to fetch exact solved question slugs using the session cookie
async function fetchExactSolvedProblems(cookie: string): Promise<{ slugs: string[]; username: string }> {
  const cleanCookie = extractSessionCookie(cookie);
  if (!cleanCookie) {
    throw new Error('LEETCODE_SESSION cookie value is empty or could not be parsed.');
  }

  const res = await fetch('https://leetcode.com/api/problems/all/', {
    method: 'GET',
    headers: {
      'Cookie': `LEETCODE_SESSION=${cleanCookie}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`LeetCode authenticated API returned status ${res.status}`);
  }

  const data = await res.json();
  if (!data.user_name) {
    throw new Error('LeetCode session cookie has expired or is invalid (user_name is empty).');
  }

  const pairs = data.stat_status_pairs || [];
  const slugs = pairs
    .filter((p: any) => p.status === 'ac')
    .map((p: any) => p.stat.question__title_slug)
    .filter(Boolean);

  return { slugs, username: data.user_name };
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

// High-performance batch upsert in chunks to avoid Prisma transaction timeouts
async function batchUpsertProgress(
  userId: string,
  problems: Array<{ id: number; titleSlug: string }>,
  submissionMap: Map<string, Date>,
  fallbackDate: Date
) {
  const chunkSize = 150;
  for (let i = 0; i < problems.length; i += chunkSize) {
    const chunk = problems.slice(i, i + chunkSize);
    const valuePlaceholders: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    for (const p of chunk) {
      const solvedDate = submissionMap.get(p.titleSlug) || fallbackDate;
      valuePlaceholders.push(
        `($${paramIdx++}, $${paramIdx++}, TRUE, $${paramIdx++}, '', FALSE, NOW(), NOW())`
      );
      params.push(userId, p.id, solvedDate);
    }

    const sql = `
      INSERT INTO "UserProblemProgress" ("userId", "problemId", "solved", "solvedAt", "notes", "bookmarked", "createdAt", "updatedAt")
      VALUES ${valuePlaceholders.join(', ')}
      ON CONFLICT ("userId", "problemId")
      DO UPDATE SET "solved" = TRUE, "solvedAt" = EXCLUDED."solvedAt", "updatedAt" = NOW()
    `;

    await prisma.$executeRawUnsafe(sql, ...params);
  }
}

export async function POST(request: Request) {
  try {
    const { username: rawUsername, action, isSimulation, leetcodeSession } = await request.json();

    const username = cleanUsername(rawUsername);

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json(
        { error: 'Sign in with Google to enable automatic LeetCode sync.', isGuest: true },
        { status: 401 }
      );
    }

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
      await prisma.userProblemProgress.updateMany({
        where: { userId, solved: true },
        data: { solved: false, solvedAt: null },
      });
      await prisma.activityLog.deleteMany({
        where: { userId },
      });

      let solvedSlugs: Set<string> = new Set();
      let latestTimestamp = 0;
      let isDemoMode = !!isSimulation;
      let cookieValid = false;
      let cookieWarning = '';
      const recentSubmissionMap = new Map<string, Date>();

      // Clean and determine session cookie to use
      const cleanRawCookie = leetcodeSession !== undefined ? extractSessionCookie(leetcodeSession) : undefined;
      const activeCookie = cleanRawCookie !== undefined
        ? cleanRawCookie
        : (config.leetcodeUser.toLowerCase() === username.toLowerCase() ? config.leetcodeSession : '');

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
            const { slugs: exactSlugs, username: authedUser } = await fetchExactSolvedProblems(activeCookie.trim());
            exactSlugs.forEach(slug => solvedSlugs.add(slug));
            cookieValid = true;
            console.log(`Found exactly ${exactSlugs.length} solved question slugs using session cookie for user ${authedUser}.`);
          } catch (cookieError: any) {
            cookieWarning = cookieError.message;
            console.warn('Authenticated cookie fetch failed, falling back to public stats sync:', cookieError.message);
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

      const fallbackSolvedDate = latestTimestamp > 0 ? new Date(latestTimestamp * 1000) : new Date();

      // High-performance batch upsert
      if (matchedProblems.length > 0) {
        await batchUpsertProgress(userId, matchedProblems, recentSubmissionMap, fallbackSolvedDate);

        // Record recent activity logs (cap at 100 to prevent bloating)
        const activities = matchedProblems.slice(0, 100).map(p => {
          const solvedDate = recentSubmissionMap.get(p.titleSlug) || fallbackSolvedDate;
          return {
            userId,
            problemId: p.id,
            action: 'SOLVED',
            timestamp: solvedDate,
          };
        });
        await prisma.activityLog.createMany({
          data: activities,
        });

        // Update streak
        const lastSolvedDateStr = latestTimestamp > 0
          ? new Date(latestTimestamp * 1000).toLocaleDateString('sv-SE')
          : new Date().toLocaleDateString('sv-SE');

        await prisma.userStats.upsert({
          where: { userId },
          create: { userId, streak: 1, lastSolvedDate: lastSolvedDateStr },
          update: { streak: 1, lastSolvedDate: lastSolvedDateStr },
        });
      }

      // Update sync config in DB
      const storedCookie = cookieValid ? activeCookie : (config.leetcodeSession || '');

      await prisma.userSyncConfig.upsert({
        where: { userId },
        create: {
          userId,
          leetcodeUser: username,
          leetcodeSession: storedCookie,
          lastSyncedAt: new Date(),
          lastSubmissionTimestamp: latestTimestamp,
          isDemoMode,
        },
        update: {
          leetcodeUser: username,
          leetcodeSession: storedCookie,
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
        cookieWarning: cookieWarning || undefined,
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
          syncedCount: 0,
          message: 'Simulation demo mode active. No live polling.',
        });
      }

      const recentSubs = cachedRecentSubs.length > 0 
        ? cachedRecentSubs 
        : await fetchRecentSubmissions(username, 50);

      const newSubs: LeetCodeSubmission[] = [];
      let latestTimestamp = config.lastSubmissionTimestamp;

      for (const sub of recentSubs) {
        const ts = parseInt(sub.timestamp);
        if (ts > config.lastSubmissionTimestamp) {
          newSubs.push(sub);
          if (ts > latestTimestamp) {
            latestTimestamp = ts;
          }
        }
      }

      if (newSubs.length === 0) {
        await prisma.userSyncConfig.update({
          where: { userId },
          data: { lastSyncedAt: new Date() },
        });

        return NextResponse.json({
          success: true,
          action: 'incremental',
          syncedCount: 0,
          message: 'Already up to date. No new accepted submissions found.',
        });
      }

      const newSlugs = newSubs.map(s => s.titleSlug);
      
      const matchedNewProblems = await prisma.problem.findMany({
        where: {
          titleSlug: { in: newSlugs },
        },
        select: { id: true, titleSlug: true },
      });

      const submissionDateMap = new Map<string, Date>();
      for (const sub of newSubs) {
        submissionDateMap.set(sub.titleSlug, new Date(parseInt(sub.timestamp) * 1000));
      }

      if (matchedNewProblems.length > 0) {
        await batchUpsertProgress(userId, matchedNewProblems, submissionDateMap, new Date());

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
        await prisma.activityLog.createMany({
          data: activities,
        });

        // Update Streak
        const stats = await prisma.userStats.findUnique({ where: { userId } });
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

          await prisma.userStats.upsert({
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
