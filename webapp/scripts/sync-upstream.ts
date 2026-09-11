import Papa from 'papaparse';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const UPSTREAM_OWNER = 'snehasishroy';
const UPSTREAM_REPO = 'leetcode-companywise-interview-questions';
const UPSTREAM_BRANCH = 'master';

// Format company slug into human readable name
function formatCompanyName(slug: string): string {
  const overrides: Record<string, string> = {
    '1kosmos': '1Kosmos',
    '6sense': '6sense',
    'bill-com': 'Bill.com',
    'coindcx': 'CoinDCX',
    'cred': 'CRED',
    'drw': 'DRW',
    'ey': 'EY',
    'hrt': 'HRT',
    'hpe': 'HPE',
    'ibm': 'IBM',
    'imc': 'IMC',
    'ivp': 'IVP',
    'ixl': 'IXL',
    'jpmorgan': 'JPMorgan',
    'kotak-mahindra-bank': 'Kotak Mahindra Bank',
    'lowe': 'Lowe\'s',
    'lowes': 'Lowe\'s',
    'ncr': 'NCR',
    'npci': 'NPCI',
    'ola': 'Ola',
    'oyo': 'OYO',
    'pwc': 'PwC',
    'sig': 'SIG',
    'tcs': 'TCS',
    'ubs': 'UBS',
    'ukg': 'UKG',
    'unbxd': 'Unbxd',
    'ust': 'UST',
    'vimeo': 'Vimeo',
    'vk': 'VK',
    'wipro': 'Wipro',
    'wix': 'Wix',
    'zoho': 'Zoho',
  };

  const lower = slug.toLowerCase();
  if (overrides[lower]) {
    return overrides[lower];
  }

  return slug
    .split('-')
    .map(word => {
      if (['of', 'and', 'the', 'for', 'to', 'in', 'by'].includes(word.toLowerCase())) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

interface ProblemCSVRow {
  ID: string;
  URL?: string;
  Title?: string;
  Difficulty?: string;
  'Acceptance %'?: string;
  'Frequency %'?: string;
}

interface ParsedFileTarget {
  companySlug: string;
  filename: string;
  content: string;
}

async function githubFetch(endpoint: string) {
  const headers: Record<string, string> = {
    'User-Agent': 'LeetCode-Companion-Sync-Pipeline/1.0',
    Accept: 'application/vnd.github.v3+json',
  };

  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = endpoint.startsWith('http') ? endpoint : `https://api.github.com${endpoint}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`GitHub API request failed: ${res.status} ${res.statusText} - ${errorText}`);
  }
  return res.json();
}

async function fetchRawFile(filePath: string, ref: string): Promise<string> {
  const url = `https://raw.githubusercontent.com/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/${ref}/${filePath}`;
  const headers: Record<string, string> = {
    'User-Agent': 'LeetCode-Companion-Sync-Pipeline/1.0',
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch raw file ${filePath} from GitHub: ${res.statusText}`);
  }
  return res.text();
}

// Map CSV filename to recency category
function categorizeFile(filename: string): {
  isThirtyDays: boolean;
  isThreeMonths: boolean;
  isSixMonths: boolean;
  isMoreThanSixMonths: boolean;
  isAll: boolean;
} {
  const clean = filename.toLowerCase().replace(/[^a-z0-9]/g, '');
  const isThirty = clean.includes('thirty') || clean.includes('30day') || clean.includes('1thirty');
  const isThree = clean.includes('threemonth') || clean.includes('3month') || clean.includes('2threemonth');
  const isSix = clean.includes('sixmonth') || clean.includes('6month') || clean.includes('3sixmonth');
  const isMoreThanSix = clean.includes('morethansix') || clean.includes('4morethansix') || clean.includes('morethan6');
  const isAll = clean.includes('all') || clean.includes('5all');

  return {
    isThirtyDays: isThirty,
    isThreeMonths: isThree,
    isSixMonths: isSix,
    isMoreThanSixMonths: isMoreThanSix,
    isAll: isAll || (!isThirty && !isThree && !isSix && !isMoreThanSix),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const isCheckOnly = args.includes('--check');
  const isForce = args.includes('--force') || process.env.FORCE_SYNC === 'true';

  console.log('====================================================');
  console.log('  Autonomous Upstream Sync Engine - LeetCode Companion');
  console.log('====================================================');
  console.log(`Target Upstream: ${UPSTREAM_OWNER}/${UPSTREAM_REPO} (branch: ${UPSTREAM_BRANCH})`);
  console.log(`Mode: ${isCheckOnly ? 'CHECK ONLY (--check)' : isForce ? 'FORCE SYNC (--force)' : 'INCREMENTAL SYNC'}`);

  // 1. Fetch latest upstream commit SHA
  console.log('\n[1/5] Checking latest upstream commit...');
  const latestCommitData = await githubFetch(
    `/repos/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/commits/${UPSTREAM_BRANCH}`
  );
  const headSha: string = latestCommitData.sha;
  const commitMsg: string = latestCommitData.commit?.message?.split('\n')[0] || 'No message';
  const commitAuthor: string = latestCommitData.commit?.author?.name || 'Upstream Author';
  const commitDate: string = latestCommitData.commit?.author?.date || new Date().toISOString();

  console.log(`Latest Upstream Commit: ${headSha}`);
  console.log(`Author: ${commitAuthor} (${commitDate})`);
  console.log(`Message: "${commitMsg}"`);

  // 2. Query last stored SyncMetadata in Supabase
  console.log('\n[2/5] Reading last sync metadata from database...');
  const lastSync = await prisma.syncMetadata.findFirst({
    orderBy: { syncedAt: 'desc' },
  });

  const lastSha = lastSync?.commitSha || null;
  console.log(`Database Current Commit: ${lastSha || 'None (Uninitialized)'}`);
  console.log(`Database Last Synced At: ${lastSync?.syncedAt?.toISOString() || 'Never'}`);

  if (!isForce && lastSha && (lastSha === headSha || lastSha.startsWith(headSha) || headSha.startsWith(lastSha))) {
    console.log('\n✅ Database catalog is already fully up to date with upstream!');
    console.log(`No new commits found since ${lastSha.slice(0, 7)}. Exiting.`);
    if (process.env.GITHUB_STEP_SUMMARY) {
      fs.appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `### ✅ Upstream Sync - Up to Date\n- **Current SHA:** \`${headSha.slice(0, 7)}\`\n- **Status:** Database is fully synced with \`${UPSTREAM_OWNER}/${UPSTREAM_REPO}\`.\n`
      );
    }
    process.exit(0);
  }

  if (isCheckOnly) {
    console.log(`\n🔔 Upstream has new commits to ingest: ${lastSha?.slice(0, 7) || 'init'} -> ${headSha.slice(0, 7)}`);
    console.log('Run without --check to perform the sync.');
    process.exit(0);
  }

  // 3. Determine changed files to ingest
  console.log(`\n[3/5] Inspecting changed files between ${lastSha ? lastSha.slice(0, 7) : 'root'} and ${headSha.slice(0, 7)}...`);
  const filesToProcess: ParsedFileTarget[] = [];
  let useFallbackTree = false;
  let comparedSuccessfully = false;

  if (lastSha && !isForce) {
    try {
      console.log(`Calling GitHub Compare API: ${lastSha}...${headSha}`);
      const compareData = await githubFetch(
        `/repos/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/compare/${lastSha}...${headSha}`
      );

      const changedFiles: Array<{ filename: string; status: string }> = compareData.files || [];
      console.log(`Compare API returned ${changedFiles.length} changed file(s).`);

      const csvChanges = changedFiles.filter(f => f.filename.endsWith('.csv') && f.status !== 'removed');
      console.log(`Found ${csvChanges.length} modified/added CSV file(s).`);

      for (const item of csvChanges) {
        const parts = item.filename.split('/');
        if (parts.length >= 2) {
          const companySlug = parts[0];
          const filename = parts.slice(1).join('/');
          console.log(`Fetching raw content for: ${item.filename}...`);
          const content = await fetchRawFile(item.filename, headSha);
          filesToProcess.push({ companySlug, filename, content });
        }
      }
      comparedSuccessfully = true;
    } catch (err: any) {
      console.warn(`Compare API failed (${err.message}). Falling back to repository tree scan.`);
      useFallbackTree = true;
    }
  } else {
    useFallbackTree = true;
  }

  // If compare was successful and no CSVs were changed, we don't need to parse any files
  if (comparedSuccessfully && filesToProcess.length === 0) {
    console.log(`\n✅ Upstream commit ${headSha.slice(0, 7)} contains no CSV dataset changes (e.g. documentation/README updates).`);
    console.log('Recording audit log and marking catalog as up to date...');

    const totalCompaniesCount = await prisma.company.count();
    const totalProblemsCount = await prisma.problem.count();
    const summary = `Upstream sync to ${headSha.slice(0, 7)}: No CSV dataset changes (commit: "${commitMsg}"). Catalog verified current.`;

    const syncRecord = await prisma.syncMetadata.create({
      data: {
        commitSha: headSha,
        syncedAt: new Date(),
        totalCompanies: totalCompaniesCount,
        totalProblems: totalProblemsCount,
        summary,
        updatedCompanySlugs: '',
      },
    });

    console.log(`Created SyncMetadata record ID: ${syncRecord.id}`);

    if (process.env.GITHUB_STEP_SUMMARY) {
      const md = `
### ⚡ Automated Upstream Sync Pipeline Report
- **Upstream Commit:** [\`${headSha.slice(0, 7)}\`](https://github.com/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/commit/${headSha})
- **Message:** ${commitMsg}
- **Author:** ${commitAuthor}
- **Status:** ✅ Up to date (No CSV changes in upstream commit)
- **Total Catalog Problems:** \`${totalProblemsCount}\`
- **Total Catalog Companies:** \`${totalCompaniesCount}\`
- **User Progress Safety:** ✅ 100% Intact
`;
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
    }

    process.exit(0);
  }

  // Fallback: If comparing failed or force mode is enabled
  if (useFallbackTree || filesToProcess.length === 0) {
    // Check if local directory exists first
    const localDir = path.resolve(__dirname, '../../');
    const localQuestionsDir = fs.existsSync(path.join(localDir, 'google')) ? localDir : null;

    if (localQuestionsDir) {
      console.log(`Ingesting from local repository files at: ${localQuestionsDir}`);
      const items = fs.readdirSync(localQuestionsDir);
      for (const item of items) {
        const itemPath = path.join(localQuestionsDir, item);
        if (fs.lstatSync(itemPath).isDirectory() && !item.startsWith('.')) {
          const csvs = fs.readdirSync(itemPath).filter(f => f.endsWith('.csv'));
          for (const csv of csvs) {
            const content = fs.readFileSync(path.join(itemPath, csv), 'utf-8');
            filesToProcess.push({ companySlug: item, filename: csv, content });
          }
        }
      }
    } else {
      console.log('Fetching upstream git tree via GitHub API (recursive)...');
      const treeData = await githubFetch(
        `/repos/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/git/trees/${headSha}?recursive=1`
      );
      const allFiles: Array<{ path: string; type: string }> = treeData.tree || [];
      const csvFiles = allFiles.filter(f => f.type === 'blob' && f.path.endsWith('.csv'));
      console.log(`Found ${csvFiles.length} total CSV files in upstream git tree.`);

      for (const f of csvFiles) {
        const parts = f.path.split('/');
        if (parts.length >= 2) {
          const companySlug = parts[0];
          const filename = parts.slice(1).join('/');
          const content = await fetchRawFile(f.path, headSha);
          filesToProcess.push({ companySlug, filename, content });
        }
      }
    }
  }

  console.log(`\nReady to parse and ingest ${filesToProcess.length} company CSV files.`);

  // 4. Parse CSV data and execute safe Prisma upserts
  console.log('\n[4/5] Ingesting problems and company pairings into Supabase PostgreSQL...');
  const affectedCompanies = new Set<string>();
  let totalProblemsUpserted = 0;
  let totalPairingsUpserted = 0;

  for (const fileItem of filesToProcess) {
    const { companySlug, filename, content } = fileItem;
    affectedCompanies.add(companySlug);

    // 4.1 Ensure Company exists
    const companyName = formatCompanyName(companySlug);
    const company = await prisma.company.upsert({
      where: { slug: companySlug },
      create: { slug: companySlug, name: companyName },
      update: { name: companyName },
    });

    const categoryFlags = categorizeFile(filename);

    const parsed = Papa.parse<ProblemCSVRow>(content, {
      header: true,
      skipEmptyLines: true,
    });

    for (const row of parsed.data) {
      const problemId = parseInt(row.ID, 10);
      if (isNaN(problemId)) continue;

      const title = row.Title ? row.Title.trim() : `Problem #${problemId}`;
      const url = row.URL ? row.URL.trim() : `https://leetcode.com/problems/${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      const difficulty = row.Difficulty ? row.Difficulty.trim() : 'Medium';

      let acceptance = 0.0;
      if (row['Acceptance %']) {
        acceptance = parseFloat(row['Acceptance %'].replace('%', ''));
        if (isNaN(acceptance)) acceptance = 0.0;
      }

      let frequency = 0.0;
      if (row['Frequency %']) {
        frequency = parseFloat(row['Frequency %'].replace('%', ''));
        if (isNaN(frequency)) frequency = 0.0;
      }

      const titleSlug = url.split('/problems/')[1]?.split('/')[0] || title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      // 4.2 Upsert Problem (Safely updates catalog metadata; never alters user solve states)
      await prisma.problem.upsert({
        where: { id: problemId },
        create: {
          id: problemId,
          title,
          url,
          titleSlug,
          difficulty,
          acceptance,
        },
        update: {
          title,
          url,
          titleSlug,
          difficulty,
          acceptance,
        },
      });
      totalProblemsUpserted++;

      // 4.3 Upsert CompanyProblem junction
      const existingPairing = await prisma.companyProblem.findUnique({
        where: {
          companyId_problemId: {
            companyId: company.id,
            problemId,
          },
        },
      });

      if (!existingPairing) {
        await prisma.companyProblem.create({
          data: {
            companyId: company.id,
            problemId,
            frequency,
            inThirtyDays: categoryFlags.isThirtyDays,
            inThreeMonths: categoryFlags.isThreeMonths,
            inSixMonths: categoryFlags.isSixMonths,
            inMoreThanSixMonths: categoryFlags.isMoreThanSixMonths,
            inAll: categoryFlags.isAll,
          },
        });
      } else {
        await prisma.companyProblem.update({
          where: {
            companyId_problemId: {
              companyId: company.id,
              problemId,
            },
          },
          data: {
            frequency: Math.max(existingPairing.frequency, frequency),
            inThirtyDays: existingPairing.inThirtyDays || categoryFlags.isThirtyDays,
            inThreeMonths: existingPairing.inThreeMonths || categoryFlags.isThreeMonths,
            inSixMonths: existingPairing.inSixMonths || categoryFlags.isSixMonths,
            inMoreThanSixMonths: existingPairing.inMoreThanSixMonths || categoryFlags.isMoreThanSixMonths,
            inAll: existingPairing.inAll || categoryFlags.isAll,
          },
        });
      }
      totalPairingsUpserted++;
    }
  }

  // 5. Record sync audit log in SyncMetadata
  console.log('\n[5/5] Creating SyncMetadata audit entry in Supabase...');
  const totalCompaniesCount = await prisma.company.count();
  const totalProblemsCount = await prisma.problem.count();
  const summary = `Upstream sync from commit ${headSha.slice(0, 7)}: ${affectedCompanies.size} companies refreshed, ${totalProblemsUpserted} problem instances verified.`;

  const syncRecord = await prisma.syncMetadata.create({
    data: {
      commitSha: headSha,
      syncedAt: new Date(),
      totalCompanies: totalCompaniesCount,
      totalProblems: totalProblemsCount,
      summary,
      updatedCompanySlugs: Array.from(affectedCompanies).slice(0, 50).join(','),
    },
  });

  console.log('\n====================================================');
  console.log('  ✅ Upstream Sync Successfully Completed!');
  console.log('====================================================');
  console.log(`Sync Record ID: ${syncRecord.id}`);
  console.log(`Commit SHA: ${headSha}`);
  console.log(`Companies Affected: ${affectedCompanies.size}`);
  console.log(`Total Companies in Catalog: ${totalCompaniesCount}`);
  console.log(`Total Problems in Catalog: ${totalProblemsCount}`);
  console.log(`Summary: ${summary}`);

  // Emit GitHub Step Summary if running in GitHub Actions
  if (process.env.GITHUB_STEP_SUMMARY) {
    const md = `
### ⚡ Automated Upstream Sync Pipeline Report
- **Upstream Commit:** [\`${headSha.slice(0, 7)}\`](https://github.com/${UPSTREAM_OWNER}/${UPSTREAM_REPO}/commit/${headSha})
- **Message:** ${commitMsg}
- **Author:** ${commitAuthor}
- **Timestamp:** ${new Date().toUTCString()}
- **Companies Refreshed:** \`${affectedCompanies.size}\`
- **Total Catalog Problems:** \`${totalProblemsCount}\`
- **Total Catalog Companies:** \`${totalCompaniesCount}\`
- **User Progress Safety:** ✅ 100% Intact (Non-destructive upsert)
`;
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  }
}

main()
  .catch((err) => {
    console.error('\n❌ Upstream Sync Error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
