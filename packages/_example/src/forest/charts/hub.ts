import type { Schema } from '../typings';
import type { DataSourceCustomizer } from '@forestadmin/agent';

import { QUEUES } from '../queues';

const DEADLINES = {
  kyc_cases: 'due_at',
  alerts: 'due_at',
  investigations: 'due_at',
  chargebacks: 'representment_deadline',
};
const PRIMARY_KEYS = { kyc_cases: '_id' };
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_LENGTH = 10;

function isPast(value: unknown, now: Date) {
  if (value === null || value === undefined || value === '') return false;
  const text = value instanceof Date ? value.toISOString() : String(value);
  if (DATE_ONLY.test(text)) return text < now.toISOString().slice(0, DATE_LENGTH);
  const time = Date.parse(text);

  return !Number.isNaN(time) && time < now.getTime();
}

const listRows = (dataSource, table: string, conditionTree, fields: string[]) =>
  dataSource.getCollection(table).list({ conditionTree }, [PRIMARY_KEYS[table] ?? 'id', ...fields]);

async function hubCounts(dataSource, now = new Date()) {
  const queues = await Promise.all(
    Object.entries(QUEUES).map(async ([key, [table, , tree]]) => {
      const deadline = DEADLINES[table];
      const rows = await listRows(dataSource, table, tree, deadline ? [deadline] : []);

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

export default function addHubChart(customizer: DataSourceCustomizer<Schema>) {
  customizer.addChart('hub_counts', async (context, resultBuilder) =>
    resultBuilder.smart(await hubCounts(context.dataSource)),
  );
}
