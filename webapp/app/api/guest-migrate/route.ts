import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUserId } from '@/lib/auth-helper';

interface GuestEntry {
  solved?: boolean;
  isManual?: boolean;
  solvedAt?: string | null;
  bookmarked?: boolean;
  notes?: string;
}

export async function POST(request: Request) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in to migrate progress.' }, { status: 401 });
    }

    const body = await request.json();
    const progressMap: Record<string, GuestEntry> = body?.progress || {};
    const entries = Object.entries(progressMap);

    if (entries.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    // Parse problem IDs and filter out non-numbers
    const parsedEntries = entries
      .map(([rawId, data]) => ({ problemId: parseInt(rawId, 10), data }))
      .filter(({ problemId }) => !isNaN(problemId));

    if (parsedEntries.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    const problemIds = parsedEntries.map((e) => e.problemId);

    // Verify which problems actually exist in the database
    const existingProblems = await prisma.problem.findMany({
      where: { id: { in: problemIds } },
      select: { id: true },
    });
    const validProblemIdSet = new Set(existingProblems.map((p) => p.id));
    const validItems = parsedEntries.filter((e) => validProblemIdSet.has(e.problemId));

    if (validItems.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    let newlySolvedCount = 0;

    await prisma.$transaction(async (tx) => {
      for (const item of validItems) {
        const { problemId, data } = item;

        const existing = await tx.userProblemProgress.findUnique({
          where: { userId_problemId: { userId, problemId } },
        });

        const updates: any = {};
        if (data.solved !== undefined) {
          updates.solved = data.solved;
          updates.isManual = true; // Guest solves are manual until LeetCode-verified
          updates.solvedAt = data.solved ? (data.solvedAt ? new Date(data.solvedAt) : new Date()) : null;
          if (data.solved && !existing?.solved) {
            newlySolvedCount++;
          }
        }
        if (data.bookmarked !== undefined) {
          updates.bookmarked = data.bookmarked;
        }
        if (typeof data.notes === 'string' && data.notes.trim()) {
          // If existing note is empty or shorter, use guest note
          if (!existing?.notes || existing.notes.trim().length === 0) {
            updates.notes = data.notes;
          }
        }

        await tx.userProblemProgress.upsert({
          where: { userId_problemId: { userId, problemId } },
          create: {
            userId,
            problemId,
            solved: data.solved || false,
            isManual: true,
            solvedAt: data.solved ? (data.solvedAt ? new Date(data.solvedAt) : new Date()) : null,
            bookmarked: data.bookmarked || false,
            notes: typeof data.notes === 'string' ? data.notes : '',
          },
          update: updates,
        });

        if (data.solved && !existing?.solved) {
          await tx.activityLog.create({
            data: {
              userId,
              problemId,
              action: 'SOLVED',
            },
          }).catch(() => {});
        }
      }

      // Update user streak if any questions were solved
      if (newlySolvedCount > 0) {
        const todayStr = new Date().toLocaleDateString('sv-SE');
        const stats = await tx.userStats.findUnique({ where: { userId } });
        let newStreak = stats?.streak || 1;

        await tx.userStats.upsert({
          where: { userId },
          create: {
            userId,
            streak: 1,
            lastSolvedDate: todayStr,
          },
          update: {
            streak: newStreak,
            lastSolvedDate: todayStr,
          },
        });
      }
    });

    return NextResponse.json({
      success: true,
      count: validItems.length,
      newlySolvedCount,
    });
  } catch (error: any) {
    console.error('Error migrating guest progress:', error);
    return NextResponse.json(
      { error: 'Failed to migrate guest progress', details: error.message },
      { status: 500 }
    );
  }
}
