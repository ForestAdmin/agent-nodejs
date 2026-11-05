/**
 * The queue counts: the API chart `hub_counts`.
 *
 * - hubCounts(listRows): per queue (segments.ts, by key), the tasks waiting in it and how many are
 *   past their deadline.
 */
import { SEGMENTS } from '../customizations/shared/segments';

// Where a task is late: the queue's table and the field holding its deadline.
const DEADLINES = {
  kyc_cases: 'due_at',
  information_requests: 'due_at',
  alerts: 'due_at',
  investigations: 'due_at',
  outgoing_transfers: 'requested_execution_date',
  sepa_disputes: 'response_due',
  chargebacks: 'representment_deadline',
};

/** A date-only deadline is late from the next day; a date and time, from that moment. */
function isPast(value, now) {
  if (value === null || value === undefined || value === '') return false;
  const text = value instanceof Date ? value.toISOString() : String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text < now.toISOString().slice(0, 10);
  const time = Date.parse(text);

  return !Number.isNaN(time) && time < now.getTime();
}

/**
 * Counts per queue. `listRows(table, conditionTree, fields)` returns the rows of one queue with
 * those fields (collection.list in the agent).
 */
async function hubCounts(listRows, now = new Date()) {
  const queues = await Promise.all(
    Object.entries(SEGMENTS).map(async ([key, [table, , tree]]: [string, any]) => {
      const deadline = DEADLINES[table];
      const rows = await listRows(table, tree, deadline ? [deadline] : []);

      return [
        key,
        {
          waiting: rows.length,
          overdue: deadline ? rows.filter(row => isPast(row[deadline], now)).length : 0,
          hasDeadline: Boolean(deadline),
        },
      ];
    }),
  );

  return { at: now.toISOString(), queues: Object.fromEntries(queues) };
}

/** The API chart `GET /forest/_charts/hub_counts`. */
function addHubChart(customizer) {
  customizer.addChart('hub_counts', async (context, resultBuilder) => {
    const listRows = (table, conditionTree, fields) =>
      context.dataSource.getCollection(table).list({ conditionTree }, ['id', ...fields]);

    return resultBuilder.smart(await hubCounts(listRows));
  });
}

// eslint-disable-next-line import/prefer-default-export
export { addHubChart };
