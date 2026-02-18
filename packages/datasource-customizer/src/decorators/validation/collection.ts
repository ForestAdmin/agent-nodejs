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
  RelationSchema,
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

  override async create(caller: Caller, data: RecordData[]): Promise<RecordData[]> {
    for (const record of data) this.validate(record, caller.timezone, true);

    return super.create(caller, data);
  }

  override async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    this.validate(patch, caller.timezone, false);

    return super.update(caller, filter, patch);
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
    const capabilities = this.schema.aggregationCapabilities;
    if (!capabilities) return;

    const groups = aggregation.groups ?? [];
    if (groups.length === 0) return;

    if (!capabilities.supportGroups) {
      throw new ValidationError('This collection does not support aggregate with groups.');
    }

    for (const group of groups) {
      let { field } = group;
      let { schema } = this;

      if (field.includes(':')) {
        const paths = field.split(':');
        field = paths.pop();
        schema = paths.reduce((s: CollectionSchema, path: string) => {
          return this.dataSource.getCollection((s.fields[path] as RelationSchema).foreignCollection)
            .schema;
        }, this.schema);
      }

      if (!(schema.fields[field] as ColumnSchema).isGroupable) {
        throw new ValidationError(`Field '${group.field}' is not groupable on "${this.name}".`);
      }
    }

    for (const group of groups) {
      if (group.operation && !capabilities.supportedDateOperations.has(group.operation)) {
        const supported =
          capabilities.supportedDateOperations.size > 0
            ? [...capabilities.supportedDateOperations].join(', ')
            : 'none';

        throw new ValidationError(
          `Collection "${this.name}" does not support the '${group.operation}' date operation. ` +
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
