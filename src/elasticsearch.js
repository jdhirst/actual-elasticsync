const { Client } = require('@elastic/elasticsearch');

const INDEX = 'finance-transactions';

let client;

function getClient() {
  if (!client) {
    client = new Client({
      node: process.env.ES_ENDPOINT,
      auth: { apiKey: process.env.ES_API_KEY },
    });
  }
  return client;
}

const INDEX_MAPPING = {
  mappings: {
    properties: {
      id:                   { type: 'keyword' },
      date:                 { type: 'date', format: 'yyyy-MM-dd' },
      amount:               { type: 'long' },       // raw integer (cents * 100 in Actual)
      amount_dollars:       { type: 'float' },       // amount / 100
      notes:                { type: 'text', fields: { keyword: { type: 'keyword' } } },
      cleared:              { type: 'boolean' },
      reconciled:           { type: 'boolean' },
      is_transfer:          { type: 'boolean' },
      transfer_id:          { type: 'keyword' },
      is_parent:            { type: 'boolean' },
      is_child:             { type: 'boolean' },
      parent_id:            { type: 'keyword' },
      account_id:           { type: 'keyword' },
      account_name:         { type: 'keyword' },
      account_type:         { type: 'keyword' },
      account_offbudget:    { type: 'boolean' },
      payee_id:             { type: 'keyword' },
      payee_name:           { type: 'keyword' },
      category_id:          { type: 'keyword' },
      category_name:        { type: 'keyword' },
      category_group_id:    { type: 'keyword' },
      category_group_name:  { type: 'keyword' },
      synced_at:            { type: 'date' },
    },
  },
};

async function ensureIndex() {
  const es = getClient();
  const exists = await es.indices.exists({ index: INDEX });
  if (!exists) {
    await es.indices.create({ index: INDEX, ...INDEX_MAPPING });
    console.log(`Created index: ${INDEX}`);
  } else {
    // Update mapping in case new fields were added
    await es.indices.putMapping({ index: INDEX, ...INDEX_MAPPING.mappings });
    console.log(`Index exists: ${INDEX}`);
  }
}

async function bulkIndex(docs) {
  if (docs.length === 0) return { indexed: 0, errors: 0 };

  const es = getClient();
  const operations = docs.flatMap((doc) => [
    { index: { _index: INDEX, _id: doc.id } },
    doc,
  ]);

  const result = await es.bulk({ operations, refresh: false });

  const errors = result.items.filter((i) => i.index?.error).length;
  if (errors > 0) {
    result.items
      .filter((i) => i.index?.error)
      .slice(0, 5)
      .forEach((i) => console.error('Index error:', i.index.error));
  }

  return { indexed: docs.length - errors, errors };
}

async function refreshIndex() {
  const es = getClient();
  await es.indices.refresh({ index: INDEX });
}

module.exports = { ensureIndex, bulkIndex, refreshIndex };
