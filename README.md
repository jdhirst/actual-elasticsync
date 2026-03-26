# actual-elasticsync

Syncs your [Actual Budget](https://actualbudget.org) data into an Elasticsearch index so you can run rich financial queries with Kibana or the ES API.

Each transaction is enriched with its account name, payee name, category, and category group — so you can filter and aggregate without any joins. Split transactions are indexed as both a parent document and individual child documents.

## Requirements

- Node.js 18+
- [pnpm](https://pnpm.io) (`npm install -g pnpm`)
- A self-hosted Actual Budget server
- An Elasticsearch cluster with an API key that has write access to `finance-*` indices

## Setup

```bash
cp .env.example .env
# Fill in your credentials (see below)
pnpm install
```

## Configuration

Copy `.env.example` to `.env` and fill in the values:

| Variable | Description |
|---|---|
| `ACTUAL_ENDPOINT` | URL of your self-hosted Actual Budget server |
| `ACTUAL_PASSWORD` | Your Actual Budget server password |
| `ACTUAL_BUDGET_ID` | Sync ID of the budget to sync (Settings → Show advanced settings → Sync ID) |
| `ES_ENDPOINT` | Elasticsearch endpoint URL including port |
| `ES_API_KEY` | Elasticsearch API key (Base64-encoded `id:key`) |

## Usage

**Full sync** — indexes all transactions from all accounts:
```bash
pnpm sync
```

**Sync from a specific date** — useful for incremental updates:
```bash
node src/sync.js --since 2025-01-01
```

On first run the `finance-transactions` Elasticsearch index is created automatically with a typed mapping. Re-running is safe — documents are upserted by transaction ID.

## Elasticsearch index

All transactions are indexed into `finance-transactions`. Each document has the following fields:

| Field | Type | Description |
|---|---|---|
| `id` | keyword | Transaction UUID (used as the document ID) |
| `date` | date | Transaction date (`YYYY-MM-DD`) |
| `amount` | long | Amount in cents (Actual's integer format, e.g. `$12.50` = `1250`) |
| `amount_dollars` | float | Amount as a decimal dollar value |
| `notes` | text | Transaction notes |
| `cleared` | boolean | Whether the transaction is cleared |
| `reconciled` | boolean | Whether the transaction is reconciled |
| `is_transfer` | boolean | Whether this is a transfer between accounts |
| `transfer_id` | keyword | ID of the corresponding transfer transaction |
| `is_parent` | boolean | True if this transaction has splits |
| `is_child` | boolean | True if this is a split sub-transaction |
| `parent_id` | keyword | ID of the parent split transaction |
| `account_id` | keyword | Account UUID |
| `account_name` | keyword | Account name |
| `account_type` | keyword | Account type (e.g. `checking`, `savings`, `credit`) |
| `account_offbudget` | boolean | Whether the account is off-budget |
| `payee_id` | keyword | Payee UUID |
| `payee_name` | keyword | Payee name |
| `category_id` | keyword | Category UUID |
| `category_name` | keyword | Category name |
| `category_group_id` | keyword | Category group UUID |
| `category_group_name` | keyword | Category group name |
| `synced_at` | date | Timestamp when this sync ran |

## Windows note

On Windows with Node 25+ and Visual Studio 2026, `better-sqlite3` (a dependency of `@actual-app/api`) may fail to compile. The `.npmrc` in this repo forces the VS2022 toolset which resolves this. You'll need Visual Studio 2022 or the VS2022 Build Tools installed.

## License

MIT — see [LICENSE](LICENSE).
