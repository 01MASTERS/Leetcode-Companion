import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { prisma } from '../lib/prisma';

const UPSTREAM_DIR = path.resolve(__dirname, '../../temp-upstream');

async function main() {
  console.log('Checking upstream repository at:', UPSTREAM_DIR);
  if (!fs.existsSync(UPSTREAM_DIR)) {
    console.error('Upstream repo not found at:', UPSTREAM_DIR);
    process.exit(1);
  }

  const companies = await prisma.company.findMany({
    select: { id: true, slug: true, name: true, updatedAt: true },
  });

  console.log(`Found ${companies.length} companies in database.`);

  let updatedCount = 0;
  let missingCount = 0;

  // Track dates by slug
  const updates: Array<{ id: number; slug: string; date: Date }> = [];

  for (const company of companies) {
    try {
      const companyDir = path.join(UPSTREAM_DIR, company.slug);
      if (!fs.existsSync(companyDir)) {
        missingCount++;
        continue;
      }

      // Run git log for this company folder
      const dateStr = execSync(`git log -1 --format="%aI" -- "${company.slug}"`, {
        cwd: UPSTREAM_DIR,
        encoding: 'utf-8',
      }).trim();

      if (dateStr) {
        const commitDate = new Date(dateStr);
        updates.push({ id: company.id, slug: company.slug, date: commitDate });
      }
    } catch (err: any) {
      console.warn(`Could not get git date for ${company.slug}:`, err.message);
    }
  }

  console.log(`Matched git commit dates for ${updates.length} companies (${missingCount} not found as folders).`);

  // Batch update in PostgreSQL using Prisma
  console.log('Updating companies in Supabase PostgreSQL...');
  for (let i = 0; i < updates.length; i += 50) {
    const batch = updates.slice(i, i + 50);
    await Promise.all(
      batch.map((item) =>
        prisma.$executeRaw`UPDATE "Company" SET "updatedAt" = ${item.date} WHERE id = ${item.id}`
      )
    );
    updatedCount += batch.length;
    process.stdout.write(`Updated ${updatedCount}/${updates.length}...\r`);
  }

  console.log(`\nSuccessfully updated ${updatedCount} companies with their exact upstream commit dates!`);

  // Print a few sample companies
  const samples = await prisma.company.findMany({
    where: { slug: { in: ['microsoft', 'google', 'amazon', 'meta', 'apple', 'uber'] } },
    select: { name: true, slug: true, updatedAt: true },
  });
  console.log('Sample verified companies:', samples);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
