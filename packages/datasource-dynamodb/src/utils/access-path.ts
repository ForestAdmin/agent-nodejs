import type { KeyAttribute, TableModel } from '../types';
import type { ConditionTree, Sort } from '@forestadmin/datasource-toolkit';

import {
  ConditionTreeBranch,
  ConditionTreeFactory,
  ConditionTreeLeaf,
} from '@forestadmin/datasource-toolkit';

export type SortKeyOperator =
  | 'Equal'
  | 'LessThan'
  | 'LessThanOrEqual'
  | 'GreaterThan'
  | 'GreaterThanOrEqual'
  | 'StartsWith'
  | 'Between';

export type SortKeyCondition = { attribute: string; operator: SortKeyOperator; value: unknown };

export type AccessPath = {
  kind: 'query' | 'scan';
  /** Undefined for the table itself. */
  indexName?: string;
  /** Key attributes of the table or index read: a Query filter cannot reference them. */
  keyAttributes?: string[];
  keyCondition?: {
    /** `values` lists every partition to read, when the filter names several: one Query each. */
    partition: { attribute: string; value: string | number; values?: Array<string | number> };
    sort?: SortKeyCondition;
  };
  /** What the key condition leaves for a filter expression. */
  remaining?: ConditionTree;
  scanIndexForward: boolean;
  /** Whether reading in key order already gives the requested sort. */
  sortSatisfied: boolean;
};

export type KeyLookup = { keys: Array<Record<string, unknown>>; remaining?: ConditionTree };

type Candidate = {
  indexName?: string;
  partitionKey: KeyAttribute;
  sortKey?: KeyAttribute;
  /** Whether an item missing the sort key can still be in the index: it cannot, unless told so. */
  coversAllItems: boolean;
};

/** Keys a lookup may name: a longer list is read some other way than one BatchGetItem. */
const MAX_LOOKUP_KEYS = 10000;

/** Partitions a single filter may fan out to: each one is a request of its own. */
const MAX_PARTITIONS = 50;

const RANGE_OPERATORS = ['LessThan', 'LessThanOrEqual', 'GreaterThan', 'GreaterThanOrEqual'];

const isKeyValue = (value: unknown): value is string | number =>
  typeof value === 'string' || typeof value === 'number';

/** DynamoDB tells 1 from "1": a foreign key stored as the other type would find nothing. */
function coerceKeyValue<T>(attribute: KeyAttribute, value: T): T | string | number {
  if (attribute.type === 'N' && typeof value === 'string' && value.trim() !== '') {
    return Number.isNaN(Number(value)) ? value : Number(value);
  }

  if (attribute.type === 'S' && typeof value === 'number') return String(value);

  return value;
}

/** BatchGetItem refuses the same key twice. */
function uniqueKeys(keys: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const seen = new Set<string>();

  return keys.filter(key => {
    const id = JSON.stringify(key);

    if (seen.has(id)) return false;
    seen.add(id);

    return true;
  });
}

/** The restriction a single-table entity puts on the items of its table. */
function withEntity(model: TableModel, tree?: ConditionTree): ConditionTree | undefined {
  const { entity } = model;

  if (!entity) return tree;

  let restriction: ConditionTreeLeaf | undefined;

  if (entity.sortKeyPrefix !== undefined && model.sortKey) {
    restriction = new ConditionTreeLeaf(model.sortKey.name, 'StartsWith', entity.sortKeyPrefix);
  } else if (entity.attribute !== undefined) {
    restriction = new ConditionTreeLeaf(entity.attribute, 'Equal', entity.value);
  }

  if (!restriction) return tree;

  return tree ? ConditionTreeFactory.intersect(tree, restriction) : restriction;
}

/** The conditions that must all hold, as the root of an AND or alone. */
function conjuncts(tree?: ConditionTree): ConditionTree[] {
  if (!tree) return [];

  if (tree instanceof ConditionTreeBranch && tree.aggregator === 'And') {
    return tree.conditions.flatMap(condition => conjuncts(condition));
  }

  return [tree];
}

const leavesOf = (parts: ConditionTree[]): ConditionTreeLeaf[] =>
  parts.filter((part): part is ConditionTreeLeaf => part instanceof ConditionTreeLeaf);

function rebuild(parts: ConditionTree[]): ConditionTree | undefined {
  return parts.length ? ConditionTreeFactory.intersect(...parts) : undefined;
}

function pickSortCondition(
  sortKey: KeyAttribute,
  parts: ConditionTree[],
): { condition: SortKeyCondition; consumed: ConditionTree[] } | undefined {
  const attribute = sortKey.name;
  const onSortKey = leavesOf(parts).filter(
    leaf => leaf.field === attribute && isKeyValue(leaf.value),
  );
  const find = (operators: string[]) => onSortKey.filter(leaf => operators.includes(leaf.operator));
  const valueOf = (leaf: ConditionTreeLeaf) => coerceKeyValue(sortKey, leaf.value);

  const [equal] = find(['Equal']);

  if (equal) {
    return {
      condition: { attribute, operator: 'Equal', value: valueOf(equal) },
      consumed: [equal],
    };
  }

  const [lower] = find(['GreaterThanOrEqual']);
  const [upper] = find(['LessThanOrEqual']);

  if (lower && upper && !(valueOf(lower) > valueOf(upper))) {
    return {
      condition: { attribute, operator: 'Between', value: [valueOf(lower), valueOf(upper)] },
      consumed: [lower, upper],
    };
  }

  const [range] = find(RANGE_OPERATORS);

  if (range) {
    return {
      condition: { attribute, operator: range.operator as SortKeyOperator, value: valueOf(range) },
      consumed: [range],
    };
  }

  const [prefix] = find(['StartsWith']).sort(
    (a, b) => String(b.value).length - String(a.value).length,
  );

  if (prefix) {
    return {
      condition: { attribute, operator: 'StartsWith', value: valueOf(prefix) },
      consumed: [prefix],
    };
  }

  return undefined;
}

/**
 * Picks the cheapest way to read the items a condition tree selects: a Query on the table or on
 * an index whenever an equality pins a partition key, a Scan otherwise.
 */
export function planAccessPath(
  model: TableModel,
  conditionTree?: ConditionTree,
  sort?: Sort,
): AccessPath {
  const tree = withEntity(model, conditionTree);
  const parts = conjuncts(tree);
  const leaves = leavesOf(parts);

  const candidates: Candidate[] = [
    { partitionKey: model.partitionKey, sortKey: model.sortKey, coversAllItems: true },
    ...model.indexes
      .filter(index => index.projectsAllAttributes)
      .map(index => ({
        indexName: index.name,
        partitionKey: index.partitionKey,
        sortKey: index.sortKey,
        coversAllItems: !!index.coversAllItems,
      })),
  ];

  let best: { path: AccessPath; score: number } | undefined;

  for (const candidate of candidates) {
    const onPartitionKey = leaves.filter(leaf => leaf.field === candidate.partitionKey.name);
    const equal = onPartitionKey.find(leaf => leaf.operator === 'Equal' && isKeyValue(leaf.value));
    const partition =
      equal ??
      onPartitionKey.find(
        leaf =>
          leaf.operator === 'In' &&
          Array.isArray(leaf.value) &&
          leaf.value.length > 0 &&
          leaf.value.length <= MAX_PARTITIONS &&
          leaf.value.every(isKeyValue),
      );
    const partitionValues = partition
      ? [
          ...new Set(
            (partition.operator === 'Equal'
              ? [partition.value]
              : (partition.value as unknown[])
            ).map(value => coerceKeyValue(candidate.partitionKey, value) as string | number),
          ),
        ]
      : [];

    const picked =
      partition && candidate.sortKey ? pickSortCondition(candidate.sortKey, parts) : undefined;

    // An index leaves out the items that lack its sort key: without a condition on that key, it
    // could return fewer items than the table holds.
    const mayMissItems =
      !!candidate.indexName && !!candidate.sortKey && !picked && !candidate.coversAllItems;

    if (partition && !mayMissItems) {
      const sortClause = sort?.length === 1 ? sort[0] : undefined;
      // Several partitions are read one after the other: their items are not in one key order.
      const sortSatisfied =
        !!sortClause &&
        sortClause.field === candidate.sortKey?.name &&
        partitionValues.length === 1;
      const consumed = new Set<ConditionTree>([partition, ...(picked?.consumed ?? [])]);
      const score = (picked ? 2 : 0) + (sortSatisfied ? 1 : 0);

      if (!best || score > best.score) {
        best = {
          score,
          path: {
            kind: 'query',
            indexName: candidate.indexName,
            keyAttributes: [candidate.partitionKey.name, candidate.sortKey?.name].filter(Boolean),
            keyCondition: {
              partition: {
                attribute: candidate.partitionKey.name,
                value: partitionValues[0],
                ...(partitionValues.length > 1 ? { values: partitionValues } : {}),
              },
              sort: picked?.condition,
            },
            remaining: rebuild(parts.filter(part => !consumed.has(part))),
            scanIndexForward: sortSatisfied ? sortClause.ascending : true,
            sortSatisfied,
          },
        };
      }
    }
  }

  return (
    best?.path ?? {
      kind: 'scan',
      remaining: tree,
      scanIndexForward: true,
      sortSatisfied: false,
    }
  );
}

function keysFromOr(model: TableModel, part: ConditionTree): KeyLookup['keys'] | null {
  if (!(part instanceof ConditionTreeBranch) || part.aggregator !== 'Or') return null;

  const keys: KeyLookup['keys'] = [];

  for (const condition of part.conditions) {
    const armParts = conjuncts(condition);

    // An arm with a nested branch carries a filter the keys alone would drop.
    if (armParts.some(armPart => !(armPart instanceof ConditionTreeLeaf))) return null;

    const equalities = leavesOf(armParts);
    const key: Record<string, unknown> = {};

    for (const attribute of [model.partitionKey, model.sortKey].filter(Boolean)) {
      const equal = equalities.find(
        leaf =>
          leaf.field === attribute.name && leaf.operator === 'Equal' && isKeyValue(leaf.value),
      );

      if (!equal) return null;
      key[attribute.name] = coerceKeyValue(attribute, equal.value);
    }

    if (equalities.length !== Object.keys(key).length) return null;
    keys.push(key);
  }

  return uniqueKeys(keys);
}

/**
 * Detects the filters that name whole keys, which BatchGetItem reads without scanning or
 * querying: a single key, a list of keys, or the OR of key equalities the relation emulation sends.
 */
export function planKeyLookup(model: TableModel, conditionTree?: ConditionTree): KeyLookup | null {
  const tree = withEntity(model, conditionTree);

  if (!tree) return null;

  const parts = conjuncts(tree);
  const keyAttributes = [model.partitionKey, model.sortKey].filter(Boolean);

  const valuesOf = (attribute: KeyAttribute) => {
    const leaf = leavesOf(parts).find(
      candidate =>
        candidate.field === attribute.name &&
        (candidate.operator === 'Equal' || candidate.operator === 'In') &&
        (candidate.operator === 'Equal'
          ? isKeyValue(candidate.value)
          : Array.isArray(candidate.value) && candidate.value.every(isKeyValue)),
    );

    if (!leaf) return undefined;

    return {
      leaf,
      values: [
        ...new Set(
          ((leaf.operator === 'Equal' ? [leaf.value] : leaf.value) as Array<string | number>).map(
            value => coerceKeyValue(attribute, value),
          ),
        ),
      ],
    };
  };

  const resolved = keyAttributes.map(attribute => ({ attribute, found: valuesOf(attribute) }));

  if (resolved.every(({ found }) => found)) {
    // The keys are the product of the lists: a huge one is never built.
    const product = resolved.reduce((count, { found }) => count * found.values.length, 1);

    if (product > MAX_LOOKUP_KEYS) return null;

    const keys = resolved.reduce<Array<Record<string, unknown>>>(
      (combined, { attribute, found }) =>
        combined.flatMap(key => found.values.map(value => ({ ...key, [attribute.name]: value }))),
      [{}],
    );
    const consumed = new Set<ConditionTree>(resolved.map(({ found }) => found.leaf));

    return {
      keys: uniqueKeys(keys),
      remaining: rebuild(parts.filter(part => !consumed.has(part))),
    };
  }

  for (const part of parts) {
    const keys = keysFromOr(model, part);

    if (keys) return { keys, remaining: rebuild(parts.filter(other => other !== part)) };
  }

  return null;
}
