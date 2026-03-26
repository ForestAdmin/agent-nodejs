import type {
  AgentPort,
  ExecuteActionQuery,
  GetRecordQuery,
  GetRelatedDataQuery,
  UpdateRecordQuery,
} from '../ports/agent-port';
import type { StepUser } from '../types/execution';
import type { RecordData } from '../types/record';

import { AgentPortError, WorkflowExecutorError } from '../errors';

export default class SafeAgentPort implements AgentPort {
  constructor(private readonly port: AgentPort) {}

  async getRecord(query: GetRecordQuery, user: StepUser): Promise<RecordData> {
    return this.call('getRecord', () => this.port.getRecord(query, user));
  }

  async updateRecord(query: UpdateRecordQuery, user: StepUser): Promise<RecordData> {
    return this.call('updateRecord', () => this.port.updateRecord(query, user));
  }

  async getRelatedData(query: GetRelatedDataQuery, user: StepUser): Promise<RecordData[]> {
    return this.call('getRelatedData', () => this.port.getRelatedData(query, user));
  }

  async executeAction(query: ExecuteActionQuery, user: StepUser): Promise<unknown> {
    return this.call('executeAction', () => this.port.executeAction(query, user));
  }

  private async call<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (cause) {
      if (cause instanceof WorkflowExecutorError) throw cause;
      throw new AgentPortError(operation, cause);
    }
  }
}
