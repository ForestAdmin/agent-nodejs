import type { ExportOptions, LiveQueryOptions, SelectOptions } from '../types';
import type { TSchema } from '@forestadmin/agent';

import { WriteStream } from 'fs';

import Action, { ActionEndpointsByCollection, BaseActionContext } from './action';
import CollectionChart from './collection-chart';
import Relation from './relation';
import Segment from './segment';
import FieldFormStates from '../action-fields/field-form-states';
import HttpRequester from '../http-requester';
import QuerySerializer from '../query-serializer';

export default class Collection<TypingsSchema extends TSchema = TSchema> extends CollectionChart {
  protected readonly name: keyof TypingsSchema;
  protected readonly actionEndpoints?: ActionEndpointsByCollection;

  constructor(
    name: keyof TypingsSchema,
    httpRequester: HttpRequester,
    actionEndpoints: ActionEndpointsByCollection,
  ) {
    super(name as string, httpRequester);

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
      path: `/forest/${this.name as string}`,
      query: QuerySerializer.serialize(options, this.name as string),
    });
  }

  async exportCsv(stream: WriteStream, options?: ExportOptions): Promise<void> {
    await this.httpRequester.stream({
      path: `/forest/${this.name as string}.csv`,
      contentType: 'text/csv',
      query: {
        ...QuerySerializer.serialize(options, this.name as string),
        ...{ header: JSON.stringify(options?.projection) },
      },
      stream,
    });
  }

  async count(options?: SelectOptions): Promise<number> {
    return Number(
      (
        await this.httpRequester.query<{ count: number }>({
          method: 'get',
          path: `/forest/${this.name as string}/count`,
          query: QuerySerializer.serialize(options, this.name as string),
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
      path: `/forest/${this.name as string}`,
      body: requestBody,
    });
  }

  async create<Data = any>(attributes: Record<string, unknown>): Promise<Data> {
    const requestBody = { data: { attributes, type: this.name } };

    return this.httpRequester.query<Data>({
      method: 'post',
      path: `/forest/${this.name as string}`,
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
      path: `/forest/${this.name as string}/${id.toString()}`,
      body: requestBody,
    });
  }

  private getActionPath(
    actionEndpoints: ActionEndpointsByCollection,
    collectionName: keyof TypingsSchema,
    actionName: string,
  ): string {
    const collection = actionEndpoints[collectionName as string];
    if (!collection) throw new Error(`Collection ${collectionName as string} not found in schema`);

    const action = collection[actionName];

    if (!action) {
      throw new Error(`Action ${actionName} not found in collection ${collectionName as string}`);
    }

    if (!action.endpoint) {
      throw new Error(`Action ${actionName} not found in collection ${collectionName as string}`);
    }

    return action.endpoint;
  }
}
