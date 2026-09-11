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

    let companiesRaw: CompanyRawRow[] = [];

    if (userId) {
      // Authenticated User Query
      let orderByClause = 'ORDER BY "completionPercentage" DESC, "solvedProblems" DESC, c.name ASC';
      if (sort === 'alphabetical') {
        orderByClause = 'ORDER BY c.name ASC';
      } else if (sort === 'least-complete') {
        orderByClause = 'ORDER BY "completionPercentage" ASC, "solvedProblems" ASC, c.name ASC';
      } else if (sort === 'most-remaining') {
        orderByClause = 'ORDER BY "remainingProblems" DESC, c.name ASC';
      }

      let havingClause = 'HAVING 1=1';
      if (filter === 'completed') {
        havingClause = 'HAVING SUM(CASE WHEN upp.solved = TRUE THEN 1 ELSE 0 END) = COUNT(cp."problemId") AND COUNT(cp."problemId") > 0';
      } else if (filter === 'in-progress') {
        havingClause = 'HAVING SUM(CASE WHEN upp.solved = TRUE THEN 1 ELSE 0 END) > 0 AND SUM(CASE WHEN upp.solved = TRUE THEN 1 ELSE 0 END) < COUNT(cp."problemId")';
      } else if (filter === 'not-started') {
        havingClause = 'HAVING SUM(CASE WHEN upp.solved = TRUE THEN 1 ELSE 0 END) = 0';
      }

      companiesRaw = await prisma.$queryRawUnsafe<CompanyRawRow[]>(`
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
    } else {
      // Guest Mode Query (Optimized catalog totals, 0 solved on server)
      let orderByClause = 'ORDER BY COUNT(cp."problemId") DESC, c.name ASC';
      if (sort === 'alphabetical') {
        orderByClause = 'ORDER BY c.name ASC';
      }

      companiesRaw = await prisma.$queryRawUnsafe<CompanyRawRow[]>(`
        SELECT 
          c.id,
          c.name,
          c.slug,
          COUNT(cp."problemId") as "totalProblems",
          0::bigint as "solvedProblems",
          0.0::float8 as "completionPercentage",
          COUNT(cp."problemId") as "remainingProblems"
        FROM "Company" c
        LEFT JOIN "CompanyProblem" cp ON c.id = cp."companyId"
        WHERE LOWER(c.name) LIKE $1
        GROUP BY c.id, c.name, c.slug
        ${orderByClause}
        LIMIT $2 OFFSET $3
      `, searchPattern, limit, offset);
    }

    const companyIds = companiesRaw.map(c => c.id);

    // Fetch firstUnsolved for the target page of companies
    let firstUnsolvedMap: Record<number, any> = {};
    if (companyIds.length > 0) {
      const problemFilter = userId
        ? {
            userProgress: {
              none: {
                userId,
                solved: true,
              },
            },
          }
        : {};

      const firstUnsolvedList = await prisma.companyProblem.findMany({
        where: {
          companyId: { in: companyIds },
          problem: problemFilter,
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
        isGuest: !userId,
      };
    });

    return NextResponse.json(formattedCompanies);
  } catch (error: any) {
    console.error('Error fetching companies:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
