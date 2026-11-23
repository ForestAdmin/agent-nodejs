import type { ActivityLogCallOptions, ActivityLogContext } from '../activity-log/with-activity-log';
import type HttpRequester from '../http-requester';
import type { RecordId, SelectOptions } from '../types';

import { runCall } from '../activity-log/with-activity-log';
import QuerySerializer from '../query-serializer';
import serializeRecordId from '../record-id';

export default class Relation {
  private readonly name: string;
  private readonly collectionName: string;
  private readonly parentId: string;
  private readonly httpRequester: HttpRequester;
  private readonly activityLog?: ActivityLogContext;

  constructor(
    name: string,
    collectionName: string,
    parentId: RecordId,
    httpRequester: HttpRequester,
    activityLog?: ActivityLogContext,
  ) {
    this.name = name;
    this.collectionName = collectionName;
    this.httpRequester = httpRequester;
    this.parentId = serializeRecordId(parentId);
    this.activityLog = activityLog;
  }

  list<Data = unknown>(
    options?: SelectOptions,
    activityLog?: ActivityLogCallOptions,
  ): Promise<Data[]> {
    return runCall(
      this.activityLog,
      {
        action: 'listRelatedData',
        collectionName: this.collectionName,
        recordIds: [this.parentId],
        label: `list relation "${this.name}"`,
      },
      activityLog,
      () =>
        this.httpRequester.query<Data[]>({
          method: 'get',
          path: `/forest/${this.collectionName}/${this.parentId}/relationships/${this.name}`,
          query: QuerySerializer.serialize(options, this.collectionName),
        }),
    );
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

  async associate(targetRecordId: RecordId, activityLog?: ActivityLogCallOptions): Promise<void> {
    const targetId = serializeRecordId(targetRecordId);

    await runCall(
      this.activityLog,
      {
        action: 'update',
        collectionName: this.collectionName,
        recordIds: [this.parentId],
        label: `associate "${this.name}" with record ${targetId}`,
      },
      activityLog,
      () =>
        this.httpRequester.query({
          method: 'post',
          path: `/forest/${this.collectionName}/${this.parentId}/relationships/${this.name}`,
          body: { data: [{ id: targetId, type: this.name }] },
        }),
    );
  }

  async dissociate(
    targetRecordIds: RecordId[],
    activityLog?: ActivityLogCallOptions,
  ): Promise<void> {
    await runCall(
      this.activityLog,
      {
        action: 'update',
        collectionName: this.collectionName,
        recordIds: [this.parentId],
        label: `dissociate "${this.name}" from ${targetRecordIds.length} record(s)`,
      },
      activityLog,
      () => this.sendDissociate(targetRecordIds),
    );
  }

  private async sendDissociate(targetRecordIds: RecordId[]): Promise<void> {
    await this.httpRequester.query({
      method: 'delete',
      path: `/forest/${this.collectionName}/${this.parentId}/relationships/${this.name}`,
      body: {
        data: {
          attributes: {
            ids: targetRecordIds.map(serializeRecordId),
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
