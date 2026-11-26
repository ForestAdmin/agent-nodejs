import type { ExportOptions, LiveQueryOptions, RecordId, SelectOptions } from '../types';
import type {
  ActionEndpointsByCollection,
  ActionExecuteOptions,
  ActionExecuteResult,
  BaseActionContext,
} from './action';
import type { ActivityLogCallOptions, ActivityLogContext } from '../activity-log/with-activity-log';
import type { CreateApprovalRequest } from '../approval-request-creator';
import type HttpRequester from '../http-requester';
import type { ForestSchemaAction } from '@forestadmin/forestadmin-client';
import type { WriteStream } from 'fs';

import Action from './action';
import CollectionChart from './collection-chart';
import Relation from './relation';
import Segment from './segment';
import FieldFormStates from '../action-fields/field-form-states';
import { assertActionValuesExecutable } from '../action-fields/form-description';
import withActivityLogContext, {
  logApprovalRequest,
  runCall,
} from '../activity-log/with-activity-log';
import { mayHaveRun } from '../agent-error';
import { isApprovalRequested } from '../approval-requested';
import toCount from '../count-response';
import { ActionOutcomeUnknownError } from '../errors';
import QuerySerializer, { hasFilters, searchOf } from '../query-serializer';
import serializeRecordId from '../record-id';

export type ExecuteActionOptions = BaseActionContext &
  ActionExecuteOptions & {
    fill?: (action: Action) => Promise<void>;
    activityLog?: Pick<ActivityLogCallOptions, 'label' | 'beforeCall'>;
  };

const DEFAULT_ACTION_TIMEOUT_MS = 30_000;

function serializeActionIds(context?: BaseActionContext): string[] {
  return (context?.recordIds ?? [context?.recordId])
    .filter((id): id is RecordId => id !== undefined && id !== null && id !== '')
    .map(serializeRecordId);
}

function listActionOf(options?: SelectOptions): 'index' | 'search' | 'filter' {
  if (searchOf(options)) return 'search';
  if (hasFilters(options)) return 'filter';

  return 'index';
}

export default class Collection extends CollectionChart {
  protected readonly name: string;
  protected readonly actionEndpoints?: ActionEndpointsByCollection;
  protected readonly createApprovalRequest?: CreateApprovalRequest;
  protected readonly activityLog?: ActivityLogContext;

  constructor(
    name: string,
    httpRequester: HttpRequester,
    actionEndpoints: ActionEndpointsByCollection,
    createApprovalRequest?: CreateApprovalRequest,
    activityLog?: ActivityLogContext,
  ) {
    super(name, httpRequester);

    this.name = name;
    this.actionEndpoints = actionEndpoints;
    this.createApprovalRequest = createApprovalRequest;
    this.activityLog = activityLog;
  }

  async action(actionName: string, actionContext?: BaseActionContext): Promise<Action> {
    const actionInfo = this.getActionInfo(this.actionEndpoints, this.name, actionName);
    const ids = serializeActionIds(actionContext);

    const fieldsFormStates = new FieldFormStates({
      actionName,
      actionPath: actionInfo.endpoint,
      collectionName: this.name,
      httpRequester: this.httpRequester,
      ids,
      hooks: actionInfo.hooks,
      fallbackFields: actionInfo.fields,
      fallbackLayout: actionInfo.layout,
      timezone: actionContext?.timezone,
      actionId: actionInfo.id,
    });

    const action = new Action(
      this.name,
      actionName,
      this.httpRequester,
      actionInfo.endpoint,
      fieldsFormStates,
      ids,
      actionInfo.id,
      this.createApprovalRequest,
      actionContext?.timezone,
    );

    await fieldsFormStates.loadInitialState();

    return action;
  }

  async executeAction(
    actionName: string,
    options: ExecuteActionOptions = {},
  ): Promise<ActionExecuteResult> {
    const {
      fill,
      activityLog,
      signedApprovalRequest,
      approvalRequestMessage,
      skipApprovalRequest,
      maxTimeAllowed,
      ...context
    } = options;

    const collectionName = this.name;
    const recordIds = serializeActionIds(context);
    let isExecuteSent = false;

    const isOutcomeUnknown = (error: unknown) => isExecuteSent && mayHaveRun(error);
    let result: ActionExecuteResult;

    try {
      result = await withActivityLogContext(
        this.activityLog,
        {
          action: 'action',
          collectionName,
          recordIds,
          label: activityLog?.label ?? `triggered the action "${actionName}"`,
        },
        async () => {
          const action = await this.action(actionName, context);
          if (fill) await fill(action);
          assertActionValuesExecutable(action);
          isExecuteSent = true;

          return action.execute({
            signedApprovalRequest,
            approvalRequestMessage,
            skipApprovalRequest,
            maxTimeAllowed: maxTimeAllowed ?? DEFAULT_ACTION_TIMEOUT_MS,
          });
        },
        activityLog?.beforeCall,
        isOutcomeUnknown,
      );
    } catch (error) {
      if (isOutcomeUnknown(error)) throw new ActionOutcomeUnknownError(error);
      throw error;
    }

    if (isApprovalRequested(result)) {
      logApprovalRequest(this.activityLog, {
        collectionName,
        recordIds,
        label: `requested an approval for the action "${actionName}"`,
      });
    }

    return result;
  }

  segment(name: string): Segment {
    return new Segment(name, this.name, this.httpRequester);
  }

  liveQuerySegment(options: LiveQueryOptions): Segment {
    // there is no name for live query
    return new Segment(undefined, this.name, this.httpRequester, options);
  }

  relation(name: string, parentId: RecordId, listedCollectionName?: string): Relation {
    return new Relation(
      name,
      this.name,
      parentId,
      this.httpRequester,
      this.activityLog,
      listedCollectionName,
    );
  }

  async search<Data = unknown>(content: string): Promise<Data[]> {
    return this.list({ search: content });
  }

  async list<Data = unknown>(
    options?: SelectOptions,
    activityLog?: ActivityLogCallOptions,
  ): Promise<Data[]> {
    return runCall(
      this.activityLog,
      { action: listActionOf(options), collectionName: this.name },
      activityLog,
      () => this.fetchList<Data>(options),
    );
  }

  async listAndCount<Data = unknown>(
    options?: SelectOptions,
    activityLog?: ActivityLogCallOptions,
  ): Promise<{ records: Data[]; totalCount: number | null }> {
    return runCall(
      this.activityLog,
      { action: listActionOf(options), collectionName: this.name },
      activityLog,
      async () => {
        const [records, totalCount] = await Promise.all([
          this.fetchList<Data>(options),
          this.count(options),
        ]);

        return { records, totalCount };
      },
    );
  }

  private fetchList<Data>(options?: SelectOptions): Promise<Data[]> {
    return this.httpRequester.query<Data[]>({
      method: 'get',
      path: `/forest/${this.name}`,
      query: QuerySerializer.serialize(options, this.name),
    });
  }

  async exportCsv(stream: WriteStream, options?: ExportOptions): Promise<void> {
    await this.httpRequester.stream({
      path: `/forest/${this.name}.csv`,
      contentType: 'text/csv',
      query: {
        // QuerySerializer.serialize sends fields[collection]=... to filter which fields are returned
        ...QuerySerializer.serialize(options, this.name),
        // header is used separately by the CSV generator to build the first row of the CSV file
        ...(options?.fields && { header: JSON.stringify(options.fields) }),
      },
      stream,
    });
  }

  async count(options?: SelectOptions): Promise<number | null> {
    return toCount(
      await this.httpRequester.query({
        method: 'get',
        path: `/forest/${this.name}/count`,
        query: QuerySerializer.serialize(options, this.name),
        skipDeserialization: true,
      }),
    );
  }

  async capabilities(activityLog?: ActivityLogCallOptions): Promise<{
    fields: { name: string; type: string; operators: string[] }[];
  }> {
    return runCall(this.activityLog, { collectionName: this.name }, activityLog, () =>
      this.fetchCapabilities(),
    );
  }

  private async fetchCapabilities(): Promise<{
    fields: { name: string; type: string; operators: string[] }[];
  }> {
    const result = await this.httpRequester.query<{
      collections: {
        name: string;
        fields: { name: string; type: string; operators: string[] }[];
      }[];
    }>({
      method: 'post',
      path: '/forest/_internal/capabilities',
      body: { collectionNames: [this.name] },
    });

    const collection = result.collections.find(c => c.name === this.name);

    if (!collection) {
      throw new Error(
        `Collection "${this.name}" not found in capabilities response. ` +
          `Available: ${result.collections.map(c => c.name).join(', ') || 'none'}`,
      );
    }

    return { fields: collection.fields };
  }

  async delete<Data = unknown>(
    ids: RecordId[],
    activityLog?: ActivityLogCallOptions,
  ): Promise<Data> {
    const serializedIds = ids.map(serializeRecordId);
    const requestBody = {
      data: {
        attributes: { collection_name: this.name, ids: serializedIds },
        type: 'action-requests',
      },
    };

    return runCall(
      this.activityLog,
      { action: 'delete', collectionName: this.name, recordIds: serializedIds, label: 'deleted' },
      activityLog,
      () =>
        this.httpRequester.query<Data>({
          method: 'delete',
          path: `/forest/${this.name}`,
          body: requestBody,
        }),
    );
  }

  async create<Data = unknown>(
    attributes: Record<string, unknown>,
    activityLog?: ActivityLogCallOptions,
  ): Promise<Data> {
    const requestBody = { data: { attributes, type: this.name } };

    return runCall(
      this.activityLog,
      { action: 'create', collectionName: this.name, label: 'created' },
      activityLog,
      () =>
        this.httpRequester.query<Data>({
          method: 'post',
          path: `/forest/${this.name}`,
          body: requestBody,
        }),
    );
  }

  async update<Data = unknown>(
    id: RecordId,
    attributes: Record<string, unknown>,
    activityLog?: ActivityLogCallOptions,
  ): Promise<Data> {
    const serializedId = serializeRecordId(id);
    const requestBody = { data: { attributes, type: this.name, id: serializedId } };

    return runCall(
      this.activityLog,
      { action: 'update', collectionName: this.name, recordIds: [serializedId], label: 'updated' },
      activityLog,
      () =>
        this.httpRequester.query<Data>({
          method: 'put',
          path: `/forest/${this.name}/${serializedId}`,
          body: requestBody,
        }),
    );
  }

  async getOne<Data = unknown>(
    id: RecordId,
    options?: SelectOptions,
    {
      skipDeserialization = false,
      activityLog,
    }: { skipDeserialization?: boolean; activityLog?: ActivityLogCallOptions } = {},
  ): Promise<Data> {
    const serializedId = serializeRecordId(id);

    return runCall(
      this.activityLog,
      { action: 'index', collectionName: this.name, recordIds: [serializedId] },
      activityLog,
      () =>
        this.httpRequester.query<Data>({
          method: 'get',
          path: `/forest/${this.name}/${serializedId}`,
          query: QuerySerializer.serialize(options, this.name),
          skipDeserialization,
        }),
    );
  }

  private getActionInfo(
    actionEndpoints: ActionEndpointsByCollection,
    collectionName: string,
    actionName: string,
  ): Pick<ForestSchemaAction, 'id' | 'endpoint' | 'layout'> &
    Partial<Pick<ForestSchemaAction, 'hooks' | 'fields'>> {
    const collection = actionEndpoints[collectionName];
    if (!collection) throw new Error(`Collection ${collectionName} not found in schema`);

    const action = collection[actionName];

    if (!action) {
      throw new Error(`Action ${actionName} not found in collection ${collectionName}`);
    }

    if (!action.endpoint) {
      throw new Error(`Action ${actionName} not found in collection ${collectionName}`);
    }

    return {
      id: action.id,
      endpoint: action.endpoint,
      hooks: action.hooks,
      fields: action.fields,
      layout: action.layout,
    };
  }
}
