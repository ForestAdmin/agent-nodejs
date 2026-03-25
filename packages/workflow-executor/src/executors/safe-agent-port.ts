import type {
  AgentCallContext,
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

  async getRecord(query: GetRecordQuery, context: AgentCallContext): Promise<RecordData> {
    return this.call('getRecord', () => this.port.getRecord(query, context));
  }

  async updateRecord(query: UpdateRecordQuery, context: AgentCallContext): Promise<RecordData> {
    return this.call('updateRecord', () => this.port.updateRecord(query, context));
  }

  async getRelatedData(
    query: GetRelatedDataQuery,
    context: AgentCallContext,
  ): Promise<RecordData[]> {
    return this.call('getRelatedData', () => this.port.getRelatedData(query, context));
  }

  async executeAction(query: ExecuteActionQuery, context: AgentCallContext): Promise<unknown> {
    return this.call('executeAction', () => this.port.executeAction(query, context));
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
