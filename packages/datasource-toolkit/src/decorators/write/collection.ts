import {
  CollectionSchema,
  ColumnSchema,
  FieldTypes,
  ManyToOneSchema,
  OneToOneSchema,
  RelationSchema,
} from '../../interfaces/schema';
import { RecordData } from '../../interfaces/record';
import { WriteDefinition } from './types';
import CollectionDecorator from '../collection-decorator';
import ConditionTreeLeaf from '../../interfaces/query/condition-tree/nodes/leaf';
import DataSourceDecorator from '../datasource-decorator';
import Filter from '../../interfaces/query/filter/unpaginated';
import Projection from '../../interfaces/query/projection';
import RecordValidator from '../../validation/record';
import SchemaUtils from '../../utils/schema';
import ValidationError from '../../errors';
import WriteCustomizationContext from './context';

export default class WriteDecorator extends CollectionDecorator {
  private replacedDefinitions: Record<string, WriteDefinition> = {};
  override readonly dataSource: DataSourceDecorator<WriteDecorator>;

  replaceFieldWriting(fieldName: string, definition: WriteDefinition): void {
    if (!Object.keys(this.schema.fields).includes(fieldName)) {
      throw new Error(
        `The given field "${fieldName}" does not exist on the ${this.name} collection.`,
      );
    }

    this.replacedDefinitions[fieldName] = definition;
    this.markSchemaAsDirty();
  }

  protected refineSchema(childSchema: CollectionSchema): CollectionSchema {
    const schema = { ...childSchema, fields: { ...childSchema.fields } };

    for (const name of Object.keys(this.replacedDefinitions)) {
      (schema.fields[name] as ColumnSchema).isReadOnly = false;
    }

    return schema;
  }

  override async create(data: RecordData[]): Promise<RecordData[]> {
    return Promise.all(data.map(record => this.applyDefinitionsAndCreate(record)));
  }

  override async update(filter: Filter, patch: RecordData): Promise<void> {
    await this.applyDefinitionsAndUpdate(filter, patch);
  }

  private async applyDefinitionsAndCreate(record: RecordData): Promise<RecordData> {
    const patch = await this.applyDefinitions(record, 'create');

    if (this.getRelationFields(patch, ['ManyToOne', 'OneToOne']).length === 0) {
      const result = await this.childCollection.create([patch]);

      return result[0];
    }

    const manyToOneRecords = await this.createManyToOneRelations(patch);

    const createdRecord = await this.createRecord(patch, manyToOneRecords);

    await this.createOneToOneRelations(patch, createdRecord);

    return createdRecord;
  }

  private async applyDefinitionsAndUpdate(filter: Filter, patch: RecordData): Promise<void> {
    const updatedPatch = await this.applyDefinitions(patch, 'update');
    const relations = this.getRelationFields(updatedPatch, ['OneToOne', 'ManyToOne']);

    const idsList = await this.getImpactedRecordByUpdate(relations, filter);

    await Promise.all([
      ...this.updateAllRelations(idsList, updatedPatch),
      this.childCollection.update(filter, this.getPatchWithoutRelations(updatedPatch, relations)),
    ]);
  }

  private async createRecord(
    patch: RecordData,
    manyToOneRecords: RecordData[][],
  ): Promise<RecordData> {
    const refinedPatch = { ...patch };
    const manyToOneRelations = this.getRelationFields(patch, ['ManyToOne']);

    for (const [record] of manyToOneRecords) {
      const relationName = manyToOneRelations.shift();
      const relationSchema = this.schema.fields[relationName] as ManyToOneSchema;

      delete refinedPatch[relationName];

      const relation = this.dataSource.getCollection(relationSchema.foreignCollection);
      const [pk] = SchemaUtils.getPrimaryKeys(relation.schema);
      refinedPatch[relationSchema.foreignKey] = record[pk];
    }

    for (const relationName of this.getRelationFields(patch, ['OneToOne'])) {
      const relationSchema = this.schema.fields[relationName] as OneToOneSchema;

      delete refinedPatch[relationName];

      if (patch[relationSchema.originKey]) delete refinedPatch[relationSchema.originKey];
    }

    const result = await this.childCollection.create([refinedPatch]);

    return result[0];
  }

  private async createOneToOneRelations(
    patch: RecordData,
    createdRecord: RecordData,
  ): Promise<void> {
    const requests: Promise<RecordData[] | void>[] = [];

    for (const oneToOneRelation of this.getRelationFields(patch, ['OneToOne'])) {
      const relationSchema = this.schema.fields[oneToOneRelation] as OneToOneSchema;
      const relationRecord = patch[oneToOneRelation] as RecordData;
      const relation = this.dataSource.getCollection(relationSchema.foreignCollection);
      const fk = relationSchema.originKey;

      if (patch[fk]) {
        const conditionTree = new ConditionTreeLeaf(fk, 'Equal', patch[fk]);
        const filter = new Filter({ conditionTree });
        const update = relation.update(filter, relationRecord);
        requests.push(update);
      } else {
        const [pk] = SchemaUtils.getPrimaryKeys(this.schema);
        requests.push(relation.create([{ ...relationRecord, [fk]: createdRecord[pk] }]));
      }
    }

    await Promise.all(requests);
  }

  private createManyToOneRelations(patch: RecordData): Promise<RecordData[][]> {
    const resultsManyToOne: Promise<RecordData[]>[] = [];

    for (const relationName of this.getRelationFields(patch, ['ManyToOne'])) {
      const relationSchema = this.schema.fields[relationName] as ManyToOneSchema;
      const relationRecord = patch[relationName] as RecordData;
      const fk = relationSchema.foreignKey;

      const relation = this.dataSource.getCollection(relationSchema.foreignCollection);

      if (patch[fk]) {
        const [pk] = SchemaUtils.getPrimaryKeys(relation.schema);

        const updateWrapper = async (): Promise<RecordData[]> => {
          const conditionTree = new ConditionTreeLeaf(pk, 'Equal', patch[fk]);
          await relation.update(new Filter({ conditionTree }), relationRecord);

          return [{ [pk]: patch[fk] }];
        };

        resultsManyToOne.push(updateWrapper());
      } else {
        resultsManyToOne.push(relation.create([relationRecord]));
      }
    }

    return Promise.all(resultsManyToOne);
  }

  private updateAllRelations(
    listIds: RecordData[][],
    patch: RecordData,
  ): Promise<void | RecordData[]>[] {
    const updates: Promise<void | RecordData[]>[] = [];
    const relations = this.getRelationFields(patch, ['OneToOne', 'ManyToOne']);

    for (const recordIds of listIds) {
      const relationName = relations.shift();
      const relationSchema = this.schema.fields[relationName] as RelationSchema;
      const relation = this.dataSource.getCollection(relationSchema.foreignCollection);

      const ids = recordIds.map(field => Object.values(field)[0]);
      let key: string | number;

      if (relationSchema.type === 'OneToOne') {
        key = relationSchema.originKey;
      } else {
        [key] = SchemaUtils.getPrimaryKeys(relation.schema);
      }

      const idsFilter = new Filter({ conditionTree: new ConditionTreeLeaf(key, 'In', ids) });
      updates.push(relation.update(idsFilter, patch[relationName] as RecordData));
    }

    return updates;
  }

  private async getImpactedRecordByUpdate(
    relations: string[],
    filter: Filter,
  ): Promise<RecordData[][]> {
    const records: Promise<RecordData[]>[] = [];

    for (const relationName of relations) {
      const relationSchema = this.schema.fields[relationName] as RelationSchema;
      let projection: Projection;

      if (relationSchema.type === 'OneToOne') {
        projection = new Projection(...SchemaUtils.getPrimaryKeys(this.schema));
      } else if (relationSchema.type === 'ManyToOne') {
        projection = new Projection(relationSchema.foreignKey);
      }

      records.push(this.list(filter, projection));
    }

    return Promise.all(records);
  }

  private async applyDefinitions(
    patch: RecordData,
    action: 'update' | 'create',
    stackCalls: string[] = [],
  ): Promise<RecordData> {
    if (Object.keys(patch).length === 0) return {};

    const replacedDefinitionsColumns = this.getReplacedDefinitionsColumns(patch);
    WriteDecorator.checkCyclicDependency(replacedDefinitionsColumns, stackCalls);
    const patches = await this.getDefinitionResults(patch, replacedDefinitionsColumns, action);

    const patchToExplore = {};
    const copyPatch = { ...patch };

    patches.forEach(recordData => {
      const setValueColumn = replacedDefinitionsColumns.shift();
      delete copyPatch[setValueColumn];

      if (!recordData) return;

      if (recordData.constructor === Object) {
        RecordValidator.validate(this, recordData);
      } else {
        throw new Error(
          `The write handler of ${setValueColumn} should return an object or nothing.`,
        );
      }

      for (const [columnName, value] of Object.entries(recordData)) {
        if (copyPatch[columnName]) {
          throw new ValidationError(
            `Conflict value on the field "${columnName}". It receives several values.`,
          );
        }

        if (columnName === setValueColumn) {
          copyPatch[columnName] = value;
        } else {
          patchToExplore[columnName] = value;
        }
      }
    });

    return { ...copyPatch, ...(await this.applyDefinitions(patchToExplore, action, stackCalls)) };
  }

  private getReplacedDefinitionsColumns(patch: RecordData): string[] {
    const patchKeys = Object.keys(patch);

    return Object.keys(this.replacedDefinitions).filter(name => patchKeys.includes(name));
  }

  private async getDefinitionResults(
    patch: RecordData,
    columns: string[],
    action: 'update' | 'create',
  ): Promise<(RecordData | void)[]> {
    return Promise.all(
      columns.map(column => {
        const definition = this.replacedDefinitions[column];
        const context = new WriteCustomizationContext(this, action, { ...patch });

        return definition(patch[column], context);
      }),
    );
  }

  private static checkCyclicDependency(columns: string[], stackCalls: string[]): void {
    stackCalls.push(...columns);

    if (stackCalls.length !== [...new Set(stackCalls)].length) {
      throw new ValidationError(
        `There is a cyclic dependency on the "${stackCalls.pop()}" column.`,
      );
    }
  }

  private getRelationFields(patch: RecordData, types: FieldTypes[]): string[] {
    return Object.keys(patch).filter(field => types.includes(this.schema.fields[field]?.type));
  }

  private getPatchWithoutRelations(patch: RecordData, relations: string[]): RecordData {
    const copy = { ...patch };
    relations.forEach(relation => delete copy[relation]);

    return copy;
  }
}
