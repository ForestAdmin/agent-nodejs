import { PullDeltaRequest } from '@forestadmin/datasource-replica';

// eslint-disable-next-line import/prefer-default-export
export async function retrieveRequestedIds(
  cache: PullDeltaRequest['cache'],
  reasons: PullDeltaRequest['reasons'],
): Promise<{ [collectionName: string]: string[] }> {
  const ids = {};
  await Promise.all(
    reasons.map(async reason => {
      if ('filter' in reason && 'collection' in reason) {
        const recordIds = await cache.getCollection(reason.collection).list(reason.filter, ['id']);

        ids[reason.collection] = recordIds.map(r => r.id);
      }
    }),
  );

  return ids;
}
