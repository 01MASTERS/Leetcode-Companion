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

    const companyMeta = await prisma.company.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        updatedAt: true,
      },
    });

    if (!companyMeta) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    interface RawProblemRow {
      problemId: number;
      title: string;
      url: string;
      difficulty: string;
      frequency: number;
      inThirtyDays: boolean;
      inThreeMonths: boolean;
      inSixMonths: boolean;
      inMoreThanSixMonths: boolean;
      inAll: boolean;
      solved: boolean | null;
      isManual: boolean | null;
      notes: string | null;
      bookmarked: boolean | null;
    }

    // Single indexed SQL join query — avoids Prisma's 4-query sequential relation waterfall
    const rawRows = userId
      ? await prisma.$queryRawUnsafe<RawProblemRow[]>(`
          SELECT 
            p.id as "problemId",
            p.title,
            p.url,
            p.difficulty,
            cp.frequency,
            cp."inThirtyDays",
            cp."inThreeMonths",
            cp."inSixMonths",
            cp."inMoreThanSixMonths",
            cp."inAll",
            COALESCE(upp.solved, FALSE) as solved,
            COALESCE(upp."isManual", FALSE) as "isManual",
            COALESCE(upp.notes, '') as notes,
            COALESCE(upp.bookmarked, FALSE) as bookmarked
          FROM "CompanyProblem" cp
          JOIN "Problem" p ON cp."problemId" = p.id
          LEFT JOIN "UserProblemProgress" upp 
            ON cp."problemId" = upp."problemId" AND upp."userId" = $1
          WHERE cp."companyId" = $2
          ORDER BY cp.frequency DESC;
        `, userId, companyMeta.id)
      : await prisma.$queryRawUnsafe<RawProblemRow[]>(`
          SELECT 
            p.id as "problemId",
            p.title,
            p.url,
            p.difficulty,
            cp.frequency,
            cp."inThirtyDays",
            cp."inThreeMonths",
            cp."inSixMonths",
            cp."inMoreThanSixMonths",
            cp."inAll",
            FALSE as solved,
            FALSE as "isManual",
            '' as notes,
            FALSE as bookmarked
          FROM "CompanyProblem" cp
          JOIN "Problem" p ON cp."problemId" = p.id
          WHERE cp."companyId" = $1
          ORDER BY cp.frequency DESC;
        `, companyMeta.id);

    // Format problems
    const problems = rawRows.map(row => ({
      id: row.problemId,
      title: row.title,
      url: row.url,
      difficulty: row.difficulty,
      solved: Boolean(row.solved),
      isManual: Boolean(row.isManual),
      notes: row.notes || '',
      bookmarked: Boolean(row.bookmarked),
      frequency: Number(row.frequency),
      categories: {
        thirtyDays: Boolean(row.inThirtyDays),
        threeMonths: Boolean(row.inThreeMonths),
        sixMonths: Boolean(row.inSixMonths),
        moreThanSixMonths: Boolean(row.inMoreThanSixMonths),
        all: Boolean(row.inAll),
      },
    }));

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
      id: companyMeta.id,
      name: companyMeta.name,
      slug: companyMeta.slug,
      updatedAt: companyMeta.updatedAt,
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
