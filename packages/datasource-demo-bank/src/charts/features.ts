/**
 * The feature explainers' live figures: the API chart `feature_facts`, read by the demo layout's
 * explainers (one hidden workspace per Forest feature, opened from the Hub).
 *
 * - featureFacts(): the size of a few tables, the tasks waiting in every segment queue
 *   (segments.ts) and the number of Smart Actions.
 * - withFeatureSource(factory): remembers the finished data source, for the Smart Actions count.
 */
import { SEGMENTS } from '../customizations/shared/segments';

// The tables whose size the explainers quote, read live.
const RECORD_TABLES = [
  'customers',
  'accounts',
  'transactions',
  'kyc_cases',
  'documents',
  'alerts',
  'outgoing_transfers',
];

const sum = list => list.reduce((a, b) => a + b, 0);

/**
 * The live figures. `count(table, tree)` counts a table's rows (all of them when `tree` is null);
 * `actionCount()` counts the Smart Actions the agent declares.
 */
async function featureFacts({ count, actionCount }, now = new Date()) {
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

  return { records, queues, actions: { total: await actionCount() }, at: now.toISOString() };
}

// The lab's finished data source: charts sit below Smart Actions in the customizer's stack, so the
// chart's own context sees no action. withFeatureSource() keeps the top one for it.
let topDataSource = null;

/** Wraps the lab's data source factory to remember what it builds. */
function withFeatureSource(factory) {
  return async (...args) => {
    topDataSource = await factory(...args);

    return topDataSource;
  };
}

/** The API chart the explainers read: `GET /forest/_charts/feature_facts`. */
function addFeatureChart(customizer) {
  customizer.addChart('feature_facts', async (context, resultBuilder) => {
    const count = async (table, conditionTree) => {
      const [row] = await context.dataSource
        .getCollection(table)
        .aggregate(conditionTree ? { conditionTree } : {}, { operation: 'Count' });

      return Number(row?.value ?? 0);
    };

    const actionCount = () =>
      topDataSource
        ? sum(topDataSource.collections.map(c => Object.keys(c.schema.actions).length))
        : undefined;

    return resultBuilder.smart(await featureFacts({ count, actionCount }));
  });
}

export { addFeatureChart, withFeatureSource };
