require('dotenv').config();

const { connect, disconnect, fetchAllData, fetchTransactions } = require('./actual');
const { ensureIndex, bulkIndex, refreshIndex } = require('./elasticsearch');
const { flattenTransaction } = require('./enrich');

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
    await ensureIndex();

    const lookups = await fetchAllData();
    const { accounts } = lookups;

    console.log(`Found ${accounts.length} accounts`);

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

    for (const account of accounts) {
      process.stdout.write(`  Syncing "${account.name}"... `);

      const transactions = await fetchTransactions(account.id, startDate, endDate);
      let count = 0;

      for (const tx of transactions) {
        const docs = flattenTransaction(tx, lookups);
        batch.push(...docs);
        count += docs.length;

        if (batch.length >= BATCH_SIZE) {
          await flushBatch();
        }
      }

      console.log(`${transactions.length} transactions (${count} docs)`);
    }

    await flushBatch();
    await refreshIndex();

    console.log(`\nDone. Indexed: ${totalIndexed}, Errors: ${totalErrors}`);
  } finally {
    await disconnect();
  }
}

sync().catch((err) => {
  console.error('Sync failed:', err);
  process.exit(1);
});
