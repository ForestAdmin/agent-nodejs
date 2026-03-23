import type {
  AgentPort,
  ExecuteActionQuery,
  GetRecordQuery,
  GetRelatedDataQuery,
  UpdateRecordQuery,
} from '../ports/agent-port';
import type { RecordData } from '../types/record';

import { AgentPortError, WorkflowExecutorError } from '../errors';

export default class SafeAgentPort implements AgentPort {
  constructor(private readonly port: AgentPort) {}

  async getRecord(query: GetRecordQuery): Promise<RecordData> {
    return this.call('getRecord', () => this.port.getRecord(query));
  }

  async updateRecord(query: UpdateRecordQuery): Promise<RecordData> {
    return this.call('updateRecord', () => this.port.updateRecord(query));
  }

  async getRelatedData(query: GetRelatedDataQuery): Promise<RecordData[]> {
    return this.call('getRelatedData', () => this.port.getRelatedData(query));
  }

  async executeAction(query: ExecuteActionQuery): Promise<unknown> {
    return this.call('executeAction', () => this.port.executeAction(query));
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
