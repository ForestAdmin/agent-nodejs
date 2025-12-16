import type HttpRequester from '../http-requester';
import type { ExportOptions, LiveQueryOptions, SelectOptions } from '../types';

import { WriteStream } from 'node:fs';

import QuerySerializer from '../query-serializer';

export default class Segment<TypingsSchema> {
  private readonly name?: string;
  private readonly collectionName: keyof TypingsSchema;
  private readonly httpRequester: HttpRequester;
  private readonly liveQuerySegment?: LiveQueryOptions;

  constructor(
    name: string | undefined,
    collectionName: keyof TypingsSchema,
    httpRequester: HttpRequester,
    liveQuerySegment?: LiveQueryOptions,
  ) {
    this.name = name;
    this.collectionName = collectionName;
    this.httpRequester = httpRequester;
    this.liveQuerySegment = liveQuerySegment;
  }

  async list<Data = unknown>(options?: SelectOptions): Promise<Data[]> {
    return this.httpRequester.query<Data[]>({
      method: 'get',
      path: `/forest/${this.collectionName as string}`,
      query: this.serializeQuery(options),
    });
  }

  async exportCsv(stream: WriteStream, options?: ExportOptions): Promise<void> {
    await this.httpRequester.stream({
      path: `/forest/${this.collectionName as string}.csv`,
      contentType: 'text/csv',
      query: {
        ...this.serializeQuery(options),
        ...{ header: JSON.stringify(options?.projection) },
      },
      stream,
    });
  }

  private serializeQuery(options?: SelectOptions): Record<string, unknown> {
    if (this.liveQuerySegment) {
      return QuerySerializer.serialize(
        {
          ...(options ?? {}),
          ...{
            segmentQuery: this.liveQuerySegment.query,
            connectionName: this.liveQuerySegment.connectionName,
          },
        },
        this.collectionName as string,
      );
    }

    return QuerySerializer.serialize(
      { ...options, ...{ filters: { segment: this.name } } },
      this.collectionName as string,
    );
  }
}
