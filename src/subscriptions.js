/**
 * Detects subscription/recurring payments from transaction history.
 *
 * For each payee, sorts their expense transactions by date and computes the
 * intervals between consecutive payments. If the median interval matches a
 * known cadence (weekly → annual) and at least 60% of intervals fall within
 * the tolerance window, the payee is flagged as a subscription.
 */

const PERIODS = [
  { name: 'weekly',      days: 7,      tolerance: 2  },
  { name: 'biweekly',    days: 14,     tolerance: 3  },
  { name: 'monthly',     days: 30.5,   tolerance: 5  },
  { name: 'quarterly',   days: 91.25,  tolerance: 10 },
  { name: 'semiannual',  days: 182.5,  tolerance: 15 },
  { name: 'annual',      days: 365,    tolerance: 25 },
];

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * @param {object[]} allTransactions  Raw Actual transactions (top-level only, not sub-transactions)
 * @returns {object}  Map of payee_id → { cadence, typical_amount, typical_amount_dollars }
 */
function detectSubscriptions(allTransactions) {
  // Group expense transactions by payee, skipping transfers
  const byPayee = {};
  for (const tx of allTransactions) {
    if (!tx.payee || tx.transfer_id || tx.amount >= 0) continue;
    (byPayee[tx.payee] ??= []).push(tx);
  }

  const subscriptions = {};

  for (const [payeeId, txs] of Object.entries(byPayee)) {
    if (txs.length < 2) continue;

    txs.sort((a, b) => a.date.localeCompare(b.date));

    // Compute day intervals between consecutive transactions
    const intervals = [];
    for (let i = 1; i < txs.length; i++) {
      intervals.push(
        (new Date(txs[i].date) - new Date(txs[i - 1].date)) / MS_PER_DAY
      );
    }

    const med = median(intervals);

    // Skip payees where transactions cluster on the same or adjacent days
    // (e.g. multiple charges in one shopping trip — not a subscription)
    if (med < 5) continue;

    let matched = null;
    for (const period of PERIODS) {
      if (Math.abs(med - period.days) > period.tolerance) continue;

      // Require ≥60% of intervals to be within 2× tolerance of the period
      const inRange = intervals.filter(
        (d) => Math.abs(d - period.days) <= period.tolerance * 2
      );
      if (inRange.length / intervals.length >= 0.6) {
        matched = period;
        break;
      }
    }

    if (!matched) continue;

    const typicalAmount = median(txs.map((t) => t.amount));
    subscriptions[payeeId] = {
      cadence: matched.name,
      typical_amount: typicalAmount,
      typical_amount_dollars: typicalAmount / 100,
    };
  }

  return subscriptions;
}

module.exports = { detectSubscriptions };
