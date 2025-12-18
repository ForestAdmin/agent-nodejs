import type HttpRequester from '../http-requester';
import type { ExportOptions, LiveQueryOptions, SelectOptions } from '../types';

import { WriteStream } from 'node:fs';

import QuerySerializer from '../query-serializer';

export default class Segment<TypingsSchema> {
  private readonly name?: string;
  private readonly collectionName: string;
  private readonly httpRequester: HttpRequester;
  private readonly liveQuerySegment?: LiveQueryOptions;

  constructor(
    name: string | undefined,
    collectionName: string,
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
      path: `/forest/${this.collectionName}`,
      query: this.serializeQuery(options),
    });
  }

  async exportCsv(stream: WriteStream, options?: ExportOptions): Promise<void> {
    await this.httpRequester.stream({
      path: `/forest/${this.collectionName}.csv`,
      contentType: 'text/csv',
      query: {
        ...this.serializeQuery(options),
        ...{ header: JSON.stringify(options?.fields) },
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
        this.collectionName,
      );
    }

    return {
      ...QuerySerializer.serialize(options, this.collectionName),
      segment: this.name,
    };
  }
}
