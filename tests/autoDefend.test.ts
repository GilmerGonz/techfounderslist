import { prisma } from '../lib/db';
import {
  createCompany,
  claimPosition,
  saveCompanyVaultId,
  subscribeAutoDefend,
  triggerAutoDefend,
  cancelAutoDefend,
  getAutoDefendStatus,
  AutoDefendUnavailableError,
  __setPaypalMocks,
} from '../lib/bids';

// Skip the owner-email/company-URL domain match check so we can use synthetic
// test companies without real domains.
process.env.ALLOW_DOMAIN_MISMATCH = '1';

if (!process.env.DATABASE_URL) {
  console.error(
    '\n❌ DATABASE_URL is not set. AutoDefend tests run against a REAL (test) Postgres.\n' +
      '   Point it at a throwaway database (NEVER production), run `prisma db push`, then:\n' +
      '   DATABASE_URL="postgresql://user:pass@host:5432/tfl_test" npx tsx tests/autoDefend.test.ts\n'
  );
  process.exit(1);
}

// ── PayPal mock (no real charges) ──────────────────────────────────────────────
let chargeCount = 0;
let refundCount = 0;
let lastChargeAmount: number | null = null;
let chargeShouldFail = false;

const paypalMock = {
  chargeVaultedPayPal: async (
    _vaultId: string,
    amountCents: number,
    _currency: string,
    _meta: unknown
  ) => {
    chargeCount++;
    if (chargeShouldFail) {
      const err: any = new Error('mock instrument declined');
      err.name = 'INSTRUMENT_DECLINED';
      throw err;
    }
    lastChargeAmount = amountCents;
    return { captureId: `mock-capture-${chargeCount}` };
  },
  refundPayPalCapture: async (_captureId: string, _amountCents: number) => {
    refundCount++;
    return { ok: true };
  },
};
__setPaypalMocks(paypalMock as any);

function resetPaypal(shouldFail = false) {
  chargeCount = 0;
  refundCount = 0;
  lastChargeAmount = null;
  chargeShouldFail = shouldFail;
}

// ── Test category + cleanup ────────────────────────────────────────────────────
const slug = `tfl-autodefend-test-${Date.now()}`;
let CAT = '';

async function cleanup() {
  await prisma.autoDefendSubscription.deleteMany({ where: { categoryId: CAT } });
  await prisma.positionClaim.deleteMany({ where: { categoryId: CAT } });
  await prisma.positionHistory.deleteMany({ where: { categoryId: CAT } });
  await prisma.currentIndex.deleteMany({ where: { categoryId: CAT } });
  await prisma.company.deleteMany({ where: { categoryId: CAT } });
}

async function makeCompany(name: string): Promise<string> {
  const company = await createCompany({
    categoryId: CAT,
    name,
    url: `https://${name.toLowerCase()}.com`,
    ownerEmail: `owner@${name.toLowerCase()}.com`,
  });
  return company.id;
}

function holderOf(position: number) {
  return prisma.currentIndex.findUnique({
    where: { category_id_position: { categoryId: CAT, position } },
  });
}

let passed = 0;
function ok(cond: any, msg: string) {
  if (!cond) {
    console.error(`  ❌ ${msg}`);
    process.exit(1);
  }
  console.log(`  ✅ ${msg}`);
  passed++;
}

async function runTests() {
  console.log('🧪 AutoDefend tests (real DB, mocked PayPal)\n');

  // ── Test 1: successful subscription ─────────────────────────────────────────
  console.log('Test 1: subscribeAutoDefend success');
  await cleanup();
  resetPaypal();
  const c1 = await makeCompany('Alpha');
  await saveCompanyVaultId(c1, 'vault-1');
  const sub = await subscribeAutoDefend({
    companyId: c1,
    categoryId: CAT,
    position: 1,
    maxAmountCents: 5000,
  });
  ok(sub.active === true, 'subscription is active');
  ok(sub.maxAmountCents === 5000, 'maxAmountCents stored');
  ok(sub.paypalVaultId === 'vault-1', 'paypalVaultId snapshotted from company');

  const status = await getAutoDefendStatus({ companyId: c1, categoryId: CAT, position: 1 });
  ok(status?.active === true, 'getAutoDefendStatus reports active');

  // ── Test 2: rejections ──────────────────────────────────────────────────────
  console.log('\nTest 2: subscription rejections');
  await cleanup();
  resetPaypal();
  const c2 = await makeCompany('Beta');
  let threwUnavailable = false;
  try {
    await subscribeAutoDefend({ companyId: c2, categoryId: CAT, position: 1, maxAmountCents: 5000 });
  } catch (e) {
    threwUnavailable = e instanceof AutoDefendUnavailableError;
  }
  ok(threwUnavailable, 'no vault id → AutoDefendUnavailableError');

  const statusAfterFail = await getAutoDefendStatus({ companyId: c2, categoryId: CAT, position: 1 });
  ok(statusAfterFail === null, 'no subscription row created on failure');

  let threwAmount = false;
  try {
    await saveCompanyVaultId(c2, 'vault-2');
    await subscribeAutoDefend({ companyId: c2, categoryId: CAT, position: 1, maxAmountCents: 50 });
  } catch (e: any) {
    threwAmount = /maxAmountCents must be an integer >=/.test(e.message);
  }
  ok(threwAmount, 'maxAmountCents below floor is rejected');

  // ── Test 3: displacement triggers auto-rebuy ────────────────────────────────
  console.log('\nTest 3: displacement triggers automatic re-claim');
  await cleanup();
  resetPaypal();
  const cG = await makeCompany('Gamma');
  await saveCompanyVaultId(cG, 'v-g');
  await claimPosition(cG, CAT, 1, 100); // Gamma holds pos 1 @ $1.00
  await subscribeAutoDefend({ companyId: cG, categoryId: CAT, position: 1, maxAmountCents: 5000 });

  const cD = await makeCompany('Delta');
  await claimPosition(cD, CAT, 1, 200); // Delta displaces Gamma to pos 2
  ok((await holderOf(1))?.companyId === cD, 'Delta is now holder before AutoDefend');

  await triggerAutoDefend(CAT, 1, cG);
  ok(chargeCount === 1, 'exactly one vault charge occurred');
  ok(lastChargeAmount === 300, 'charged the min-required $3.00 (200 + 100)');
  ok((await holderOf(1))?.companyId === cG, 'Gamma auto-reclaimed position 1');

  // ── Test 4: maxAmountCents ceiling respected ────────────────────────────────
  console.log('\nTest 4: maxAmountCents ceiling prevents over-charging');
  await cleanup();
  resetPaypal();
  const cE = await makeCompany('Epsilon');
  await saveCompanyVaultId(cE, 'v-e');
  await claimPosition(cE, CAT, 1, 500); // Epsilon holds @ $5.00 (min req $6.00)
  // Cap of $2.50 is far below the $6.00 needed to reclaim.
  await subscribeAutoDefend({ companyId: cE, categoryId: CAT, position: 1, maxAmountCents: 250 });

  const cZ = await makeCompany('Zeta');
  await claimPosition(cZ, CAT, 1, 600); // Zeta displaces Epsilon (min req now $7.00)
  await triggerAutoDefend(CAT, 1, cE);
  ok(chargeCount === 0, 'no charge attempted when required > ceiling');
  ok((await holderOf(1))?.companyId === cZ, 'Zeta remains holder');
  const stillActive = await getAutoDefendStatus({ companyId: cE, categoryId: CAT, position: 1 });
  ok(stillActive?.active === true, 'subscription stays active (only skipped, not disabled)');

  // ── Test 5: recursion depth limit between two subscribers ───────────────────
  console.log('\nTest 5: recursion depth limit (MAX_AUTODEFEND_CHAIN_DEPTH = 3)');
  await cleanup();
  resetPaypal();
  const a = await makeCompany('SubA');
  await saveCompanyVaultId(a, 'v-a');
  await claimPosition(a, CAT, 1, 100);
  await subscribeAutoDefend({ companyId: a, categoryId: CAT, position: 1, maxAmountCents: 100000 });

  const b = await makeCompany('SubB');
  await saveCompanyVaultId(b, 'v-b');
  await claimPosition(b, CAT, 1, 200); // b displaces a; both subscribed at pos 1
  await subscribeAutoDefend({ companyId: b, categoryId: CAT, position: 1, maxAmountCents: 100000 });

  // Simulate b's claim having displaced a → fire the chain from a's perspective.
  await triggerAutoDefend(CAT, 1, a);
  ok(chargeCount === 3, 'chain stopped at exactly 3 charges (depth 0,1,2)');
  ok((await holderOf(1))?.companyId === a, 'after the bounded chain, SubA ends as holder');

  // ── Test 6: charge failure disables the subscription ────────────────────────
  console.log('\nTest 6: failed vault charge disables subscription');
  await cleanup();
  resetPaypal(true); // force decline
  const cH = await makeCompany('Eta');
  await saveCompanyVaultId(cH, 'v-h');
  await claimPosition(cH, CAT, 1, 100);
  await subscribeAutoDefend({ companyId: cH, categoryId: CAT, position: 1, maxAmountCents: 5000 });

  const cT = await makeCompany('Theta');
  await claimPosition(cT, CAT, 1, 200);
  await triggerAutoDefend(CAT, 1, cH);
  ok(chargeCount === 1, 'one charge attempt happened (then declined)');
  const disabled = await getAutoDefendStatus({ companyId: cH, categoryId: CAT, position: 1 });
  ok(disabled?.active === false, 'subscription auto-disabled after declined charge');
  ok((await holderOf(1))?.companyId === cT, 'Theta keeps the position (no reclaim)');

  // ── Test 7: cancelAutoDefend ────────────────────────────────────────────────
  console.log('\nTest 7: cancelAutoDefend');
  await cleanup();
  resetPaypal();
  const cK = await makeCompany('Kappa');
  await saveCompanyVaultId(cK, 'v-k');
  await claimPosition(cK, CAT, 1, 100);
  await subscribeAutoDefend({ companyId: cK, categoryId: CAT, position: 1, maxAmountCents: 5000 });
  await cancelAutoDefend({ companyId: cK, categoryId: CAT, position: 1 });
  const cancelled = await getAutoDefendStatus({ companyId: cK, categoryId: CAT, position: 1 });
  ok(cancelled?.active === false, 'subscription marked inactive after cancel');

  await cleanup();
  console.log(`\n✨ ALL ${passed} AUTO-DEFEND ASSERTIONS PASSED ✨\n`);
}

async function main() {
  const category = await prisma.category.create({
    data: { slug, name: 'AutoDefend Test' },
  });
  CAT = category.id;
  await runTests();
}

main()
  .catch((err) => {
    console.error('AutoDefend test suite failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
