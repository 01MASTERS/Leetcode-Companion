import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const latestSync = await prisma.syncMetadata.findFirst({
      orderBy: { syncedAt: 'desc' },
    });

    const recentAudits = await prisma.syncMetadata.findMany({
      orderBy: { syncedAt: 'desc' },
      take: 10,
    });

    const totalCompanies = latestSync?.totalCompanies ?? (await prisma.company.count());
    const totalProblems = latestSync?.totalProblems ?? (await prisma.problem.count());

    return NextResponse.json({
      latest: latestSync
        ? {
            id: latestSync.id,
            commitSha: latestSync.commitSha,
            shortSha: latestSync.commitSha.slice(0, 7),
            commitUrl: `https://github.com/snehasishroy/leetcode-companywise-interview-questions/commit/${latestSync.commitSha}`,
            syncedAt: latestSync.syncedAt,
            totalCompanies,
            totalProblems,
            summary: latestSync.summary,
            updatedCompanySlugs: latestSync.updatedCompanySlugs
              ? latestSync.updatedCompanySlugs.split(',').filter(Boolean)
              : [],
          }
        : null,
      history: recentAudits.map((a) => ({
        id: a.id,
        shortSha: a.commitSha.slice(0, 7),
        commitUrl: `https://github.com/snehasishroy/leetcode-companywise-interview-questions/commit/${a.commitSha}`,
        syncedAt: a.syncedAt,
        summary: a.summary,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching catalog sync status:', error);
    return NextResponse.json({ error: 'Failed to fetch catalog sync status' }, { status: 500 });
  }
}
