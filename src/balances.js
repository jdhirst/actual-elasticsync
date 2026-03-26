/**
 * Computes end-of-day account balance snapshots from transaction history.
 *
 * One document is emitted per (account, date) pair where transactions occurred.
 * The balance is the running sum of all transactions up to and including that
 * date, so it reflects the true account balance assuming transactions start
 * from the beginning (Actual includes an opening "Starting Balance" transaction).
 */

const SYNC_TS = new Date().toISOString();

function computeBalanceSnapshots(allTransactions, accountMap) {
  // Group by account. allTransactions contains only top-level transactions;
  // sub-transactions are nested inside tx.subtransactions and are NOT included,
  // so balance arithmetic uses the correct parent amount for splits.
  const byAccount = {};
  for (const tx of allTransactions) {
    if (!tx.account) continue;
    (byAccount[tx.account] ??= []).push(tx);
  }

  const snapshots = [];

  for (const [accountId, txs] of Object.entries(byAccount)) {
    const account = accountMap[accountId] || {};

    // Sort chronologically so the running balance accumulates in order
    txs.sort((a, b) => a.date.localeCompare(b.date));

    // Accumulate balance, keeping only the end-of-day value per date
    let balance = 0;
    const dateBalance = new Map(); // date -> end-of-day balance

    for (const tx of txs) {
      balance += tx.amount;
      dateBalance.set(tx.date, balance);
    }

    for (const [date, bal] of dateBalance) {
      snapshots.push({
        id: `${accountId}_${date}`,
        date,
        balance: bal,
        balance_dollars: bal / 100,
        account_id: accountId,
        account_name: account.name || null,
        account_type: account.type || null,
        account_offbudget: account.offbudget ?? false,
        synced_at: SYNC_TS,
      });
    }
  }

  return snapshots;
}

module.exports = { computeBalanceSnapshots };
