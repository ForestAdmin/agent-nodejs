import type {
  ExclusionQuery,
  ExclusionUnavailableReason,
  ListSegmentRecordIdsQuery,
  SegmentReaderPort,
} from '../ports/segment-reader-port';
import type { SegmentConditionTree, SegmentDescriptor } from '../types/automation';
import type { SelectOptions } from '@forestadmin/agent-client';

import { createRemoteAgentClient } from '@forestadmin/agent-client';

import { segmentReadError } from './agent-errors';
import { mintStepToken } from './step-user';
import {
  CompositeRecordIdMismatchError,
  SegmentRecordIdMissingError,
  WorkflowExecutorError,
} from '../errors';
import { deserializeRecordId } from '../record-id';

type AgentClient = ReturnType<typeof createRemoteAgentClient>;

// The exclusion filter travels in the query string of a GET. The orchestrator's untreated cap does
// not bound it: records waiting on a person in the fallback inbox stay excluded, as many as there
// are, so past this the page is padded instead.
const MAX_EXCLUDED_RECORDS = 150;

// The agents that serve `POST /forest/_internal/capabilities`, the same list the front gates that
// call on. Any other name is a v1 liana, which raises on `not_in`, or one this executor predates:
// both pad rather than risk a candidate read that fails on every sweep.
const LIANAS_WITH_CAPABILITIES: ReadonlySet<string> = new Set([
  'forest-nodejs-agent',
  'agent-ruby',
  'agent-python',
  'agent-php',
]);

// The lianas the front lets an inbox sort on several fields (`MultipleSortingFields`). The others
// read one sort field: forest-express-sequelize answers 500 on `a,id`, and forest-express-mongoose
// sorts on a single field literally named `a,_id`.
const LIANAS_WITH_MULTIPLE_SORT: ReadonlySet<string> = new Set([
  'forest-rails',
  'forest-nodejs-agent',
  'agent-python',
  'agent-ruby',
]);

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
    const { collectionName, segment, primaryKeys, user, timezone, pageSize, pageNumber } = query;
    const { recordIds, excludedRecordIds } = query;

    try {
      const client = this.createClient(user, timezone);

      const filters = AgentClientSegmentReader.buildFilters(
        segment,
        primaryKeys,
        recordIds,
        excludedRecordIds,
      );
      const options: SelectOptions = {
        fields: primaryKeys,
        ...(pageSize !== undefined
          ? { pagination: { size: pageSize, number: pageNumber ?? 1 } }
          : {}),
        sort: query.sort,
        ...(filters !== undefined ? { filters } : {}),
      };

      const records = await AgentClientSegmentReader.resolveLister(
        client,
        collectionName,
        segment,
      ).list<Record<string, unknown>>(options);

      return records.map(record => AgentClientSegmentReader.readRecordId(record, collectionName));
    } catch (cause) {
      // These three say the read itself is unusable, not that the agent failed; wrapping them would
      // bury what the poller needs to log.
      if (
        cause instanceof WorkflowExecutorError ||
        cause instanceof SegmentRecordIdMissingError ||
        cause instanceof CompositeRecordIdMismatchError
      ) {
        throw cause;
      }

      throw segmentReadError('listSegmentRecordIds', cause);
    }
  }

  async exclusionUnavailableReason(
    query: ExclusionQuery,
  ): Promise<ExclusionUnavailableReason | undefined> {
    const { collectionName, primaryKeys, user, timezone, liana, knownRecordCount } = query;

    if (primaryKeys.length !== 1) return 'composite-key';
    if (knownRecordCount > MAX_EXCLUDED_RECORDS) return 'too-many-known-records';
    if (!knownRecordCount) return undefined;
    if (liana == null || !LIANAS_WITH_CAPABILITIES.has(liana)) return 'unknown-liana';

    let operators: string[];

    try {
      const { fields } = await this.createClient(user, timezone)
        .collection(collectionName)
        .capabilities();

      operators = fields.find(({ name }) => name === primaryKeys[0])?.operators ?? [];
    } catch (cause) {
      throw segmentReadError('listFieldOperators', cause);
    }

    return operators.includes('not_in') ? undefined : 'field-without-not-in';
  }

  sortsOnSeveralFields(liana: string | null | undefined): boolean {
    return liana != null && LIANAS_WITH_MULTIPLE_SORT.has(liana);
  }

  private createClient(user: ListSegmentRecordIdsQuery['user'], timezone: string): AgentClient {
    return createRemoteAgentClient({
      url: this.agentUrl,
      token: mintStepToken(user, this.authSecret),
      // Left out, agent-client sends Europe/Paris, and every relative-date condition in the
      // segment would resolve against a day the project never asked for.
      timezone,
    });
  }

  private static resolveLister(
    client: AgentClient,
    collectionName: string,
    segment: SegmentDescriptor,
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
        ...(segment.connectionName ? { connectionName: segment.connectionName } : {}),
      } as { connectionName: string; query: string });
    }

    return collection;
  }

  private static buildFilters(
    segment: SegmentDescriptor,
    primaryKeys: string[],
    recordIds: string[] | undefined,
    excludedRecordIds: string[] | undefined,
  ): AgentFilter {
    const branches = [
      segment.kind === 'filter' ? segment.conditionTree : null,
      recordIds?.length
        ? AgentClientSegmentReader.buildRecordIdFilter(primaryKeys, recordIds)
        : null,
      // Single-column keys only, as the port states: `not_in` takes a flat list of values, and the
      // caller falls back to reading a wider page rather than negating a composite key.
      excludedRecordIds?.length && primaryKeys.length === 1
        ? { field: primaryKeys[0], operator: 'not_in', value: excludedRecordIds }
        : null,
    ].filter((tree): tree is SegmentConditionTree => tree !== null);

    if (branches.length === 0) return undefined;

    const tree: SegmentConditionTree =
      branches.length === 1 ? branches[0] : { aggregator: 'and', conditions: branches };

    return tree as AgentFilter;
  }

  private static buildRecordIdFilter(
    primaryKeys: string[],
    recordIds: string[],
  ): SegmentConditionTree {
    // `in` takes a flat list of values, so it only ever addresses a single-column key. A composite
    // key is asked for as one branch per record, each ANDing the parts of its packed id.
    if (primaryKeys.length === 1) {
      return { field: primaryKeys[0], operator: 'in', value: recordIds };
    }

    return {
      aggregator: 'or',
      conditions: recordIds.map(recordId => {
        const parts = deserializeRecordId(recordId);

        // Same limitation as the agent's own `IdUtils.packId`: a key value containing the separator
        // cannot be unpacked. Caught here, where the id is named, rather than sent as a leaf with
        // no field for the agent to reject.
        if (parts.length !== primaryKeys.length) {
          throw new CompositeRecordIdMismatchError(recordId, primaryKeys.length);
        }

        return {
          aggregator: 'and',
          conditions: parts.map((part, index) => ({
            field: primaryKeys[index],
            operator: 'equal',
            value: part,
          })),
        };
      }),
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

    // Guarded rather than coerced: an id the orchestrator cannot resolve would start a run against
    // the wrong record, and an empty string is no more an id than a missing one.
    if ((typeof id !== 'string' && typeof id !== 'number') || String(id) === '') {
      throw new SegmentRecordIdMissingError(collectionName);
    }

    return String(id);
  }
}
