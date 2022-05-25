import { Caller } from '../../interfaces/caller';
import { CollectionSchema, ColumnSchema } from '../../interfaces/schema';
import { RecordData } from '../../interfaces/record';
import CollectionDecorator from '../collection-decorator';
import ConditionTreeFactory from '../../interfaces/query/condition-tree/factory';
import ConditionTreeLeaf from '../../interfaces/query/condition-tree/nodes/leaf';
import Filter from '../../interfaces/query/filter/unpaginated';
import ValidationError from '../../errors';

export default class ValidationDecorator extends CollectionDecorator {
  private validation: Record<string, ColumnSchema['validation']> = {};

  addValidation(field: string, validation: ColumnSchema['validation'][number]): void {
    this.validation[field] ??= [];
    this.validation[field].push(validation);
    this.markSchemaAsDirty();
  }

  override create(caller: Caller, data: RecordData[]): Promise<RecordData[]> {
    for (const record of data) this.validate(record, caller.timezone, true);

    return super.create(caller, data);
  }

  override update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    this.validate(patch, caller.timezone, true);

    return super.update(caller, filter, patch);
  }

  protected override refineSchema(subSchema: CollectionSchema): CollectionSchema {
    const schema = { ...subSchema, fields: { ...subSchema.fields } };

    for (const [name, validations] of Object.entries(this.validation)) {
      const field = { ...schema.fields[name] } as ColumnSchema;
      field.validation ??= [];
      field.validation.push(...validations);
    }

    return schema;
  }

  private validate(record: RecordData, timezone: string, allFields: boolean): void {
    for (const [name, field] of Object.entries(this.schema.fields)) {
      if (field.type === 'Column' && (allFields || record[name] !== undefined)) {
        for (const validator of field.validation ?? []) {
          const rawLeaf = { field: name, ...validator };
          const tree = ConditionTreeFactory.fromPlainObject(rawLeaf) as ConditionTreeLeaf;

          if (tree.match(record, this, timezone)) {
            throw new ValidationError(
              `'${this.name}.${name}' failed validation rule:` +
                ` '${validator.operator} ${validator.value}'`,
            );
          }
        }
      }
    }
  }
}
