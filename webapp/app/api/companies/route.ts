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
      // Authenticated User Query with optimized pre-aggregated CTEs
      let orderByClause = 'ORDER BY "completionPercentage" DESC, "solvedProblems" DESC, c.name ASC';
      if (sort === 'alphabetical') {
        orderByClause = 'ORDER BY c.name ASC';
      } else if (sort === 'least-complete') {
        orderByClause = 'ORDER BY "completionPercentage" ASC, "solvedProblems" ASC, c.name ASC';
      } else if (sort === 'most-remaining') {
        orderByClause = 'ORDER BY "remainingProblems" DESC, c.name ASC';
      }

      let filterClause = '';
      if (filter === 'completed') {
        filterClause = 'AND COALESCE(us.solved_count, 0) = COALESCE(ct.total_count, 0) AND COALESCE(ct.total_count, 0) > 0';
      } else if (filter === 'in-progress') {
        filterClause = 'AND COALESCE(us.solved_count, 0) > 0 AND COALESCE(us.solved_count, 0) < COALESCE(ct.total_count, 0)';
      } else if (filter === 'not-started') {
        filterClause = 'AND COALESCE(us.solved_count, 0) = 0';
      }

      companiesRaw = await prisma.$queryRawUnsafe<CompanyRawRow[]>(`
        WITH user_solved AS (
          SELECT cp."companyId", COUNT(cp."problemId")::bigint as solved_count
          FROM "UserProblemProgress" upp
          JOIN "CompanyProblem" cp ON cp."problemId" = upp."problemId"
          WHERE upp."userId" = $1 AND upp.solved = TRUE
          GROUP BY cp."companyId"
        ),
        company_totals AS (
          SELECT "companyId", COUNT("problemId")::bigint as total_count
          FROM "CompanyProblem"
          GROUP BY "companyId"
        )
        SELECT 
          c.id,
          c.name,
          c.slug,
          COALESCE(ct.total_count, 0::bigint) as "totalProblems",
          COALESCE(us.solved_count, 0::bigint) as "solvedProblems",
          CASE WHEN COALESCE(ct.total_count, 0) > 0 
               THEN (CAST(COALESCE(us.solved_count, 0) AS FLOAT) / ct.total_count) * 100 
               ELSE 0.0 END as "completionPercentage",
          (COALESCE(ct.total_count, 0::bigint) - COALESCE(us.solved_count, 0::bigint)) as "remainingProblems"
        FROM "Company" c
        LEFT JOIN company_totals ct ON c.id = ct."companyId"
        LEFT JOIN user_solved us ON c.id = us."companyId"
        WHERE LOWER(c.name) LIKE $2
        ${filterClause}
        ${orderByClause}
        LIMIT $3 OFFSET $4
      `, userId, searchPattern, limit, offset);
    } else {
      // Guest Mode Query (Optimized catalog totals, 0 solved on server)
      let orderByClause = 'ORDER BY COALESCE(ct.total_count, 0) DESC, c.name ASC';
      if (sort === 'alphabetical') {
        orderByClause = 'ORDER BY c.name ASC';
      }

      companiesRaw = await prisma.$queryRawUnsafe<CompanyRawRow[]>(`
        WITH company_totals AS (
          SELECT "companyId", COUNT("problemId")::bigint as total_count
          FROM "CompanyProblem"
          GROUP BY "companyId"
        )
        SELECT 
          c.id,
          c.name,
          c.slug,
          COALESCE(ct.total_count, 0::bigint) as "totalProblems",
          0::bigint as "solvedProblems",
          0.0::float8 as "completionPercentage",
          COALESCE(ct.total_count, 0::bigint) as "remainingProblems"
        FROM "Company" c
        LEFT JOIN company_totals ct ON c.id = ct."companyId"
        WHERE LOWER(c.name) LIKE $1
        ${orderByClause}
        LIMIT $2 OFFSET $3
      `, searchPattern, limit, offset);
    }

    const companyIds = companiesRaw.map(c => c.id);

    // Fetch firstUnsolved for the target page of companies with DISTINCT ON (cp."companyId")
    let firstUnsolvedMap: Record<number, any> = {};
    if (companyIds.length > 0) {
      const idList = companyIds.map(Number).filter(n => !isNaN(n)).join(',');
      if (idList.length > 0) {
        interface FirstUnsolvedRow {
          companyId: number;
          id: number;
          title: string;
          url: string;
          difficulty: string;
        }

        let firstUnsolvedRows: FirstUnsolvedRow[] = [];
        if (userId) {
          firstUnsolvedRows = await prisma.$queryRawUnsafe<FirstUnsolvedRow[]>(`
            SELECT DISTINCT ON (cp."companyId")
              cp."companyId" as "companyId",
              p.id,
              p.title,
              p.url,
              p.difficulty
            FROM "CompanyProblem" cp
            JOIN "Problem" p ON cp."problemId" = p.id
            LEFT JOIN "UserProblemProgress" upp 
              ON cp."problemId" = upp."problemId" AND upp."userId" = $1 AND upp.solved = TRUE
            WHERE cp."companyId" IN (${idList})
              AND upp.id IS NULL
            ORDER BY cp."companyId", cp.frequency DESC
          `, userId);
        } else {
          firstUnsolvedRows = await prisma.$queryRawUnsafe<FirstUnsolvedRow[]>(`
            SELECT DISTINCT ON (cp."companyId")
              cp."companyId" as "companyId",
              p.id,
              p.title,
              p.url,
              p.difficulty
            FROM "CompanyProblem" cp
            JOIN "Problem" p ON cp."problemId" = p.id
            WHERE cp."companyId" IN (${idList})
            ORDER BY cp."companyId", cp.frequency DESC
          `);
        }

        for (const row of firstUnsolvedRows) {
          firstUnsolvedMap[row.companyId] = {
            id: row.id,
            title: row.title,
            url: row.url,
            difficulty: row.difficulty,
          };
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

    const isGuestParam = searchParams.get('guest') === '1';

    const headers: Record<string, string> = {
      'Vary': 'Cookie',
    };
    if (!userId && isGuestParam) {
      // Guest catalog response partitioned by ?guest=1; safe to cache at Edge CDN without poisoning authenticated sessions.
      headers['Cache-Control'] = 'public, s-maxage=3600, stale-while-revalidate=86400';
    } else {
      // Authenticated user data or unpartitioned requests must never be publicly cached.
      headers['Cache-Control'] = 'private, no-cache, no-store, must-revalidate';
    }

    return NextResponse.json(formattedCompanies, { headers });
  } catch (error: any) {
    console.error('Error fetching companies:', error);
    const details = process.env.NODE_ENV === 'development' ? error.message : undefined;
    return NextResponse.json({ error: 'Internal Server Error', ...(details ? { details } : {}) }, { status: 500 });
  }
}
