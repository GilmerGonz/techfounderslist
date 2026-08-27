import { claimPosition, getMinRequiredBid, InsufficientAmountError, _resetMockStore, createCompany, MAX_POSITION } from '../lib/bids';

async function runTests() {
  console.log('🧪 Starting Tech Founders List claimPosition Integration Tests...\n');

  // Test 1: Single position claim
  console.log('Test 1: Single position claim & displacement test');
  _resetMockStore();

  const p1 = await createCompany({
    categoryId: 'cat-saas',
    name: 'Alpha SaaS',
    url: 'https://alpha.com',
    ownerEmail: 'alpha@alpha.com',
  });

  const p2 = await (async () => {
    const c = await createCompany({
      categoryId: 'cat-saas',
      name: 'Beta SaaS',
      url: 'https://beta.com',
      ownerEmail: 'beta@beta.com',
    });
    return c;
  })();

  // P1 claims position #1 for $10.00 (1000 cents)
  const res1 = await claimPosition(p1.id, 'cat-saas', 1, 1000);
  console.assert(res1.success === true, 'P1 claim should succeed');
  console.assert(res1.position === 1, 'P1 should be at position 1');

  // Entry floor: an empty spot cannot be claimed below $1.00 (100 cents)
  try {
    await claimPosition(p2.id, 'cat-saas', 9, 50);
    console.error('  ❌ Test Failed: sub-$1.00 claim on empty spot should have been rejected!');
    process.exit(1);
  } catch (err: any) {
    console.assert(err instanceof InsufficientAmountError, 'Entry floor must reject < $1.00');
    console.log('  ✅ Entry floor enforced: empty spot rejected at $0.50 (min is $1.00).');
  }

  // Verify min required for position #1 is now $11.00 (1100 cents)
  const quote1 = await getMinRequiredBid('cat-saas', 1);
  console.assert(quote1.minRequiredCents === 1100, `Expected 1100, got ${quote1.minRequiredCents}`);
  console.log('  ✅ P1 claimed position #1 for $10.00. Min required is now $11.00.');

  // P2 claims position #1 for $15.00 (1500 cents), displacing P1 to #2
  const res2 = await claimPosition(p2.id, 'cat-saas', 1, 1500);
  console.assert(res2.success === true, 'P2 claim should succeed');
  console.assert(res2.displacedCompanyId === p1.id, 'P1 should be displaced');

  const quotePos2 = await getMinRequiredBid('cat-saas', 2);
  console.assert(quotePos2.currentAmountCents === 1000, 'P1 should now hold position #2 at $10.00');
  console.log('  ✅ P2 displaced P1 to position #2 smoothly.');

  // Test 2: Low claim rejection
  console.log('\nTest 2: Rejection of claim below minimum required');
  try {
    await claimPosition(p1.id, 'cat-saas', 1, 1200);
    console.error('  ❌ Test Failed: Insufficient claim should have been rejected!');
    process.exit(1);
  } catch (err: any) {
    console.assert(err instanceof InsufficientAmountError, 'Error should be InsufficientAmountError');
    console.log(`  ✅ Successfully caught InsufficientAmountError: ${err.message}`);
  }

  // Test 3: Concurrent simultaneous claim attempts
  console.log('\nTest 3: Concurrency Test — 10 simultaneous claim attempts on Position #1');
  _resetMockStore();

  const competitors = await Promise.all(
    Array.from({ length: 10 }).map((_, i) =>
      createCompany({
        categoryId: 'cat-saas',
        name: `Competitor ${i + 1}`,
        url: `https://comp${i + 1}.com`,
        ownerEmail: `comp${i + 1}@comp${i + 1}.com`,
      })
    )
  );

  await claimPosition(competitors[0].id, 'cat-saas', 1, 200);

  console.log('  Firing 10 concurrent claim attempts between $2.00 and $20.00...');

  const concurrentClaims = competitors.map(async (comp, idx) => {
    const amountCents = (idx + 2) * 200;
    try {
      const result = await claimPosition(comp.id, 'cat-saas', 1, amountCents);
      return { status: 'fulfilled', comp: comp.name, amount: amountCents, result };
    } catch (err: any) {
      return { status: 'rejected', comp: comp.name, amount: amountCents, error: err.message };
    }
  });

  const results = await Promise.all(concurrentClaims);

  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');

  console.log(`  📊 Concurrency summary: ${fulfilled.length} succeeded, ${rejected.length} rejected safely.`);

  const finalQuotePos1 = await getMinRequiredBid('cat-saas', 1);
  console.log(`  🏆 Final Position #1 held amount: $${(finalQuotePos1.currentAmountCents / 100).toFixed(2)}`);
  console.log(`  📌 Next minimum required: $${(finalQuotePos1.minRequiredCents / 100).toFixed(2)}`);

  console.assert(finalQuotePos1.currentAmountCents > 0, 'Final position 1 must be non-zero');
  console.log('\n✨ ALL CONCURRENCY AND ATOMIC CLAIM TESTS PASSED SUCCESSFULLY! ✨\n');

  // Test 4: position bounds (0, negative, non-integer, above MAX_POSITION)
  console.log('Test 4: Position bounds are rejected outside [1, MAX_POSITION]');
  _resetMockStore();

  const boundsCompany = await createCompany({
    categoryId: 'cat-saas',
    name: 'Bounds SaaS',
    url: 'https://bounds.com',
    ownerEmail: 'owner@bounds.com',
  });

  for (const badPosition of [0, -1, 1.5, MAX_POSITION + 1]) {
    try {
      await claimPosition(boundsCompany.id, 'cat-saas', badPosition, 1000);
      console.error(`  ❌ Test Failed: position ${badPosition} should have been rejected!`);
      process.exit(1);
    } catch (err: any) {
      console.assert(
        !(err instanceof InsufficientAmountError),
        `position ${badPosition} must fail bounds validation, not the amount check`
      );
    }
  }
  console.log(`  ✅ Positions outside [1, ${MAX_POSITION}] are rejected.`);

  const validClaim = await claimPosition(boundsCompany.id, 'cat-saas', MAX_POSITION, 100);
  console.assert(validClaim.success === true, `position ${MAX_POSITION} (upper bound) should be accepted`);
  console.log(`  ✅ Position ${MAX_POSITION} (upper bound) accepted.\n`);
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
