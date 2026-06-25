import type { ActionEndpointsByCollection } from './action';
import type HttpRequester from '../http-requester';

import Chart from './chart';
import Collection from './collection';

type CollectionName<T> = keyof T & string;

export default class RemoteAgentClient<
  TypingsSchema extends Record<string, unknown> = Record<string, unknown>,
> extends Chart {
  protected actionEndpoints?: ActionEndpointsByCollection;

  constructor(params?: {
    actionEndpoints?: ActionEndpointsByCollection;
    httpRequester: HttpRequester;
  }) {
    super();
    if (!params) return;
    this.httpRequester = params.httpRequester;
    this.actionEndpoints = params.actionEndpoints;
  }

  collection(name: CollectionName<TypingsSchema>): Collection {
    return new Collection(name, this.httpRequester, this.actionEndpoints);
  }
}
