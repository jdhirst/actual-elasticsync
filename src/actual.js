const api = require('@actual-app/api');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');

async function connect() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  await api.init({
    dataDir: DATA_DIR,
    serverURL: process.env.ACTUAL_ENDPOINT,
    password: process.env.ACTUAL_PASSWORD,
  });

  await api.downloadBudget(process.env.ACTUAL_BUDGET_ID);
  console.log('Connected to Actual Budget');
}

async function disconnect() {
  await api.shutdown();
  console.log('Disconnected from Actual Budget');
}

async function fetchAllData() {
  const [accounts, categoryGroups, payees] = await Promise.all([
    api.getAccounts(),
    api.getCategoryGroups(),
    api.getPayees(),
  ]);

  // Build lookup maps for enrichment
  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a]));
  const payeeMap = Object.fromEntries(payees.map((p) => [p.id, p]));

  const categoryMap = {};
  const categoryGroupMap = Object.fromEntries(categoryGroups.map((g) => [g.id, g]));
  for (const group of categoryGroups) {
    for (const cat of group.categories || []) {
      categoryMap[cat.id] = { ...cat, groupId: group.id, groupName: group.name };
    }
  }

  return { accounts, accountMap, payeeMap, categoryMap, categoryGroupMap };
}

async function fetchTransactions(accountId, startDate, endDate) {
  return api.getTransactions(accountId, startDate, endDate);
}

module.exports = { connect, disconnect, fetchAllData, fetchTransactions };
