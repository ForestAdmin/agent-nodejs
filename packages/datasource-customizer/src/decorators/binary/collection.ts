import type { BinaryMode } from './types';
import type {
  AggregateResult,
  Aggregation,
  Caller,
  CollectionSchema,
  ColumnSchema,
  ColumnType,
  ConditionTree,
  ConditionTreeLeaf,
  DataSourceDecorator,
  FieldSchema,
  Filter,
  PaginatedFilter,
  Projection,
  RecordData,
} from '@forestadmin/datasource-toolkit';

import {
  CollectionDecorator,
  SchemaUtils,
  TypeGetter,
  ValidationError,
  parseDataUri,
} from '@forestadmin/datasource-toolkit';
import { filetypemime } from 'magic-bytes.js';

const HEX_BYTES = /^([0-9a-f]{2})+$/i;

type BinaryColumn = { columnType: ColumnType; useHex: boolean };
type ConversionPlan = {
  columns: Map<string, BinaryColumn>;
  relations: Map<string, { collection: BinaryCollectionDecorator; plan: ConversionPlan }>;
};

/**
 * As the transport layer between the forest admin agent and the frontend is JSON-API, binary data
 * is not supported.
 *
 * This decorator implement binary to string translation for binary fields and back.
 * Binary fields can either by represented in the frontend as:
 * - data-uris (so that the current file widgets can be used)
 * - hex strings (for primarykeys, foreign keys, etc...)
 */
export default class BinaryCollectionDecorator extends CollectionDecorator {
  // For those operators, we need to replace hex string/datauri by Buffers instances (depending
  // on what is actually supported by the underlying connector).
  private static readonly operatorsWithValueReplacement = [
    ...['After', 'Before', 'Contains', 'EndsWith', 'Equal', 'GreaterThan', 'IContains', 'NotIn'],
    ...['IEndsWith', 'IStartsWith', 'LessThan', 'NotContains', 'NotEqual', 'StartsWith', 'In'],
  ];

  override dataSource: DataSourceDecorator<BinaryCollectionDecorator>;
  private useHexConversion: Map<string, boolean> = new Map();
  private cachedBinaryColumns: Map<string, BinaryColumn> | null = null;

  setBinaryMode(name: string, type: BinaryMode): void {
    const field = SchemaUtils.getField(
      this.childCollection.schema,
      name,
      this.childCollection.name,
    );

    if (type !== 'datauri' && type !== 'hex') {
      throw new Error('Invalid binary mode');
    }

    if (field?.type === 'Column' && field?.columnType === 'Binary') {
      this.useHexConversion.set(name, type === 'hex');
      this.markSchemaAsDirty();
    } else {
      throw new Error('Expected a binary field');
    }
  }

  protected override markSchemaAsDirty(): void {
    this.cachedBinaryColumns = null;
    super.markSchemaAsDirty();
  }

  private get binaryColumns(): Map<string, BinaryColumn> {
    this.cachedBinaryColumns ??= this.computeBinaryColumns(this.childCollection.schema);

    return this.cachedBinaryColumns;
  }

  private computeBinaryColumns(schema: CollectionSchema): Map<string, BinaryColumn> {
    const foreignKeys = new Set<string>();
    const binaryColumns = new Map<string, BinaryColumn>();

    for (const field of Object.values(schema.fields)) {
      if (field.type === 'ManyToOne') foreignKeys.add(field.foreignKey);
    }

    for (const [name, field] of Object.entries(schema.fields)) {
      if (field.type === 'Column' && this.containsBinary(field.columnType)) {
        const useHex =
          this.useHexConversion.get(name) ?? (Boolean(field.isPrimaryKey) || foreignKeys.has(name));

        binaryColumns.set(name, { columnType: field.columnType, useHex });
      }
    }

    return binaryColumns;
  }

  private containsBinary(columnType: ColumnType): boolean {
    if (typeof columnType === 'string') return columnType === 'Binary';
    if (Array.isArray(columnType)) return this.containsBinary(columnType[0]);

    return Object.values(columnType).some(
      type => !TypeGetter.isEnumField(type) && this.containsBinary(type),
    );
  }

  private shouldUseHex(name: string): boolean {
    return this.binaryColumns.get(name)?.useHex ?? false;
  }

  private getForeignCollection(name: string): BinaryCollectionDecorator | null {
    const { fields } = this.childCollection.schema;
    if (!Object.prototype.hasOwnProperty.call(fields, name)) return null;

    const field = fields[name];
    if (field.type === 'Column') return null;

    return this.dataSource.getCollection(field.foreignCollection);
  }

  override async list(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    const records = await super.list(caller, filter, projection);
    const plan = this.buildConversionPlan(projection);

    if (!plan) return records;

    return records.map(record => this.applyConversionPlan(plan, record));
  }

  override async aggregate(
    caller: Caller,
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    const rows = await super.aggregate(caller, filter, aggregation, limit);
    const binaryGroups = new Map<string, BinaryColumn>();

    for (const { field } of aggregation.groups ?? []) {
      const column = this.resolveBinaryColumn(field);
      if (column) binaryGroups.set(field, column);
    }

    if (!binaryGroups.size) return rows;

    return rows.map(row => {
      const group = { ...row.group };

      for (const [field, { columnType, useHex }] of binaryGroups) {
        if (Object.prototype.hasOwnProperty.call(group, field)) {
          group[field] = this.convertValueHelper(false, columnType, useHex, group[field]);
        }
      }

      return { value: row.value, group };
    });
  }

  override async create(caller: Caller, data: RecordData[]): Promise<RecordData[]> {
    const dataWithBinary = data.map(record => this.convertRecord(true, record));
    const records = await super.create(caller, dataWithBinary);

    return records.map(record => this.convertRecord(false, record));
  }

  override async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    return super.update(caller, filter, this.convertRecord(true, patch));
  }

  override async refineFilter(caller: Caller, filter?: PaginatedFilter): Promise<PaginatedFilter> {
    const conditionTree = filter?.conditionTree;

    if (!conditionTree?.someLeaf(leaf => this.needsValueConversion(leaf))) return filter;

    return filter.override({
      conditionTree: conditionTree.replaceLeafs(leaf => this.convertConditionTreeLeaf(leaf)),
    });
  }

  protected override refineSchema(subSchema: CollectionSchema): CollectionSchema {
    const fields: Record<string, FieldSchema> = {};

    for (const [name, schema] of Object.entries(subSchema.fields)) {
      if (schema.type === 'Column') {
        const columnType = this.replaceColumnType(schema.columnType);
        const validation = this.replaceValidation(name, schema);

        fields[name] = { ...schema, columnType, validation };
      } else {
        fields[name] = schema;
      }
    }

    return { ...subSchema, fields };
  }

  private buildConversionPlan(projection: Projection): ConversionPlan | null {
    // Every binary column is planned, projected or not: a child may return more than asked for.
    const plan: ConversionPlan = { columns: this.binaryColumns, relations: new Map() };

    for (const [prefix, subProjection] of Object.entries(projection.relations)) {
      if (!this.binaryColumns.has(prefix)) {
        const collection = this.getForeignCollection(prefix);
        const subPlan = collection?.buildConversionPlan(subProjection);

        if (subPlan) plan.relations.set(prefix, { collection, plan: subPlan });
      }
    }

    return plan.columns.size || plan.relations.size ? plan : null;
  }

  private applyConversionPlan(plan: ConversionPlan, record: RecordData): RecordData {
    if (!record) return record;

    const converted = { ...record };

    for (const [name, { columnType, useHex }] of plan.columns) {
      if (Object.prototype.hasOwnProperty.call(converted, name)) {
        converted[name] = this.convertValueHelper(false, columnType, useHex, converted[name]);
      }
    }

    for (const [name, { collection, plan: subPlan }] of plan.relations) {
      if (Object.prototype.hasOwnProperty.call(converted, name)) {
        converted[name] = collection.applyConversionPlan(subPlan, converted[name]);
      }
    }

    return converted;
  }

  private resolveBinaryColumn(path: string): BinaryColumn | undefined {
    const binaryColumn = this.binaryColumns.get(path);
    if (binaryColumn) return binaryColumn;

    const [prefix, suffix] = path.split(/:(.*)/);
    if (!suffix) return undefined;

    const parentColumn = this.binaryColumns.get(prefix);
    if (parentColumn) return this.resolveNestedBinaryColumn(parentColumn, suffix);

    return this.getForeignCollection(prefix)?.resolveBinaryColumn(suffix);
  }

  private resolveNestedBinaryColumn(
    { columnType, useHex }: BinaryColumn,
    path: string,
  ): BinaryColumn | undefined {
    let nestedType: ColumnType = columnType;

    for (const key of path.split(':')) {
      if (typeof nestedType !== 'object' || Array.isArray(nestedType)) return undefined;

      const type = nestedType[key];
      if (!type || TypeGetter.isEnumField(type)) return undefined;

      nestedType = type as ColumnType;
    }

    if (!this.containsBinary(nestedType)) return undefined;

    return { columnType: nestedType, useHex };
  }

  private convertRecord(toBackend: boolean, record: RecordData): RecordData {
    if (!record) return record;

    return Object.fromEntries(
      Object.entries(record).map(([name, value]) => [
        name,
        this.convertField(toBackend, name, value),
      ]),
    );
  }

  private convertField(toBackend: boolean, name: string, value: unknown): unknown {
    const binaryColumn = this.binaryColumns.get(name);

    if (binaryColumn) {
      return this.convertValueHelper(
        toBackend,
        binaryColumn.columnType,
        binaryColumn.useHex,
        value,
      );
    }

    const collection = this.getForeignCollection(name);

    return collection ? collection.convertRecord(toBackend, value as RecordData) : value;
  }

  private needsValueConversion(leaf: ConditionTreeLeaf): boolean {
    return (
      BinaryCollectionDecorator.operatorsWithValueReplacement.includes(leaf.operator) &&
      Boolean(this.resolveBinaryColumn(leaf.field))
    );
  }

  private convertConditionTreeLeaf(leaf: ConditionTreeLeaf): ConditionTree {
    if (!this.needsValueConversion(leaf)) return leaf;

    const { columnType, useHex } = this.resolveBinaryColumn(leaf.field);
    const valueType: ColumnType =
      leaf.operator === 'In' || leaf.operator === 'NotIn' ? [columnType] : columnType;

    return leaf.override({
      value: this.convertValueHelper(true, valueType, useHex, leaf.value),
    });
  }

  private convertValueHelper(
    toBackend: boolean,
    columnType: ColumnType,
    useHex: boolean,
    value: unknown,
  ): unknown {
    if (value) {
      if (columnType === 'Binary') {
        return this.convertScalar(toBackend, useHex, value);
      }

      if (Array.isArray(columnType)) {
        return (value as unknown[]).map(v =>
          this.convertValueHelper(toBackend, columnType[0], useHex, v),
        );
      }

      if (typeof columnType !== 'string') {
        const entries = Object.entries(columnType).map(([key, type]) => [
          key,
          TypeGetter.isEnumField(type)
            ? value[key]
            : this.convertValueHelper(toBackend, type, useHex, value[key]),
        ]);

        return Object.fromEntries(entries);
      }
    }

    return value;
  }

  private parseHex(value: string): Buffer {
    if (!HEX_BYTES.test(value)) {
      throw new ValidationError(
        `Expected a hex string of full bytes for a binary field, got "${value.slice(0, 32)}"`,
      );
    }

    return Buffer.from(value, 'hex');
  }

  private convertScalar(toBackend: boolean, useHex: boolean, value: unknown): unknown {
    if (toBackend) {
      if (Buffer.isBuffer(value)) return value;

      if (typeof value !== 'string') {
        throw new ValidationError(
          `Expected a string for a binary field, got ${typeof value}: ${JSON.stringify(
            value,
          )?.slice(0, 32)}`,
        );
      }

      if (useHex) return this.parseHex(value);

      return parseDataUri(value).buffer;
    }

    const buffer = value as Buffer;
    if (useHex) return buffer.toString('hex');

    const mime = filetypemime([...buffer])?.[0] ?? 'application/octet-stream';
    const data = buffer.toString('base64');

    return `data:${mime};base64,${data}`;
  }

  private replaceColumnType(columnType: ColumnType): ColumnType {
    if (typeof columnType === 'string') {
      return columnType === 'Binary' ? 'String' : columnType;
    }

    if (Array.isArray(columnType)) {
      const itemType = this.replaceColumnType(columnType[0]);

      return itemType === columnType[0] ? columnType : [itemType];
    }

    const entries = Object.entries(columnType).map(([key, type]) => [
      key,
      TypeGetter.isEnumField(type) ? type : this.replaceColumnType(type),
    ]);

    return entries.some(([key, type]) => type !== columnType[key as string])
      ? Object.fromEntries(entries)
      : columnType;
  }

  private replaceValidation(name: string, schema: ColumnSchema): ColumnSchema['validation'] {
    if (schema.columnType === 'Binary') {
      const validation: ColumnSchema['validation'] = [];

      const minLength = schema.validation?.find(v => v.operator === 'LongerThan')?.value as number;
      const maxLength = schema.validation?.find(v => v.operator === 'ShorterThan')?.value as number;

      if (this.shouldUseHex(name)) {
        validation.push({ operator: 'Match', value: HEX_BYTES });
        if (minLength) validation.push({ operator: 'LongerThan', value: minLength * 2 + 1 });
        if (maxLength) validation.push({ operator: 'ShorterThan', value: maxLength * 2 - 1 });
      } else {
        validation.push({ operator: 'Match', value: /^data:.*;base64,.*/ });
      }

      if (schema.validation?.find(v => v.operator === 'Present')) {
        validation.push({ operator: 'Present' });
      }

      return validation;
    }

    return schema.validation;
  }
}
