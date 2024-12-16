import { CollectionRenderingPermissionV4 } from './types';

export default function isSegmentQueryAllowedOnConnection(
  collectionPermissions: CollectionRenderingPermissionV4,
  segmentQuery: string,
  connectionName: string,
): boolean {
  if (!collectionPermissions || !collectionPermissions.liveQuerySegments || !connectionName) {
    return false;
  }

  const queries = collectionPermissions.liveQuerySegments
    .filter(liveQuerySegment => liveQuerySegment.connectionName === connectionName)
    .map(({ query }) => query);

  // NOTICE: Handle UNION queries made by the FRONT to display available actions on details view
  // NOTICE: This can only be used on related data (Has Many relationships) to detect available
  // Smart Actions restricted to segment when a Smart Action is available on multiple SQL segments
  const unionQueries = segmentQuery.split('/*MULTI-SEGMENTS-QUERIES-UNION*/ UNION ');

  if (unionQueries.length > 1) {
    const authorizedQueries = new Set(queries.map(query => query.replace(/;\s*/i, '').trim()));

    return unionQueries.every((unionQuery: string) => authorizedQueries.has(unionQuery.trim()));
  }

  // NOTICE: Queries made by the FRONT to browse to an SQL segment
  return queries.some(query => query === segmentQuery);
}
