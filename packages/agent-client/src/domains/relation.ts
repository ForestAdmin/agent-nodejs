import type HttpRequester from '../http-requester';
import type { RecordId, SelectOptions } from '../types';

import QuerySerializer from '../query-serializer';
import encodeRecordId from '../record-id';

export default class Relation {
  private readonly name: string;
  private readonly collectionName: string;
  private readonly parentId: string;
  private readonly httpRequester: HttpRequester;

  constructor(
    name: string,
    collectionName: string,
    parentId: RecordId,
    httpRequester: HttpRequester,
  ) {
    this.name = name;
    this.collectionName = collectionName;
    this.httpRequester = httpRequester;
    this.parentId = encodeRecordId(parentId);
  }

  list<Data = unknown>(options?: SelectOptions): Promise<Data[]> {
    return this.httpRequester.query<Data[]>({
      method: 'get',
      path: `/forest/${this.collectionName}/${this.parentId}/relationships/${this.name}`,
      query: QuerySerializer.serialize(options, this.collectionName),
    });
  }

  async count(options?: SelectOptions): Promise<number> {
    return Number(
      (
        await this.httpRequester.query<{ count: number }>({
          method: 'get',
          path: `/forest/${this.collectionName}/${this.parentId}/relationships/${this.name}/count`,
          query: QuerySerializer.serialize(options, this.collectionName),
        })
      ).count,
    );
  }

  async associate(targetRecordId: RecordId): Promise<void> {
    await this.httpRequester.query({
      method: 'post',
      path: `/forest/${this.collectionName}/${this.parentId}/relationships/${this.name}`,
      body: {
        data: [{ id: encodeRecordId(targetRecordId), type: this.name }],
      },
    });
  }

  async dissociate(targetRecordIds: RecordId[]): Promise<void> {
    await this.httpRequester.query({
      method: 'delete',
      path: `/forest/${this.collectionName}/${this.parentId}/relationships/${this.name}`,
      body: {
        data: {
          attributes: {
            ids: targetRecordIds.map(encodeRecordId),
            collection_name: this.name,
            all_records: false,
            all_records_ids_excluded: [],
          },
          type: 'action-requests',
        },
      },
    });
  }
}
