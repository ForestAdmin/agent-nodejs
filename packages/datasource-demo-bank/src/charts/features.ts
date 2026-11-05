/**
 * The API chart `feature_facts` (`GET /forest/_charts/feature_facts`): a few headline figures of
 * the demo's data, counted live: the size of a few tables and the tasks waiting in every queue
 * (segments.ts).
 */
import { SEGMENTS } from '../customizations/shared/segments';

// The tables whose size the chart gives.
const RECORD_TABLES = [
  'customers',
  'accounts',
  'transactions',
  'kyc_cases',
  'documents',
  'alerts',
  'outgoing_transfers',
];

/** The figures. `count(table, tree)` counts a table's rows (all of them when `tree` is null). */
async function featureFacts({ count }, now = new Date()) {
  const records = {};
  const queues = {};
  await Promise.all([
    ...RECORD_TABLES.map(async t => {
      records[t] = await count(t, null);
    }),
    ...Object.entries(SEGMENTS).map(async ([key, [table, , tree]]) => {
      queues[key] = await count(table, tree);
    }),
  ]);

  return { records, queues, at: now.toISOString() };
}

function addFeatureChart(customizer) {
  customizer.addChart('feature_facts', async (context, resultBuilder) => {
    const count = async (table, conditionTree) => {
      const [row] = await context.dataSource
        .getCollection(table)
        .aggregate(conditionTree ? { conditionTree } : {}, { operation: 'Count' });

      return Number(row?.value ?? 0);
    };

    return resultBuilder.smart(await featureFacts({ count }));
  });
}

// eslint-disable-next-line import/prefer-default-export
export { addFeatureChart };
