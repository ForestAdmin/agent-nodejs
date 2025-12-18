import type HttpRequester from '../http-requester';
import type { SelectOptions } from '../types';

import QuerySerializer from '../query-serializer';

export default class Relation<TypingsSchema> {
  private readonly name: string;
  private readonly collectionName: keyof TypingsSchema;
  private readonly parentId: string | number;
  private readonly httpRequester: HttpRequester;

  constructor(
    name: string,
    collectionName: keyof TypingsSchema,
    parentId: string | number,
    httpRequester: HttpRequester,
  ) {
    this.name = name;
    this.collectionName = collectionName;
    this.httpRequester = httpRequester;
    this.parentId = parentId;
  }

  list<Data = unknown>(options?: SelectOptions): Promise<Data[]> {
    return this.httpRequester.query<Data[]>({
      method: 'get',
      path: `/forest/${this.collectionName as string}/${this.parentId}/relationships/${this.name}`,
      query: QuerySerializer.serialize(options, this.collectionName as string),
    });
  }
}
