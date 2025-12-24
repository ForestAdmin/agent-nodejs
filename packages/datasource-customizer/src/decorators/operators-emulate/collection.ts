import type { OperatorDefinition } from './types';
import type {
  Caller,
  CollectionSchema,
  ColumnSchema,
  ConditionTreeLeaf,
  DataSourceDecorator,
  FieldSchema,
  Operator,
} from '@forestadmin/datasource-toolkit';

import {
  CollectionDecorator,
  ConditionTree,
  ConditionTreeFactory,
  ConditionTreeValidator,
  FieldValidator,
  PaginatedFilter,
  SchemaUtils,
} from '@forestadmin/datasource-toolkit';

import CollectionCustomizationContext from '../../context/collection-context';

export default class OperatorsEmulateCollectionDecorator extends CollectionDecorator {
  override readonly dataSource: DataSourceDecorator<OperatorsEmulateCollectionDecorator>;
  private readonly fields: Map<string, Map<Operator, OperatorDefinition | null>> = new Map();

  emulateFieldOperator(name: string, operator: Operator): void {
    this.replaceOrEmulateFieldOperator(name, operator, null);
  }

  replaceFieldOperator(name: string, operator: Operator, replaceBy: OperatorDefinition): void {
    if (!replaceBy) throw new Error('replaceBy handler is required');
    this.replaceOrEmulateFieldOperator(name, operator, replaceBy);
  }

  private replaceOrEmulateFieldOperator(
    name: string,
    operator: Operator,
    replaceBy: OperatorDefinition | null,
  ): void {
    // Check that the collection can actually support our rewriting
    const pks = SchemaUtils.getPrimaryKeys(this.childCollection.schema);
    pks.forEach(pk => {
      const schema = SchemaUtils.getField(
        this.childCollection.schema,
        pk,
        this.childCollection.name,
      ) as ColumnSchema;
      const operators = schema.filterOperators;

      if (!operators?.has('Equal') || !operators?.has('In')) {
        throw new Error(
          `Cannot override operators on collection '${this.name}': ` +
            `the primary key columns must support 'Equal' and 'In' operators`,
        );
      }
    });

    // Check that targeted field is valid
    SchemaUtils.throwIfMissingField(this.childCollection.schema, name, this.childCollection.name);
    FieldValidator.validate(this, name);

    // Mark the field operator as replaced.
    if (!this.fields.has(name)) this.fields.set(name, new Map());
    this.fields.get(name).set(operator, replaceBy);
    this.markSchemaAsDirty();
  }

  protected override refineSchema(childSchema: CollectionSchema): CollectionSchema {
    const fields: Record<string, FieldSchema> = {};

    for (const [name, schema] of Object.entries(childSchema.fields)) {
      if (this.fields.has(name)) {
        const column = schema as ColumnSchema;
        fields[name] = {
          ...column,
          filterOperators: new Set([
            ...(column.filterOperators ?? []),
            ...this.fields.get(name).keys(),
          ]),
        };
      } else {
        fields[name] = schema;
      }
    }

    return { ...childSchema, fields };
  }

  protected override async refineFilter(
    caller: Caller,
    filter: PaginatedFilter,
  ): Promise<PaginatedFilter> {
    return filter?.override({
      conditionTree: await filter.conditionTree?.replaceLeafsAsync(leaf =>
        this.replaceLeaf(caller, leaf, []),
      ),
    });
  }

  private async replaceLeaf(
    caller: Caller,
    leaf: ConditionTreeLeaf,
    replacements: string[],
  ): Promise<ConditionTree> {
    // ConditionTree is targeting a field on another collection => recurse.
    if (leaf.field.includes(':')) {
      const [prefix] = leaf.field.split(':');
      const schema = SchemaUtils.getRelation(this.schema, prefix, this.name);
      const association = this.dataSource.getCollection(schema.foreignCollection);
      const associationLeaf = await leaf
        .unnest()
        .replaceLeafsAsync(subLeaf => association.replaceLeaf(caller, subLeaf, replacements));

      return associationLeaf.nest(prefix);
    }

    return this.fields.get(leaf.field)?.has(leaf.operator)
      ? this.computeEquivalent(caller, leaf, replacements)
      : leaf;
  }

  private async computeEquivalent(
    caller: Caller,
    leaf: ConditionTreeLeaf,
    replacements: string[],
  ): Promise<ConditionTree> {
    const handler = this.fields.get(leaf.field)?.get(leaf.operator);

    if (handler) {
      const replacementId = `${this.name}.${leaf.field}[${leaf.operator}]`;
      const subReplacements = [...replacements, replacementId];

      if (replacements.includes(replacementId)) {
        throw new Error(`Operator replacement cycle: ${subReplacements.join(' -> ')}`);
      }

      const result = await handler(leaf.value, new CollectionCustomizationContext(this, caller));

      if (result) {
        let equivalent =
          result instanceof ConditionTree ? result : ConditionTreeFactory.fromPlainObject(result);

        equivalent = await equivalent.replaceLeafsAsync(subLeaf =>
          this.replaceLeaf(caller, subLeaf, subReplacements),
        );

        ConditionTreeValidator.validate(equivalent, this);

        return equivalent;
      }
    }

    // Query all records on the dataSource and emulate the filter.
    return ConditionTreeFactory.matchRecords(
      this.schema,
      leaf.apply(
        await this.list(caller, new PaginatedFilter({}), leaf.projection.withPks(this)),
        this,
        caller.timezone,
      ),
    );
  }
}
