import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/auth-helper';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const slug = (await params).slug;
    const userId = await getCurrentUserId();

    const company = await prisma.company.findUnique({
      where: { slug },
      include: {
        problems: {
          select: {
            frequency: true,
            inThirtyDays: true,
            inThreeMonths: true,
            inSixMonths: true,
            inMoreThanSixMonths: true,
            inAll: true,
            problem: {
              select: {
                id: true,
                title: true,
                url: true,
                difficulty: true,
                ...(userId
                  ? {
                      userProgress: {
                        where: { userId },
                        select: {
                          solved: true,
                          notes: true,
                          bookmarked: true,
                        },
                      },
                    }
                  : {}),
              },
            },
          },
        },
      },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Format problems
    const problems = company.problems.map(cp => {
      const progress = (cp.problem as any).userProgress?.[0];
      return {
        id: cp.problem.id,
        title: cp.problem.title,
        url: cp.problem.url,
        difficulty: cp.problem.difficulty,
        solved: progress?.solved || false,
        notes: progress?.notes || '',
        bookmarked: progress?.bookmarked || false,
        frequency: cp.frequency,
        categories: {
          thirtyDays: cp.inThirtyDays,
          threeMonths: cp.inThreeMonths,
          sixMonths: cp.inSixMonths,
          moreThanSixMonths: cp.inMoreThanSixMonths,
          all: cp.inAll,
        },
      };
    });

    // Sort by frequency descending
    problems.sort((a, b) => b.frequency - a.frequency);

    const totalProblems = problems.length;
    const solvedProblems = problems.filter(p => p.solved).length;
    const completionPercentage = totalProblems > 0 ? (solvedProblems / totalProblems) * 100 : 0;

    // Find first unsolved problem for Continue Learning
    const firstUnsolved = problems.find(p => !p.solved) || null;

    const { searchParams } = new URL(request.url);
    const isGuestParam = searchParams.get('guest') === '1';

    const headers: Record<string, string> = {
      'Vary': 'Cookie',
    };
    if (!userId && isGuestParam) {
      // Guest catalog partitioned by ?guest=1; safe to cache at Edge CDN without poisoning authenticated sessions
      headers['Cache-Control'] = 'public, s-maxage=3600, stale-while-revalidate=86400';
    } else {
      // Authenticated user data or unpartitioned requests must never be publicly cached
      headers['Cache-Control'] = 'private, no-cache, no-store, must-revalidate';
    }

    return NextResponse.json({
      id: company.id,
      name: company.name,
      slug: company.slug,
      updatedAt: company.updatedAt,
      isGuest: !userId,
      stats: {
        totalProblems,
        solvedProblems,
        completionPercentage,
        remainingProblems: totalProblems - solvedProblems,
      },
      firstUnsolved,
      problems,
    }, { headers });
  } catch (error: any) {
    console.error('Error fetching company details:', error);
    const details = process.env.NODE_ENV === 'development' ? error.message : undefined;
    return NextResponse.json({ error: 'Internal Server Error', ...(details ? { details } : {}) }, { status: 500 });
  }
}
