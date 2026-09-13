import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/auth-helper';

// GET problem details with companies featuring it
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = parseInt((await params).id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid problem ID' }, { status: 400 });
    }

    const userId = await getCurrentUserId();

    const [problem, progress] = await Promise.all([
      prisma.problem.findUnique({
        where: { id },
        include: {
          companies: {
            select: {
              frequency: true,
              company: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      }),
      userId
        ? prisma.userProblemProgress.findUnique({
            where: { userId_problemId: { userId, problemId: id } },
          })
        : Promise.resolve(null),
    ]);

    if (!problem) {
      return NextResponse.json({ error: 'Problem not found' }, { status: 404 });
    }

    // Format companies list
    const companies = problem.companies.map(cp => ({
      id: cp.company.id,
      name: cp.company.name,
      slug: cp.company.slug,
      frequency: cp.frequency,
    })).sort((a, b) => b.frequency - a.frequency);

    const { searchParams } = new URL(request.url);
    const isGuestParam = searchParams.get('guest') === '1';

    const headers: Record<string, string> = {
      'Vary': 'Cookie',
    };
    if (!userId && isGuestParam) {
      // Guest problem details partitioned by ?guest=1; safe to cache at Edge CDN without poisoning authenticated sessions
      headers['Cache-Control'] = 'public, s-maxage=3600, stale-while-revalidate=86400';
    } else {
      // Authenticated user data or unpartitioned requests must never be publicly cached
      headers['Cache-Control'] = 'private, no-cache, no-store, must-revalidate';
    }

    return NextResponse.json({
      id: problem.id,
      title: problem.title,
      url: problem.url,
      difficulty: problem.difficulty,
      solved: progress?.solved || false,
      solvedAt: progress?.solvedAt || null,
      notes: progress?.notes || '',
      bookmarked: progress?.bookmarked || false,
      companies,
    }, { headers });
  } catch (error: any) {
    console.error('Error fetching problem details:', error);
    const details = process.env.NODE_ENV === 'development' ? error.message : undefined;
    return NextResponse.json({ error: 'Internal Server Error', ...(details ? { details } : {}) }, { status: 500 });
  }
}

// Helper to verify if a problem is solved on LeetCode
async function verifyProblemSolvedOnLeetCode(
  username: string,
  cookie: string | undefined,
  titleSlug: string
): Promise<{ verified: boolean; reason?: string; solvedAt?: Date }> {
  // 1. If cookie is available, check authenticated question status
  if (cookie && cookie.trim()) {
    try {
      const query = `
        query questionData($titleSlug: String!) {
          question(titleSlug: $titleSlug) {
            status
          }
        }
      `;
      const res = await fetch('https://leetcode.com/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `LEETCODE_SESSION=${cookie.trim()}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        body: JSON.stringify({ query, variables: { titleSlug } }),
      });
      if (res.ok) {
        const json = await res.json();
        const status = json.data?.question?.status;
        if (status === 'ac') {
          return { verified: true, solvedAt: new Date() };
        } else if (status !== null) {
          return {
            verified: false,
            reason: `LeetCode shows this problem has status "${status || 'unsolved'}", not Accepted (AC).`,
          };
        }
      }
    } catch (e: any) {
      console.warn('Authenticated check error:', e.message);
    }
  }

  // 2. Check public recent accepted submissions (works without cookie)
  if (username && username.trim()) {
    try {
      const query = `
        query recentAcSubmissions($username: String!, $limit: Int!) {
          recentAcSubmissionList(username: $username, limit: $limit) {
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
        body: JSON.stringify({ query, variables: { username, limit: 20 } }),
      });

      if (res.ok) {
        const json = await res.json();
        const submissions = json.data?.recentAcSubmissionList || [];
        const found = submissions.find((sub: any) => sub.titleSlug === titleSlug);
        if (found) {
          const solvedAt = new Date(parseInt(found.timestamp) * 1000);
          return { verified: true, solvedAt };
        }
      }
    } catch (e: any) {
      console.warn('Public recent submissions check error:', e.message);
    }
  }

  // If not found in recent submissions and no valid session cookie
  if (!cookie || !cookie.trim()) {
    return {
      verified: false,
      reason: `Could not verify on LeetCode: This question was not found in your 20 most recent submissions. To verify older solutions, please add your LEETCODE_SESSION cookie in Settings.`,
    };
  }

  return {
    verified: false,
    reason: `This problem has not been solved on LeetCode by user "${username}".`,
  };
}

// PATCH update problem status for current user
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = parseInt((await params).id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid problem ID' }, { status: 400 });
    }

    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { error: 'Sign in with Google to save notes, bookmarks, and solve status across devices.', isGuest: true },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { solved, bookmarked, notes } = body;

    // Check if problem exists
    const existingProblem = await prisma.problem.findUnique({
      where: { id },
    });

    if (!existingProblem) {
      return NextResponse.json({ error: 'Problem not found' }, { status: 404 });
    }

    // Get current user progress
    const existingProgress = await prisma.userProblemProgress.findUnique({
      where: { userId_problemId: { userId, problemId: id } },
    });

    const dataToUpdate: any = {};
    let solvedStateChanged = false;
    let newSolvedState = false;

    if (solved !== undefined) {
      if (solved) {
        // Verify with LeetCode before marking as solved
        const config = await prisma.userSyncConfig.findUnique({ where: { userId } });
        if (!config?.leetcodeUser) {
          return NextResponse.json(
            { error: 'Please set your LeetCode username in Settings before marking problems as solved.' },
            { status: 400 }
          );
        }

          const verification = await verifyProblemSolvedOnLeetCode(
            config.leetcodeUser,
            config.leetcodeSession,
            existingProblem.titleSlug
          );

          if (!verification.verified) {
            return NextResponse.json(
              { error: verification.reason || 'Verification failed on LeetCode.' },
              { status: 400 }
            );
          }

          dataToUpdate.solvedAt = verification.solvedAt || existingProgress?.solvedAt || new Date();
        dataToUpdate.solved = true;
        if (!existingProgress?.solved) {
          solvedStateChanged = true;
          newSolvedState = true;
        }
      } else {
        // Un-marking solved
        dataToUpdate.solved = false;
        dataToUpdate.solvedAt = null;
        if (existingProgress?.solved) {
          solvedStateChanged = true;
          newSolvedState = false;
        }
      }
    }

    if (bookmarked !== undefined) {
      dataToUpdate.bookmarked = bookmarked;
    }

    if (notes !== undefined) {
      if (typeof notes === 'string' && notes.length > 10000) {
        return NextResponse.json(
          { error: 'Note exceeds maximum limit of 10,000 characters.' },
          { status: 400 }
        );
      }
      dataToUpdate.notes = typeof notes === 'string' ? notes : '';
    }

    // Perform transaction to update user progress, log activity, and update streak
    const result = await prisma.$transaction(async (tx) => {
      // 1. Upsert UserProblemProgress
      const updated = await tx.userProblemProgress.upsert({
        where: { userId_problemId: { userId, problemId: id } },
        create: {
          userId,
          problemId: id,
          solved: dataToUpdate.solved || false,
          solvedAt: dataToUpdate.solvedAt || null,
          bookmarked: dataToUpdate.bookmarked || false,
          notes: dataToUpdate.notes || '',
        },
        update: dataToUpdate,
      });

      // 2. If solved state changed, log activity and calculate streak
      if (solvedStateChanged) {
        await tx.activityLog.create({
          data: {
            userId,
            problemId: id,
            action: newSolvedState ? 'SOLVED' : 'UNSOLVED',
          },
        });

        if (newSolvedState) {
          const stats = await tx.userStats.findUnique({ where: { userId } });
          const todayStr = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD
          
          let newStreak = 1;
          if (stats) {
            newStreak = stats.streak;
            const lastSolved = stats.lastSolvedDate;

            if (!lastSolved) {
              newStreak = 1;
            } else if (lastSolved === todayStr) {
              // Already solved today
            } else {
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
      }

      return updated;
    });

    return NextResponse.json({
      id: existingProblem.id,
      title: existingProblem.title,
      url: existingProblem.url,
      difficulty: existingProblem.difficulty,
      solved: result.solved,
      solvedAt: result.solvedAt,
      notes: result.notes,
      bookmarked: result.bookmarked,
    });
  } catch (error: any) {
    console.error('Error updating problem:', error);
    const details = process.env.NODE_ENV === 'development' ? error.message : undefined;
    return NextResponse.json({ error: 'Internal Server Error', ...(details ? { details } : {}) }, { status: 500 });
  }
}
