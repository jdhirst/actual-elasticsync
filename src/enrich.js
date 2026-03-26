const SYNC_TS = new Date().toISOString();

/**
 * Enrich a raw Actual transaction with human-readable fields from lookup maps.
 * Handles both regular transactions and split sub-transactions.
 */
function enrichTransaction(tx, { accountMap, payeeMap, categoryMap }, parentId = null, subscriptions = {}) {
  const account = accountMap[tx.account] || {};
  const payee = payeeMap[tx.payee] || {};
  const category = categoryMap[tx.category] || {};

  const amountRaw = tx.amount ?? 0; // Actual stores as integer (milliunits / 100 = dollars)
  const amountDollars = amountRaw / 100;

  return {
    id: tx.id,
    date: tx.date,
    amount: amountRaw,
    amount_dollars: amountDollars,
    notes: tx.notes || null,
    cleared: tx.cleared ?? false,
    reconciled: tx.reconciled ?? false,
    is_transfer: !!tx.transfer_id,
    transfer_id: tx.transfer_id || null,
    is_parent: !!(tx.subtransactions && tx.subtransactions.length > 0),
    is_child: !!parentId,
    parent_id: parentId || null,

    account_id: tx.account || null,
    account_name: account.name || null,
    account_type: account.type || null,
    account_offbudget: account.offbudget ?? false,

    payee_id: tx.payee || null,
    payee_name: payee.name || null,

    is_subscription: !!(tx.payee && subscriptions[tx.payee]),
    subscription_cadence: subscriptions[tx.payee]?.cadence || null,
    subscription_typical_amount: subscriptions[tx.payee]?.typical_amount ?? null,
    subscription_typical_amount_dollars: subscriptions[tx.payee]?.typical_amount_dollars ?? null,

    category_id: tx.category || null,
    category_name: category.name || null,
    category_group_id: category.groupId || null,
    category_group_name: category.groupName || null,

    synced_at: SYNC_TS,
  };
}

/**
 * Flatten a transaction (and its subtransactions) into a list of enriched docs.
 * Parent transactions are indexed with their own data; children are indexed separately
 * with a parent_id reference so you can query either level.
 */
function flattenTransaction(tx, lookups, subscriptions = {}) {
  const docs = [];
  const enriched = enrichTransaction(tx, lookups, null, subscriptions);
  docs.push(enriched);

  if (tx.subtransactions && tx.subtransactions.length > 0) {
    for (const sub of tx.subtransactions) {
      // Sub-transactions inherit account from parent
      const subWithAccount = { ...sub, account: tx.account };
      docs.push(enrichTransaction(subWithAccount, lookups, tx.id, subscriptions));
    }
  }

  return docs;
}

module.exports = { flattenTransaction };
