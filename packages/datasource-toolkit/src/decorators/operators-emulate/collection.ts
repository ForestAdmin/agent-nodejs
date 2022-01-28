import { SchemaUtils } from '../..';
import { Operator } from '../../interfaces/query/condition-tree/leaf';
import PaginatedFilter from '../../interfaces/query/filter/paginated';
import { CollectionSchema, ColumnSchema } from '../../interfaces/schema';
import FieldValidator from '../../validation/field';
import CollectionDecorator from '../collection-decorator';
import DataSourceDecorator from '../datasource-decorator';
import rewriteLeaf from './helpers/rewrite-leaf';
import { OperatorReplacer } from './types';

export default class OperatorsEmulate extends CollectionDecorator {
  override readonly dataSource: DataSourceDecorator<OperatorsEmulate>;

  private readonly fields: Map<string, Map<Operator, OperatorReplacer>> = new Map();

  /** @internal */
  getReplacer(name: string, operator: Operator): OperatorReplacer {
    return this.fields.get(name)?.get(operator);
  }

  emulateOperator(name: string, operator: Operator): void {
    this.implementOperator(name, operator, () => Promise.resolve(null));
  }

  implementOperator(name: string, operator: Operator, replaceBy: OperatorReplacer): void {
    // Check that the collection can actually support our rewriting
    const pks = SchemaUtils.getPrimaryKeys(this.childCollection.schema);
    pks.forEach(pk => {
      const schema = this.childCollection.schema.fields[pk] as ColumnSchema;
      const operators = schema.filterOperators;

      if (!operators?.has(Operator.Equal) || !operators?.has(Operator.Equal)) {
        throw new Error(
          `Cannot override operators on collection '${this.name}': ` +
            `the primary key columns must support 'equal' and 'in' operators`,
        );
      }
    });

    // Check that targeted field is valid
    const field = this.childCollection.schema.fields[name] as ColumnSchema;
    FieldValidator.validate(this, name);
    if (!field) throw new Error('Cannot replace operator for relation');

    // Mark the field operator as replaced.
    if (!this.fields.has(name)) this.fields.set(name, new Map());
    this.fields.get(name).set(operator, replaceBy);
  }

  protected refineSchema(childSchema: CollectionSchema): CollectionSchema {
    const fields = {};

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

  protected override async refineFilter(filter?: PaginatedFilter): Promise<PaginatedFilter> {
    return filter?.override({
      conditionTree: await filter.conditionTree?.replaceLeafsAsync(leaf => rewriteLeaf(this, leaf)),
    });
  }
}
