import { CollectionSegment, ManualCollectionSegment } from './types';

export default function isSegmentQueryAllowed(
  inputSegmentQuery: string,
  authorizedSegments: CollectionSegment[],
): boolean {
  if (!authorizedSegments) {
    return false;
  }

  // NOTICE: Handle UNION queries made by the FRONT to display available actions on details view
  const unionQueries = inputSegmentQuery.split('/*MULTI-SEGMENTS-QUERIES-UNION*/ UNION ');

  if (unionQueries.length > 1) {
    const authorizedQueries = new Set(
      authorizedSegments
        .filter(segment => (segment as ManualCollectionSegment).query)
        .map(segment => (segment as ManualCollectionSegment).query.replace(/;\s*/i, '')),
    );

    return unionQueries.every((unionQuery: string) => authorizedQueries.has(unionQuery.trim()));
  }

  // NOTICE: Queries made by the FRONT to browse to an SQL segment
  return authorizedSegments.some(
    segment => (segment as ManualCollectionSegment)?.query === inputSegmentQuery,
  );
}
