import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/auth-helper';

interface CompanyRawRow {
  id: number;
  name: string;
  slug: string;
  totalProblems: bigint;
  solvedProblems: bigint;
  completionPercentage: number;
  remainingProblems: bigint;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim().toLowerCase() || '';
    const filter = searchParams.get('filter') || 'all'; // 'all', 'completed', 'in-progress', 'not-started'
    const sort = searchParams.get('sort') || 'most-complete';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.max(1, parseInt(limitParam, 10)) : 60;
    const offset = (page - 1) * limit;
    const userId = await getCurrentUserId();

    const searchPattern = search ? `%${search}%` : '%';

    // Order SQL fragment
    let orderByClause = 'ORDER BY "completionPercentage" DESC, "solvedProblems" DESC, c.name ASC';
    if (sort === 'alphabetical') {
      orderByClause = 'ORDER BY c.name ASC';
    } else if (sort === 'least-complete') {
      orderByClause = 'ORDER BY "completionPercentage" ASC, "solvedProblems" ASC, c.name ASC';
    } else if (sort === 'most-remaining') {
      orderByClause = 'ORDER BY "remainingProblems" DESC, c.name ASC';
    }

    // Filter SQL fragment
    let havingClause = 'HAVING 1=1';
    if (filter === 'completed') {
      havingClause = 'HAVING SUM(CASE WHEN upp.solved = TRUE THEN 1 ELSE 0 END) = COUNT(cp."problemId") AND COUNT(cp."problemId") > 0';
    } else if (filter === 'in-progress') {
      havingClause = 'HAVING SUM(CASE WHEN upp.solved = TRUE THEN 1 ELSE 0 END) > 0 AND SUM(CASE WHEN upp.solved = TRUE THEN 1 ELSE 0 END) < COUNT(cp."problemId")';
    } else if (filter === 'not-started') {
      havingClause = 'HAVING SUM(CASE WHEN upp.solved = TRUE THEN 1 ELSE 0 END) = 0';
    }

    // Single PostgreSQL query for stats & pagination
    const companiesRaw = await prisma.$queryRawUnsafe<CompanyRawRow[]>(`
      SELECT 
        c.id,
        c.name,
        c.slug,
        COUNT(cp."problemId") as "totalProblems",
        SUM(CASE WHEN upp.solved = TRUE THEN 1 ELSE 0 END) as "solvedProblems",
        CASE WHEN COUNT(cp."problemId") > 0 
             THEN (CAST(SUM(CASE WHEN upp.solved = TRUE THEN 1 ELSE 0 END) AS FLOAT) / COUNT(cp."problemId")) * 100 
             ELSE 0 END as "completionPercentage",
        (COUNT(cp."problemId") - SUM(CASE WHEN upp.solved = TRUE THEN 1 ELSE 0 END)) as "remainingProblems"
      FROM "Company" c
      LEFT JOIN "CompanyProblem" cp ON c.id = cp."companyId"
      LEFT JOIN "UserProblemProgress" upp ON cp."problemId" = upp."problemId" AND upp."userId" = $1
      WHERE LOWER(c.name) LIKE $2
      GROUP BY c.id, c.name, c.slug
      ${havingClause}
      ${orderByClause}
      LIMIT $3 OFFSET $4
    `, userId, searchPattern, limit, offset);

    const companyIds = companiesRaw.map(c => c.id);

    // Fetch firstUnsolved for the target page of companies in one batch query
    let firstUnsolvedMap: Record<number, any> = {};
    if (companyIds.length > 0) {
      const firstUnsolvedList = await prisma.companyProblem.findMany({
        where: {
          companyId: { in: companyIds },
          problem: {
            userProgress: {
              none: {
                userId,
                solved: true,
              },
            },
          },
        },
        orderBy: [
          { companyId: 'asc' },
          { frequency: 'desc' },
        ],
        select: {
          companyId: true,
          problem: {
            select: {
              id: true,
              title: true,
              url: true,
              difficulty: true,
            },
          },
        },
      });

      for (const item of firstUnsolvedList) {
        if (!firstUnsolvedMap[item.companyId]) {
          firstUnsolvedMap[item.companyId] = item.problem;
        }
      }
    }

    const formattedCompanies = companiesRaw.map(c => {
      const totalProblems = Number(c.totalProblems);
      const solvedProblems = Number(c.solvedProblems);
      const completionPercentage = Number(c.completionPercentage);
      const remainingProblems = Number(c.remainingProblems);
      const firstUnsolved = firstUnsolvedMap[c.id] || null;

      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        totalProblems,
        solvedProblems,
        completionPercentage,
        remainingProblems,
        firstUnsolved,
      };
    });

    return NextResponse.json(formattedCompanies);
  } catch (error: any) {
    console.error('Error fetching companies:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
