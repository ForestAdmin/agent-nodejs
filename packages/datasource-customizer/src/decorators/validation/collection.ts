import {
  Caller,
  CollectionSchema,
  ColumnSchema,
  ConditionTreeFactory,
  ConditionTreeLeaf,
  ConditionTreeValidator,
  FieldValidator,
  Filter,
  Operator,
  RecordData,
  ValidationError,
} from '@forestadmin/datasource-toolkit';

import CollectionDecorator from '../collection-decorator';

type ValidationRule = ColumnSchema['validation'][number];

export default class ValidationDecorator extends CollectionDecorator {
  private validation: Record<string, ColumnSchema['validation']> = {};

  addValidation(name: string, validation: ValidationRule): void {
    FieldValidator.validate(this, name);

    const field = this.childCollection.schema.fields[name] as ColumnSchema;
    if (!field) throw new Error('Cannot add validators on a relation, use the foreign key instead');
    if (field.isReadOnly) throw new Error('Cannot add validators on a readonly field');

    this.validation[name] ??= [];
    this.validation[name].push(validation);
    this.markSchemaAsDirty();
  }

  override async create(caller: Caller, data: RecordData[]): Promise<RecordData[]> {
    for (const record of data) this.validate(record, caller.timezone, true);

    return super.create(caller, data);
  }

  override async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    this.validate(patch, caller.timezone, false);

    return super.update(caller, filter, patch);
  }

  protected override refineSchema(subSchema: CollectionSchema): CollectionSchema {
    const schema = { ...subSchema, fields: { ...subSchema.fields } };

    for (const [name, rules] of Object.entries(this.validation)) {
      const field = { ...schema.fields[name] } as ColumnSchema;
      field.validation = ValidationDecorator.deduplicate([...(field.validation ?? []), ...rules]);
      schema.fields[name] = field;
    }

    return schema;
  }

  private validate(record: RecordData, timezone: string, allFields: boolean): void {
    for (const [name, field] of Object.entries(this.schema.fields)) {
      if (field.type === 'Column' && (allFields || record[name] !== undefined)) {
        // When setting a field to null, we skip all validators but "Present"
        let rules = field.validation ?? [];
        if (record[name] === null) rules = rules.filter(r => r.operator === 'Present');

        for (const validator of rules) {
          const rawLeaf = { field: name, ...validator };
          const tree = ConditionTreeFactory.fromPlainObject(rawLeaf) as ConditionTreeLeaf;
          ConditionTreeValidator.validate(tree, this);

          if (!tree.match(record, this, timezone)) {
            const message = `'${name}' failed validation rule:`;
            const rule =
              validator.value !== undefined
                ? `${validator.operator}(${validator.value})`
                : `${validator.operator}`;

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
  private static deduplicate(rules: ValidationRule[]): ValidationRule[] {
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
          value: ValidationDecorator.max(last.value, values[operator][0].value),
        };
      }
    }

    // Merge duplicate 'LessThan', 'Before' and 'ShorterThan' (keep the min value)
    for (const operator of ['LessThan', 'Before', 'ShorterThan']) {
      while (values[operator]?.length > 1) {
        const last = values[operator].pop();

        values[operator][0] = {
          operator,
          value: ValidationDecorator.min(last.value, values[operator][0].value),
        };
      }
    }

    return Object.values(values).reduce((memo, r) => [...memo, ...r], []);
  }

  private static min(valueA: unknown, valueB: unknown): unknown {
    return valueA < valueB ? valueA : valueB;
  }

  private static max(valueA: unknown, valueB: unknown): unknown {
    return valueA < valueB ? valueB : valueA;
  }
}
