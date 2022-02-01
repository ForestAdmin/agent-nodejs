import Sort, { SortClause } from '../../../interfaces/query/sort';
import { RelationSchema } from '../../../interfaces/schema';
import SortEmulate from '../collection';

export default function rewriteSort(collection: SortEmulate, clause: SortClause): Sort {
  // Order by is targeting a field on another collection => recurse.
  if (clause.field.includes(':')) {
    const [prefix] = clause.field.split(':');
    const schema = collection.schema.fields[prefix] as RelationSchema;
    const association = collection.dataSource.getCollection(schema.foreignCollection);

    return new Sort(clause)
      .unnest()
      .replaceClauses(subClause => rewriteSort(association, subClause))
      .nest(prefix);
  }

  // Computed field that we own: recursively replace using equivalent sort
  let equivalentSort = collection.getSort(clause.field);

  if (equivalentSort) {
    if (!clause.ascending) equivalentSort = equivalentSort.inverse();

    return equivalentSort.replaceClauses(subClause => rewriteSort(collection, subClause));
  }

  return new Sort(clause);
}
