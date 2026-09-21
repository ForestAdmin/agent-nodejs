import type { ServerAutomatedSegmentDescriptor, ServerPlainConditionTree } from './server-types';
import type { ListSegmentRecordIdsQuery, SegmentReaderPort } from '../ports/segment-reader-port';
import type { SelectOptions } from '@forestadmin/agent-client';

import { createRemoteAgentClient } from '@forestadmin/agent-client';

import { mintStepToken, toStepUser } from './step-user';
import { AgentPortError, SegmentRecordIdMissingError, WorkflowExecutorError } from '../errors';

type AgentClient = ReturnType<typeof createRemoteAgentClient>;

// Both a collection and a segment expose the same read; the descriptor decides which one answers.
interface RecordLister {
  list<Data = unknown>(options?: SelectOptions): Promise<Data[]>;
}

// agent-client types the condition tree against datasource-toolkit, which this package
// deliberately does not depend on. The trees below are the wire shape the agents parse, which is
// what `QuerySerializer` emits anyway.
type AgentFilter = SelectOptions['filters'];

export default class AgentClientSegmentReader implements SegmentReaderPort {
  private readonly agentUrl: string;
  private readonly authSecret: string;

  constructor(params: { agentUrl: string; authSecret: string }) {
    this.agentUrl = params.agentUrl;
    this.authSecret = params.authSecret;
  }

  async listRecordIds(query: ListSegmentRecordIdsQuery): Promise<string[]> {
    const { collectionName, segment, primaryKeys, user, timezone, recordIds, pageSize } = query;

    try {
      const client = createRemoteAgentClient({
        url: this.agentUrl,
        token: mintStepToken(toStepUser(user), this.authSecret),
        // Left out, agent-client sends Europe/Paris, and every relative-date condition in the
        // segment would resolve against a day the project never asked for.
        timezone,
      });

      const filters = AgentClientSegmentReader.buildFilters(segment, primaryKeys, recordIds);
      const options: SelectOptions = {
        fields: primaryKeys,
        ...(pageSize !== undefined ? { pagination: { size: pageSize, number: 1 } } : {}),
        ...(filters !== undefined ? { filters } : {}),
      };

      const records = await AgentClientSegmentReader.resolveLister(
        client,
        collectionName,
        segment,
      ).list<Record<string, unknown>>(options);

      return records.map(record => AgentClientSegmentReader.readRecordId(record, collectionName));
    } catch (cause) {
      if (cause instanceof WorkflowExecutorError) throw cause;

      throw new AgentPortError('listSegmentRecordIds', cause);
    }
  }

  private static resolveLister(
    client: AgentClient,
    collectionName: string,
    segment: ServerAutomatedSegmentDescriptor,
  ): RecordLister {
    const collection = client.collection(collectionName);

    if (segment.kind === 'smart') return collection.segment(segment.name);

    if (segment.kind === 'sql') {
      // A v1 liana runs the query against the single database it is bound to and never reads
      // `connectionName`; the key is dropped rather than sent empty, which superagent would
      // forward as a connection name the agent cannot resolve. agent-client types it required,
      // hence the cast.
      return collection.liveQuerySegment({
        query: segment.query,
        ...(segment.connectionName !== null ? { connectionName: segment.connectionName } : {}),
      } as { connectionName: string; query: string });
    }

    return collection;
  }

  private static buildFilters(
    segment: ServerAutomatedSegmentDescriptor,
    primaryKeys: string[],
    recordIds: string[] | undefined,
  ): AgentFilter {
    const segmentTree = segment.kind === 'filter' ? segment.conditionTree : null;
    const idTree = recordIds?.length
      ? AgentClientSegmentReader.buildRecordIdFilter(primaryKeys, recordIds)
      : null;

    let tree: ServerPlainConditionTree | null = segmentTree ?? idTree;

    if (segmentTree && idTree) tree = { aggregator: 'and', conditions: [segmentTree, idTree] };

    return tree === null ? undefined : (tree as AgentFilter);
  }

  private static buildRecordIdFilter(
    primaryKeys: string[],
    recordIds: string[],
  ): ServerPlainConditionTree {
    // `in` takes a flat list of values, so it only ever addresses a single-column key. A composite
    // key is asked for as one branch per record, each ANDing the parts of its packed id.
    if (primaryKeys.length === 1) {
      return { field: primaryKeys[0], operator: 'in', value: recordIds };
    }

    return {
      aggregator: 'or',
      conditions: recordIds.map(recordId => ({
        aggregator: 'and',
        conditions: recordId
          .split('|')
          .map((part, index) => ({ field: primaryKeys[index], operator: 'equal', value: part })),
      })),
    };
  }

  /**
   * The JSON:API resource id, which the agent already builds by joining the primary key with `|`
   * (`IdUtils.packId`) — the very form the orchestrator stores as `recordId`. Rebuilding it from the
   * attributes would be wrong anyway: the deserializer overwrites an `id` attribute with the
   * resource id, so a composite key would come back doubled.
   */
  private static readRecordId(record: Record<string, unknown>, collectionName: string): string {
    const { id } = record;

    // Guarded rather than coerced: a blank id here would start a run against the wrong record.
    if (typeof id !== 'string' && typeof id !== 'number') {
      throw new SegmentRecordIdMissingError(collectionName);
    }

    return String(id);
  }
}
