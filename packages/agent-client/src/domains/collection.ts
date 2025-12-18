import type { ExportOptions, LiveQueryOptions, SelectOptions } from '../types';

import { WriteStream } from 'fs';

import Action, { ActionEndpointsByCollection, BaseActionContext } from './action';
import CollectionChart from './collection-chart';
import Relation from './relation';
import Segment from './segment';
import FieldFormStates from '../action-fields/field-form-states';
import HttpRequester from '../http-requester';
import QuerySerializer from '../query-serializer';

export default class Collection<TypingsSchema> extends CollectionChart {
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

  async action(
    actionName: string,
    actionContext?: BaseActionContext,
  ): Promise<Action<TypingsSchema>> {
    const actionPath = this.getActionPath(this.actionEndpoints, this.name, actionName);
    const ids = (actionContext?.recordIds ?? [actionContext?.recordId]).filter(Boolean).map(String);

    const fieldsFormStates = new FieldFormStates(
      actionName,
      actionPath,
      this.name,
      this.httpRequester,
      ids,
    );

    const action = new Action<TypingsSchema>(
      this.name,
      this.httpRequester,
      actionPath,
      fieldsFormStates,
      ids,
    );

    await fieldsFormStates.loadInitialState();

    return action;
  }

  segment(name: string): Segment<TypingsSchema> {
    return new Segment<TypingsSchema>(name, this.name, this.httpRequester);
  }

  liveQuerySegment(options: LiveQueryOptions): Segment<TypingsSchema> {
    // there is no name for live query
    return new Segment<TypingsSchema>(undefined, this.name, this.httpRequester, options);
  }

  relation(name: string, parentId: string | number): Relation<TypingsSchema> {
    return new Relation<TypingsSchema>(name, this.name, parentId, this.httpRequester);
  }

  async search<Data = any>(content: string): Promise<Data[]> {
    return this.list({ search: content });
  }

  async list<Data = any>(options?: SelectOptions): Promise<Data[]> {
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
        ...QuerySerializer.serialize(options, this.name),
        ...{ header: JSON.stringify(options?.fields) },
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

  async delete<Data = any>(ids: string[] | number[]): Promise<Data> {
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

  async create<Data = any>(attributes: Record<string, unknown>): Promise<Data> {
    const requestBody = { data: { attributes, type: this.name } };

    return this.httpRequester.query<Data>({
      method: 'post',
      path: `/forest/${this.name}`,
      body: requestBody,
    });
  }

  async update<Data = any>(
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

  private getActionPath(
    actionEndpoints: ActionEndpointsByCollection,
    collectionName: string,
    actionName: string,
  ): string {
    const collection = actionEndpoints[collectionName];
    if (!collection) throw new Error(`Collection ${collectionName} not found in schema`);

    const action = collection[actionName];

    if (!action) {
      throw new Error(`Action ${actionName} not found in collection ${collectionName}`);
    }

    if (!action.endpoint) {
      throw new Error(`Action ${actionName} not found in collection ${collectionName}`);
    }

    return action.endpoint;
  }
}
