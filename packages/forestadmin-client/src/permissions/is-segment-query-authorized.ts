export default function isSegmentQueryAllowed(
  inputSegmentQuery: string,
  authorizedSegments: string[],
): boolean {
  if (!authorizedSegments) {
    return false;
  }

  // NOTICE: Handle UNION queries made by the FRONT to display available actions on details view
  // NOTICE: This can only be used on related data (Has Many relationships) to detect available
  // Smart Actions restricted to segment when a Smart Action is available on multiple SQL segments
  const unionQueries = inputSegmentQuery.split('/*MULTI-SEGMENTS-QUERIES-UNION*/ UNION ');

  if (unionQueries.length > 1) {
    const authorizedQueries = new Set(
      authorizedSegments.map(segmentQuery => segmentQuery.replace(/;\s*/i, '').trim()),
    );

    return unionQueries.every((unionQuery: string) => authorizedQueries.has(unionQuery.trim()));
  }

  // NOTICE: Queries made by the FRONT to browse to an SQL segment
  return authorizedSegments.some(segmentQuery => segmentQuery === inputSegmentQuery);
}
