import type ComponentPool from './component-pool';
import type { CollectionFields, FilterableField, UnfoldedCollection } from './unfolding';
import type { ReferenceObject, SchemaObject } from 'openapi3-ts/oas31';

import { quoted } from './names';
import { OPERATORS } from './schemas';

const AGGREGATORS = ['And', 'Or'];

type FilterPlan = { key: string; collection: UnfoldedCollection };

/**
 * Whether the document knows which fields the collection exposes. Only `capabilities_unavailable`
 * leaves it unknown — the agent could not be asked. `no_fields` is an ANSWER: capabilities were read
 * and name none, so every field is rejected, and `null` carries the enumerated set. The difference
 * decides whether an empty set means "do not constrain" or "nothing is valid here".
 */
export function isFieldSetKnown(fields: CollectionFields): boolean {
  return fields.degraded !== 'capabilities_unavailable';
}

/**
 * Whether an empty `filterable` is an answer. It is not enough that the field set is known: the
 * collector also empties `filterable` by dropping every field whose operator set it cannot map, and
 * that collection filters fine at runtime. Documenting it as filterable by nothing would refuse, at
 * compile time in a generated client, a filter the agent honours.
 */
function isFilterSetKnown(fields: CollectionFields): boolean {
  return isFieldSetKnown(fields) && !fields.undocumentableFilter;
}

interface OperatorGroup {
  fields: string[];
  operators: string[];
}

/**
 * Groups the filterable fields by the operator set they share. One leaf per field would be as exact
 * but would multiply the document by the field count; the number of distinct operator sets is bounded
 * by the column types a collection really uses, and the cross product of a group is precisely the set
 * of valid `(field, operator)` pairs. The grouping is derived from what capabilities reported — two
 * fields of DIFFERENT types sharing an operator set land in one group, so nothing here is a type
 * table.
 */
function groupByOperators(filterable: FilterableField[]): OperatorGroup[] {
  const groups = new Map<string, OperatorGroup>();

  filterable.forEach(field => {
    if (field.operators.length === 0) return;

    // Safe as a key because the operators are normalized to one canonical order at collect time.
    const signature = field.operators.join(',');
    const group = groups.get(signature);

    if (group) group.fields.push(field.name);
    else groups.set(signature, { fields: [field.name], operators: [...field.operators] });
  });

  return [...groups.values()];
}

function leafShape(
  field: ReferenceObject | SchemaObject,
  operators: string[],
  description: string,
): SchemaObject {
  return {
    type: 'object',
    description,
    properties: {
      field,
      operator: { type: 'string', enum: operators },
      value: {},
    },
    required: ['field', 'operator'],
    additionalProperties: false,
  };
}

/**
 * One leaf alternative per operator set. A field absent from `filterable` is in none of them, which is
 * the only honest way to document it: a `ManyToOne` answers 422 field_not_filterable, and a field the
 * collector dropped for an unmappable operator answers 500 mapping_error on every filter.
 */
function filterLeaves(pool: ComponentPool, plan: FilterPlan) {
  const { name, fields } = plan.collection;
  const groups = groupByOperators(fields.filterable);

  // No filterable field, and the two reasons are not the same document. Capabilities that could not
  // be read leave the field set UNKNOWN, so the leaf stays free-form: the collection still accepts
  // whatever it really exposes, and the runtime is the one that rejects. Capabilities that were read
  // and name nothing filterable leave no valid leaf at all — advertising a free-form one would offer
  // a filter the validator answers 422 on for every field, so the tree keeps only its branch and
  // empty-object alternatives.
  if (groups.length === 0) {
    if (isFilterSetKnown(fields)) return [];

    return [
      pool.add(
        `FilterLeaf_${plan.key}`,
        leafShape({ type: 'string' }, OPERATORS, `A single condition on ${quoted(name)}.`),
      ),
    ];
  }

  // `-` rather than `_` before the index, and the difference is load-bearing: `sanitizeIdentifier` maps
  // every character outside `[A-Za-z0-9_]` to `_`, so a collection key can end in `_<digit>` — either
  // because the customer named a collection `Invoice 1`, or because `createNamer` suffixed a name that
  // collapsed. With `_`, collection `Invoice 1` (no group, so the bare name below) and collection
  // `Invoice` (first group) both claim `FilterLeaf_Invoice_1`, and `ComponentPool.add` settles it
  // last-wins in silence — one collection would document the other's fields and operators. Sanitizing
  // can never produce a `-`, so this separator makes the two namespaces disjoint by construction.
  return groups.map((group, index) =>
    pool.add(
      `FilterLeaf_${plan.key}-${index + 1}`,
      leafShape(
        { type: 'string', enum: group.fields },
        group.operators,
        `A single condition on ${quoted(name)}. These fields share one operator set, as the ` +
          "collection's capabilities report it.",
      ),
    ),
  );
}

export default function filterSchema(
  { pool }: { pool: ComponentPool },
  plan: FilterPlan,
): ReferenceObject {
  const { name, fields } = plan.collection;
  const treeName = `Filter_${plan.key}`;
  const treeRef = { $ref: `#/components/schemas/${treeName}` };
  const leaves = filterLeaves(pool, plan);
  const pairing = (() => {
    if (fields.filterable.length > 0) {
      return (
        ' There is one leaf alternative per operator set: a field accepts only the operators of ' +
        'the alternative listing it, and an operator it does not support answers 400 ' +
        'invalid_filter_operator.'
      );
    }

    if (isFilterSetKnown(fields)) {
      return (
        ' No field of this collection is filterable, so there is no leaf alternative at all: ' +
        'send the empty object, or no filter.'
      );
    }

    return '';
  })();

  return pool.add(treeName, {
    description:
      `A filter on ${quoted(name)}: either a leaf condition, a branch nesting more ` +
      'conditions, or the empty object, which is how an absent filter is spelled. A branch must ' +
      'carry its aggregator. A node carrying both `field` and ' +
      `\`conditions\` is rejected with 400, so the two shapes are mutually exclusive.${pairing}`,
    anyOf: [
      ...leaves,
      {
        type: 'object',
        properties: {
          aggregator: { type: 'string', enum: AGGREGATORS },
          conditions: { type: 'array', items: treeRef },
        },
        required: ['aggregator', 'conditions'],
        additionalProperties: false,
      },
      { type: 'object', additionalProperties: false },
    ],
  });
}
