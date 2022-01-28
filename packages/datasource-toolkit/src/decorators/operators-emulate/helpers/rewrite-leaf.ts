import ConditionTree from '../../../interfaces/query/condition-tree/base';
import ConditionTreeLeaf from '../../../interfaces/query/condition-tree/leaf';
import { RelationSchema } from '../../../interfaces/schema';
import ConditionTreeUtils from '../../../utils/condition-tree';
import ConditionTreeValidator from '../../../validation/condition-tree';
import OperatorsEmulate from '../collection';

export default async function replaceEmulatedLeafs(
  collection: OperatorsEmulate,
  leaf: ConditionTreeLeaf,
  replacements: string[] = [],
): Promise<ConditionTree> {
  // ConditionTree is targeting a field on another collection => recurse.
  if (leaf.field.includes(':')) {
    const [prefix] = leaf.field.split(':');
    const schema = collection.schema.fields[prefix] as RelationSchema;
    const association = collection.dataSource.getCollection(schema.foreignCollection);
    const associationLeaf = await leaf
      .unnest()
      .replaceLeafsAsync(subLeaf => replaceEmulatedLeafs(association, subLeaf));

    return associationLeaf.nest(prefix);
  }

  return collection.hasReplacer(leaf.field, leaf.operator)
    ? // eslint-disable-next-line @typescript-eslint/no-use-before-define
      replaceLeaf(collection, leaf, replacements)
    : leaf;
}

async function replaceLeaf(
  collection: OperatorsEmulate,
  leaf: ConditionTreeLeaf,
  replacements: string[] = [],
) {
  const handler = collection.getReplacer(leaf.field, leaf.operator);

  if (handler) {
    const replacementId = `${leaf.field}[${leaf.operator}]`;
    const subReplacements = [...replacements, replacementId];

    if (replacements.includes(replacementId)) {
      throw new Error(
        `Operator replacement cycle detected on collection '${
          collection.name
        }': ${subReplacements.join(' -> ')}`,
      );
    }

    let equivalentTree = await handler(leaf.value, collection.dataSource);

    // Equivalent tree might be null
    if (equivalentTree) {
      // Recurse (equivalent tree can depend on an operator which is emulated).
      equivalentTree = await equivalentTree.replaceLeafsAsync(subLeaf =>
        replaceEmulatedLeafs(collection, subLeaf, subReplacements),
      );

      // Validate that the final filter is not using unsupported operators.
      ConditionTreeValidator.validate(equivalentTree, collection);

      return equivalentTree;
    }
  }

  // Query all records on the dataSource and emulate the filter.
  return ConditionTreeUtils.matchRecords(
    collection.schema,
    leaf.apply(await collection.list(null, leaf.projection.withPks(collection))),
  );
}
