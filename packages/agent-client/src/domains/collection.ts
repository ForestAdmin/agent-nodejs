import type { ExportOptions, LiveQueryOptions, SelectOptions } from '../types';
import type { ActionEndpointsByCollection, BaseActionContext } from './action';
import type { ForestSchemaAction } from '@forestadmin/forestadmin-client';
import type HttpRequester from '../http-requester';
import type { WriteStream } from 'fs';

import Action from './action';
import CollectionChart from './collection-chart';
import Relation from './relation';
import Segment from './segment';
import FieldFormStates from '../action-fields/field-form-states';
import QuerySerializer from '../query-serializer';

export default class Collection extends CollectionChart {
  protected readonly name: string;
  protected readonly actionEndpoints?: ActionEndpointsByCollection;

  constructor(
    name: string,
    httpRequester: HttpRequester,
    actionEndpoints: ActionEndpointsByCollection,
  ) {
    super(name, httpRequester);

    this.name = name;
    this.actionEndpoints = actionEndpoints;
  }

  async action(actionName: string, actionContext?: BaseActionContext): Promise<Action> {
    const actionInfo = this.getActionInfo(this.actionEndpoints, this.name, actionName);
    const ids = (actionContext?.recordIds ?? [actionContext?.recordId]).filter(Boolean).map(String);

    const fieldsFormStates = new FieldFormStates(
      actionName,
      actionInfo.endpoint,
      this.name,
      this.httpRequester,
      ids,
      actionInfo.hooks,
      actionInfo.fields,
    );

    const action = new Action(
      this.name,
      this.httpRequester,
      actionInfo.endpoint,
      fieldsFormStates,
      ids,
      actionInfo.id,
    );

    await fieldsFormStates.loadInitialState();

    return action;
  }

  segment(name: string): Segment {
    return new Segment(name, this.name, this.httpRequester);
  }

  liveQuerySegment(options: LiveQueryOptions): Segment {
    // there is no name for live query
    return new Segment(undefined, this.name, this.httpRequester, options);
  }

  relation(name: string, parentId: string | number): Relation {
    return new Relation(name, this.name, parentId, this.httpRequester);
  }

  async search<Data = unknown>(content: string): Promise<Data[]> {
    return this.list({ search: content });
  }

  async list<Data = unknown>(options?: SelectOptions): Promise<Data[]> {
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

  async count(options?: SelectOptions): Promise<number> {
    return Number(
      (
        await this.httpRequester.query<{ count: number }>({
          method: 'get',
          path: `/forest/${this.name}/count`,
          query: QuerySerializer.serialize(options, this.name),
        })
      ).count,
    );
  }

  async capabilities(): Promise<{
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

  async delete<Data = unknown>(ids: string[] | number[]): Promise<Data> {
    const serializedIds = ids.map((id: string | number) => id.toString());
    const requestBody = {
      data: {
        attributes: { collection_name: this.name, ids: serializedIds },
        type: 'action-requests',
      },
    };

    return this.httpRequester.query<Data>({
      method: 'delete',
      path: `/forest/${this.name}`,
      body: requestBody,
    });
  }

  async create<Data = unknown>(attributes: Record<string, unknown>): Promise<Data> {
    const requestBody = { data: { attributes, type: this.name } };

    return this.httpRequester.query<Data>({
      method: 'post',
      path: `/forest/${this.name}`,
      body: requestBody,
    });
  }

  async update<Data = unknown>(
    id: string | number,
    attributes: Record<string, unknown>,
  ): Promise<Data> {
    const requestBody = { data: { attributes, type: this.name, id: id.toString() } };

    return this.httpRequester.query<Data>({
      method: 'put',
      path: `/forest/${this.name}/${id.toString()}`,
      body: requestBody,
    });
  }

  private getActionInfo(
    actionEndpoints: ActionEndpointsByCollection,
    collectionName: string,
    actionName: string,
  ): Pick<ForestSchemaAction, 'id' | 'endpoint' | 'hooks' | 'fields'> {
    const collection = actionEndpoints[collectionName];
    if (!collection) throw new Error(`Collection ${collectionName} not found in schema`);

    const action = collection[actionName];

    if (!action) {
      throw new Error(`Action ${actionName} not found in collection ${collectionName}`);
    }

    if (!action.endpoint) {
      throw new Error(`Action ${actionName} not found in collection ${collectionName}`);
    }

    return { id: action.id, endpoint: action.endpoint, hooks: action.hooks, fields: action.fields };
  }
}
