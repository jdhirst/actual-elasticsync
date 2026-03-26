require('dotenv').config();

const { connect, disconnect, fetchAllData, fetchTransactions } = require('./actual');
const { ensureIndex, bulkIndex, refreshIndex,
        ensureBalancesIndex, bulkIndexBalances, refreshBalancesIndex } = require('./elasticsearch');
const { flattenTransaction } = require('./enrich');
const { detectSubscriptions } = require('./subscriptions');
const { computeBalanceSnapshots } = require('./balances');

const BATCH_SIZE = 500;
const DEFAULT_START_DATE = '2000-01-01';

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function sync() {
  const args = process.argv.slice(2);
  const fullSync = args.includes('--full');

  // Allow overriding start date: node sync.js --since 2024-01-01
  const sinceIdx = args.indexOf('--since');
  const startDate = sinceIdx !== -1 ? args[sinceIdx + 1] : DEFAULT_START_DATE;
  const endDate = today();

  console.log(`\nActual → Elasticsearch sync`);
  console.log(`Date range: ${startDate} → ${endDate}`);
  console.log(`Mode: ${fullSync ? 'full (re-index all)' : 'incremental'}\n`);

  await connect();

  try {
    await Promise.all([ensureIndex(), ensureBalancesIndex()]);

    const lookups = await fetchAllData();
    const { accounts } = lookups;

    console.log(`Found ${accounts.length} accounts`);

    // Fetch all transactions into memory first so subscription detection
    // can analyse the full history across all accounts before indexing.
    const allTransactions = [];
    for (const account of accounts) {
      process.stdout.write(`  Fetching "${account.name}"... `);
      const txs = await fetchTransactions(account.id, startDate, endDate);
      allTransactions.push(...txs);
      console.log(`${txs.length} transactions`);
    }

    const subscriptions = detectSubscriptions(allTransactions);
    console.log(`\nDetected ${Object.keys(subscriptions).length} subscription payees`);

    // Enrich and bulk-index
    let totalIndexed = 0;
    let totalErrors = 0;
    let batch = [];

    const flushBatch = async () => {
      if (batch.length === 0) return;
      const { indexed, errors } = await bulkIndex(batch);
      totalIndexed += indexed;
      totalErrors += errors;
      batch = [];
    };

    for (const tx of allTransactions) {
      const docs = flattenTransaction(tx, lookups, subscriptions);
      batch.push(...docs);
      if (batch.length >= BATCH_SIZE) await flushBatch();
    }

    await flushBatch();
    await refreshIndex();

    console.log(`\nDone. Indexed: ${totalIndexed}, Errors: ${totalErrors}`);

    // Account balance snapshots
    const snapshots = computeBalanceSnapshots(allTransactions, lookups.accountMap);
    const balResult = await bulkIndexBalances(snapshots);
    await refreshBalancesIndex();
    console.log(`Balance snapshots: ${balResult.indexed} indexed across ${accounts.length} accounts, ${balResult.errors} errors`);
  } finally {
    await disconnect();
  }
}

sync().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
