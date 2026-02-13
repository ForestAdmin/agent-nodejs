import type {
  AggregateResult,
  Aggregation,
  Caller,
  CollectionSchema,
  ColumnSchema,
  ColumnSchemaValidation,
  ConditionTreeLeaf,
  Filter,
  RecordData,
} from '@forestadmin/datasource-toolkit';

import {
  CollectionDecorator,
  ConditionTreeFactory,
  FieldValidator,
  SchemaUtils,
  ValidationError,
} from '@forestadmin/datasource-toolkit';

type ValidationRule = ColumnSchemaValidation[number];

export default class ValidationDecorator extends CollectionDecorator {
  private validation: Record<string, ColumnSchema['validation']> = {};
  private nullableFields: string[] = [];

  addValidation(name: string, validation: ValidationRule): void {
    FieldValidator.validate(this, name);

    const field = SchemaUtils.getColumn(this.schema, name, this.name);

    if (field?.type !== 'Column') {
      throw new Error('Cannot add validators on a relation, use the foreign key instead');
    }

    if (field.isReadOnly) throw new Error('Cannot add validators on a readonly field');

    this.validation[name] ??= [];
    this.validation[name].push(validation);
    this.markSchemaAsDirty();
  }

  setNullable(name: string): void {
    this.nullableFields.push(name);
    this.markSchemaAsDirty();
  }

  override async aggregate(
    caller: Caller,
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    this.validateAggregation(aggregation);

    return super.aggregate(caller, filter, aggregation, limit);
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
      const field = { ...SchemaUtils.getColumn(schema, name) };
      field.validation = [...(field.validation ?? []), ...rules];
      schema.fields[name] = field;
    }

    this.nullableFields.forEach(name => {
      const field = { ...SchemaUtils.getColumn(schema, name) };
      field.allowNull = true;
      field.validation = field.validation?.filter(validation => validation.operator !== 'Present');
      schema.fields[name] = field;
    });

    return schema;
  }

  private validateAggregation(aggregation: Aggregation): void {
    const capabilities = this.schema.aggregateCapabilities;
    if (!capabilities) return;

    const groups = aggregation.groups ?? [];
    if (groups.length === 0) return;

    if (!capabilities.supportGroups) {
      throw new ValidationError('This collection does not support aggregate with groups.');
    }

    for (const group of groups) {
      const field = this.schema.fields[group.field];

      if (field?.type === 'Column' && field.isGroupable === false) {
        throw new ValidationError(`Field '${group.field}' is not groupable.`);
      }
    }

    for (const group of groups) {
      if (group.operation && !capabilities.supportDateOperations.has(group.operation)) {
        const supported =
          capabilities.supportDateOperations.size > 0
            ? [...capabilities.supportDateOperations].join(', ')
            : 'none';

        throw new ValidationError(
          `This collection does not support the '${group.operation}' date operation. ` +
            `Supported date operations: [${supported}].`,
        );
      }
    }
  }

  private validate(record: RecordData, timezone: string, allFields: boolean): void {
    for (const [name, rules] of Object.entries(this.validation)) {
      if (allFields || record[name] !== undefined) {
        // When setting a field to null, only the "Present" validator is relevant
        const applicableRules =
          record[name] === null ? rules.filter(r => r.operator === 'Present') : rules;

        for (const validator of applicableRules) {
          const rawLeaf = { field: name, ...validator };
          const tree = ConditionTreeFactory.fromPlainObject(rawLeaf) as ConditionTreeLeaf;

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
}
