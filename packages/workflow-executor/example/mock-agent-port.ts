import type {
  AgentPort,
  ExecuteActionQuery,
  GetRecordQuery,
  GetRelatedDataQuery,
  UpdateRecordQuery,
} from '../src/ports/agent-port';
import type { StepUser } from '../src/types/execution';
import type { RecordData } from '../src/types/record';

import { RECORDS } from './scenario';

export default class MockAgentPort implements AgentPort {
  // eslint-disable-next-line no-console, @typescript-eslint/no-unused-vars
  async getRecord(query: GetRecordQuery, _user: StepUser): Promise<RecordData> {
    const record = query.collection === 'orders' ? RECORDS.order : RECORDS.customer;

    // eslint-disable-next-line no-console
    console.log(
      `  [agent] getRecord(${query.collection}, #${query.id}) -> fields: ${
        query.fields?.join(', ') || 'all'
      }`,
    );

    return record;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async updateRecord(query: UpdateRecordQuery, _user: StepUser): Promise<RecordData> {
    const record = query.collection === 'orders' ? RECORDS.order : RECORDS.customer;
    const updated = { ...record, values: { ...record.values, ...query.values } };

    // eslint-disable-next-line no-console
    console.log(
      `  [agent] updateRecord(${query.collection}, #${query.id}) -> ${JSON.stringify(
        query.values,
      )}`,
    );

    return updated;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getRelatedData(query: GetRelatedDataQuery, _user: StepUser): Promise<RecordData[]> {
    // eslint-disable-next-line no-console
    console.log(`  [agent] getRelatedData(${query.collection}, #${query.id}, ${query.relation})`);

    return [RECORDS.order];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async executeAction(query: ExecuteActionQuery, _user: StepUser): Promise<unknown> {
    // eslint-disable-next-line no-console
    console.log(`  [agent] executeAction(${query.collection}, ${query.action})`);

    return { success: true, message: `Action '${query.action}' executed successfully` };
  }
}
