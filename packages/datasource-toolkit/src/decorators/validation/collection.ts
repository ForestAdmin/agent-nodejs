import { Caller } from '../../interfaces/caller';
import { CollectionSchema, ColumnSchema } from '../../interfaces/schema';
import { Operator } from '../../interfaces/query/condition-tree/nodes/operators';
import { RecordData } from '../../interfaces/record';
import { ValidationError } from '../../errors';
import CollectionDecorator from '../collection-decorator';
import ConditionTreeFactory from '../../interfaces/query/condition-tree/factory';
import ConditionTreeLeaf from '../../interfaces/query/condition-tree/nodes/leaf';
import Filter from '../../interfaces/query/filter/unpaginated';

type ValidationRule = ColumnSchema['validation'][number];

export default class ValidationDecorator extends CollectionDecorator {
  private validation: Record<string, ColumnSchema['validation']> = {};

  addValidation(field: string, validation: ValidationRule): void {
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

    for (const [name, rules] of Object.entries(this.validation)) {
      const field = { ...schema.fields[name] } as ColumnSchema;
      field.validation = this.deduplicate([...(field.validation ?? []), ...rules]);
      schema.fields[name] = field;
    }

    return schema;
  }

  private validate(record: RecordData, timezone: string, allFields: boolean): void {
    for (const [name, field] of Object.entries(this.schema.fields)) {
      if (field.type === 'Column' && (allFields || record[name] !== undefined)) {
        for (const validator of field.validation ?? []) {
          const rawLeaf = { field: name, ...validator };
          const tree = ConditionTreeFactory.fromPlainObject(rawLeaf) as ConditionTreeLeaf;

          if (!tree.match(record, this, timezone)) {
            const message = `'${name}' failed validation rule:`;
            const rule =
              validator.value !== undefined
                ? `${validator.operator}(${validator.value})`
                : `'${validator.operator}'`;

            throw new ValidationError(`${message} '${rule}'`);
          }
        }
      }
    }
  }

  /**
   * Deduplicate rules which the frontend understand
   * We ignore other rules as duplications are not an issue within the agent
   */
  private deduplicate(rules: ValidationRule[]): ValidationRule[] {
    const values: Partial<Record<Operator, ValidationRule[]>> = {};

    for (const rule of rules) {
      values[rule.operator] ??= [];
      values[rule.operator].push(rule);
    }

    // Remove duplicate "Present"
    while (values.Present?.length > 1) values.Present.pop();

    // Merge duplicate 'GreaterThan', 'After' and 'LongerThan' (keep the max value)
    for (const operator of ['GreaterThan', 'After', 'LongerThan']) {
      while (values[operator]?.length > 1) {
        const last = values[operator].pop();

        values[operator][0] = {
          operator,
          value: this.max(last.value, values[operator][0].value),
        };
      }
    }

    // Merge duplicate 'LessThan', 'Before' and 'ShorterThan' (keep the min value)
    for (const operator of ['LessThan', 'Before', 'ShorterThan']) {
      while (values[operator]?.length > 1) {
        const last = values[operator].pop();

        values[operator][0] = {
          operator,
          value: this.min(last.value, values[operator][0].value),
        };
      }
    }

    return Object.values(values).reduce((memo, r) => [...memo, ...r], []);
  }

  private min(valueA: unknown, valueB: unknown): unknown {
    return valueA < valueB ? valueA : valueB;
  }

  private max(valueA: unknown, valueB: unknown): unknown {
    return valueA < valueB ? valueB : valueA;
  }
}
