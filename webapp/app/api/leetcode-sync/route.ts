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

// Helper to calculate active streak from recent submission timestamps
function calculateStreak(timestamps: number[]): { streak: number; lastSolvedDate: string | null } {
  if (!timestamps || timestamps.length === 0) {
    return { streak: 0, lastSolvedDate: null };
  }

  // Deduplicate dates in YYYY-MM-DD format, sorted descending
  const uniqueDates = Array.from(
    new Set(timestamps.map((ts) => new Date(ts * 1000).toLocaleDateString('sv-SE')))
  ).sort((a, b) => b.localeCompare(a));

  if (uniqueDates.length === 0) {
    return { streak: 0, lastSolvedDate: null };
  }

  const latestDate = uniqueDates[0];
  const todayStr = new Date().toLocaleDateString('sv-SE');
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toLocaleDateString('sv-SE');

  // If latest solved date is neither today nor yesterday, streak is broken (0)
  if (latestDate !== todayStr && latestDate !== yesterdayStr) {
    return { streak: 0, lastSolvedDate: latestDate };
  }

  // Count consecutive days
  let streak = 1;
  let currentDate = new Date(latestDate);

  for (let i = 1; i < uniqueDates.length; i++) {
    const prevExpected = new Date(currentDate);
    prevExpected.setDate(prevExpected.getDate() - 1);
    const prevExpectedStr = prevExpected.toLocaleDateString('sv-SE');

    if (uniqueDates[i] === prevExpectedStr) {
      streak++;
      currentDate = prevExpected;
    } else {
      break;
    }
  }

  return { streak, lastSolvedDate: latestDate };
}

// High-performance batch upsert in chunks to avoid Prisma transaction timeouts
async function batchUpsertProgress(
  userId: string,
  problems: Array<{ id: number; titleSlug: string }>,
  submissionMap: Map<string, Date>
) {
  const chunkSize = 150;
  for (let i = 0; i < problems.length; i += chunkSize) {
    const chunk = problems.slice(i, i + chunkSize);
    const valuePlaceholders: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    for (const p of chunk) {
      // ONLY problems present in submissionMap receive a solvedAt timestamp.
      // Non-recent problems (from bulk cookie or counts filler) receive NULL,
      // ensuring we never assign fake timestamps to historical solves.
      const solvedDate = submissionMap.get(p.titleSlug) || null;
      valuePlaceholders.push(
        `($${paramIdx++}, $${paramIdx++}, TRUE, $${paramIdx++}::timestamp, '', FALSE, NOW(), NOW())`
      );
      params.push(userId, p.id, solvedDate);
    }

    const sql = `
      INSERT INTO "UserProblemProgress" ("userId", "problemId", "solved", "solvedAt", "notes", "bookmarked", "createdAt", "updatedAt")
      VALUES ${valuePlaceholders.join(', ')}
      ON CONFLICT ("userId", "problemId")
      DO UPDATE SET 
        "solved" = TRUE, 
        "solvedAt" = COALESCE(EXCLUDED."solvedAt", "UserProblemProgress"."solvedAt"), 
        "updatedAt" = NOW()
    `;

    await prisma.$executeRawUnsafe(sql, ...params);
  }
}

export async function POST(request: Request) {
  try {
    const { username: rawUsername, action, isSimulation, leetcodeSession } = await request.json();

    let username = cleanUsername(rawUsername);
    let targetAction = action || 'full';

    const userId = await getCurrentUserId();

    if (!userId) {
      return NextResponse.json(
        { error: 'Sign in with Google to enable automatic LeetCode sync.', isGuest: true },
        { status: 401 }
      );
    }

    // Action: Detect username from provided session cookie
    if (targetAction === 'detect-cookie') {
      const cleanCookie = leetcodeSession ? extractSessionCookie(leetcodeSession) : '';
      if (!cleanCookie) {
        return NextResponse.json({ error: 'Please provide a LEETCODE_SESSION cookie.' }, { status: 400 });
      }
      try {
        const { username: detectedUser } = await fetchExactSolvedProblems(cleanCookie);
        return NextResponse.json({ success: true, username: detectedUser });
      } catch (err: any) {
        return NextResponse.json(
          { error: err.message || 'Could not verify cookie or extract username.' },
          { status: 400 }
        );
      }
    }

    // Get or create current sync configuration for user
    let config = await prisma.userSyncConfig.findUnique({ where: { userId } });
    if (!config) {
      config = await prisma.userSyncConfig.create({
        data: { userId, leetcodeUser: '', leetcodeSession: '', lastSubmissionTimestamp: 0, isDemoMode: false },
      });
    }

    // If username is blank but session cookie is provided, auto-detect username from cookie
    if (!username) {
      const cleanRawCookie = leetcodeSession !== undefined ? extractSessionCookie(leetcodeSession) : undefined;
      const activeCookie = cleanRawCookie !== undefined
        ? cleanRawCookie
        : (config.leetcodeSession || '');

      if (activeCookie && activeCookie.trim()) {
        try {
          const { username: detectedUser } = await fetchExactSolvedProblems(activeCookie.trim());
          username = detectedUser;
        } catch (cookieErr: any) {
          return NextResponse.json(
            { error: `Could not auto-detect username from cookie: ${cookieErr.message}` },
            { status: 400 }
          );
        }
      } else {
        return NextResponse.json({ error: 'Username is required (or provide a valid session cookie)' }, { status: 400 });
      }
    }
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
      let fetchedRecentSubs: LeetCodeSubmission[] = [];
      const recentTimestamps: number[] = [];

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

        // Stagger the first 15 problems across past days so demo mode also has realistic recent solves
        const now = Date.now();
        for (let i = 0; i < Math.min(15, popularProblems.length); i++) {
          const fakeTs = Math.floor((now - i * 3600 * 1000 * 8) / 1000);
          recentSubmissionMap.set(popularProblems[i].titleSlug, new Date(fakeTs * 1000));
          recentTimestamps.push(fakeTs);
          fetchedRecentSubs.push({
            title: popularProblems[i].title,
            titleSlug: popularProblems[i].titleSlug,
            timestamp: `${fakeTs}`,
          });
        }
      } else {
        // Fetch recent accepted submissions to get real solve timestamps
        try {
          fetchedRecentSubs = cachedRecentSubs.length > 0 
            ? cachedRecentSubs 
            : await fetchRecentSubmissions(username, 50);

          for (const sub of fetchedRecentSubs) {
            const ts = parseInt(sub.timestamp, 10);
            if (isNaN(ts) || ts <= 0) continue;
            recentTimestamps.push(ts);
            if (ts > latestTimestamp) {
              latestTimestamp = ts;
            }
            // Preserve the newest submission timestamp if problem was solved multiple times
            if (!recentSubmissionMap.has(sub.titleSlug)) {
              recentSubmissionMap.set(sub.titleSlug, new Date(ts * 1000));
            }
            solvedSlugs.add(sub.titleSlug);
          }
          console.log(`Fetched ${fetchedRecentSubs.length} recent accepted submissions (${recentSubmissionMap.size} unique solved slugs).`);
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

      // Find all matched problems in our database catalog
      const matchedProblems = await prisma.problem.findMany({
        where: { titleSlug: { in: Array.from(solvedSlugs) } },
        select: { id: true, titleSlug: true, title: true, difficulty: true },
      });

      console.log(`Matched ${matchedProblems.length} solved problems with database catalog.`);

      // Identify problems that were recently solved on LeetCode AND exist in our catalog (preserving order from newest to oldest)
      const problemBySlug = new Map(matchedProblems.map(p => [p.titleSlug, p]));
      const matchedRecentProblems: Array<{
        id: number;
        title: string;
        titleSlug: string;
        difficulty: string;
        solvedAt: Date;
      }> = [];
      const seenRecentSlugs = new Set<string>();

      for (const sub of fetchedRecentSubs) {
        if (seenRecentSlugs.has(sub.titleSlug)) continue;
        const p = problemBySlug.get(sub.titleSlug);
        if (p) {
          seenRecentSlugs.add(sub.titleSlug);
          const solvedAt = recentSubmissionMap.get(sub.titleSlug);
          if (solvedAt) {
            matchedRecentProblems.push({
              id: p.id,
              title: p.title,
              titleSlug: p.titleSlug,
              difficulty: p.difficulty,
              solvedAt,
            });
          }
        }
      }

      console.log(`Matched ${matchedRecentProblems.length} recent solves with database catalog.`);

      // High-performance batch upsert
      if (matchedProblems.length > 0) {
        await batchUpsertProgress(userId, matchedProblems, recentSubmissionMap);

        // Record recent activity logs ONLY for genuinely matched recent problems with real solve timestamps!
        if (matchedRecentProblems.length > 0) {
          const activities = matchedRecentProblems.map(p => ({
            userId,
            problemId: p.id,
            action: 'SOLVED',
            timestamp: p.solvedAt,
          }));
          await prisma.activityLog.createMany({
            data: activities,
          });
        }

        // Calculate streak from real submission timestamps
        const { streak, lastSolvedDate } = calculateStreak(recentTimestamps);

        await prisma.userStats.upsert({
          where: { userId },
          create: { userId, streak, lastSolvedDate },
          update: { streak, lastSolvedDate },
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
        recentCount: matchedRecentProblems.length,
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
      const recentTimestamps: number[] = [];

      for (const sub of recentSubs) {
        const ts = parseInt(sub.timestamp, 10);
        if (isNaN(ts) || ts <= 0) continue;
        recentTimestamps.push(ts);
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

      const newSlugs = Array.from(new Set(newSubs.map(s => s.titleSlug)));
      
      const matchedNewProblems = await prisma.problem.findMany({
        where: {
          titleSlug: { in: newSlugs },
        },
        select: { id: true, titleSlug: true, title: true, difficulty: true },
      });

      const problemBySlug = new Map(matchedNewProblems.map(p => [p.titleSlug, p]));
      const submissionDateMap = new Map<string, Date>();

      for (const sub of newSubs) {
        const ts = parseInt(sub.timestamp, 10);
        if (!submissionDateMap.has(sub.titleSlug)) {
          submissionDateMap.set(sub.titleSlug, new Date(ts * 1000));
        }
      }

      // Preserve newest-first order matching our catalog
      const matchedNewProblemsOrdered: Array<{
        id: number;
        title: string;
        titleSlug: string;
        difficulty: string;
        solvedAt: Date;
      }> = [];
      const seenSlugs = new Set<string>();

      for (const sub of newSubs) {
        if (seenSlugs.has(sub.titleSlug)) continue;
        const p = problemBySlug.get(sub.titleSlug);
        if (p) {
          seenSlugs.add(sub.titleSlug);
          matchedNewProblemsOrdered.push({
            id: p.id,
            title: p.title,
            titleSlug: p.titleSlug,
            difficulty: p.difficulty,
            solvedAt: submissionDateMap.get(sub.titleSlug)!,
          });
        }
      }

      if (matchedNewProblemsOrdered.length > 0) {
        await batchUpsertProgress(userId, matchedNewProblemsOrdered, submissionDateMap);

        const activities = matchedNewProblemsOrdered.map(p => ({
          userId,
          problemId: p.id,
          action: 'SOLVED',
          timestamp: p.solvedAt,
        }));

        await prisma.activityLog.createMany({
          data: activities,
        });

        // Recalculate streak
        const { streak, lastSolvedDate } = calculateStreak(recentTimestamps);
        await prisma.userStats.upsert({
          where: { userId },
          create: { userId, streak, lastSolvedDate },
          update: { streak, lastSolvedDate },
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
        syncedCount: matchedNewProblemsOrdered.length,
        lastSubmissionTimestamp: latestTimestamp,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('LeetCode sync error:', error);
    return NextResponse.json(
      { error: error.message || 'An error occurred during synchronization' },
      { status: 500 }
    );
  }
}
