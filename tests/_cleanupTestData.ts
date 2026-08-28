import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/db';

// Load DATABASE_URL from .env (same source the app/tests resolve to).
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?\s*$/);
    if (m) process.env.DATABASE_URL = m[1].trim();
  }
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not found in .env');
  process.exit(1);
}

async function main() {
  const cats = await prisma.category.findMany({
    where: { slug: { startsWith: 'tfl-autodefend-test-' } },
    select: { id: true, slug: true },
  });

  if (cats.length === 0) {
    console.log('✅ No AutoDefend test data to clean up.');
    return;
  }

  for (const c of cats) {
    const ids = { categoryId: c.id };
    await prisma.autoDefendSubscription.deleteMany({ where: ids });
    await prisma.positionClaim.deleteMany({ where: ids });
    await prisma.positionHistory.deleteMany({ where: ids });
    await prisma.currentIndex.deleteMany({ where: ids });
    await prisma.company.deleteMany({ where: ids });
    await prisma.category.delete({ where: { id: c.id } });
    console.log(`🧹 Cleaned test category ${c.slug}`);
  }
  console.log(`✅ Removed ${cats.length} test categor(ies) and all child rows.`);
}

main()
  .catch((e) => {
    console.error('Cleanup failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
