import { Collection } from '../../interfaces/collection';
import {
  CollectionSchema,
  ColumnSchema,
  FieldTypes,
  RelationSchema,
} from '../../interfaces/schema';
import { PartialRelationSchema } from './types';
import { RecordData } from '../../interfaces/record';
import Aggregation, { AggregateResult } from '../../interfaces/query/aggregation';
import CollectionDecorator from '../collection-decorator';
import ConditionTree from '../../interfaces/query/condition-tree/nodes/base';
import ConditionTreeLeaf, { Operator } from '../../interfaces/query/condition-tree/nodes/leaf';
import DataSourceDecorator from '../datasource-decorator';
import Filter from '../../interfaces/query/filter/unpaginated';
import PaginatedFilter from '../../interfaces/query/filter/paginated';
import Projection from '../../interfaces/query/projection';
import RecordUtils from '../../utils/record';
import SchemaUtils from '../../utils/schema';

export default class JointureCollectionDecorator extends CollectionDecorator {
  override readonly dataSource: DataSourceDecorator<JointureCollectionDecorator>;
  protected jointures: Record<string, RelationSchema> = {};

  addJointure(name: string, partialJoint: PartialRelationSchema): void {
    const joint = this.jointWithOptionalFields(partialJoint);
    this.checkForeignKeys(joint);
    this.checkOriginKeys(joint);

    this.jointures[name] = joint;
  }

  override async list(filter: PaginatedFilter, projection: Projection): Promise<RecordData[]> {
    const newFilter = await this.refineFilter(filter);
    const newProjection = projection.replace(this.rewriteField, this).withPks(this);
    const records = await this.childCollection.list(newFilter, newProjection);

    await this.reprojectInPlace(records, projection);

    return projection.apply(records);
  }

  override async aggregate(
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    const newFilter = await this.refineFilter(filter);

    // No emulated jointures are used in the aggregation
    if (Object.keys(aggregation.projection.relations).every(prefix => !this.jointures[prefix])) {
      return this.childCollection.aggregate(newFilter, aggregation, limit);
    }

    // Fallback to full emulation.
    const rows = aggregation.apply(
      await this.list(filter, aggregation.projection),
      filter.timezone,
    );
    if (limit && rows.length > limit) rows.length = limit;

    return rows;
  }

  protected refineSchema(subSchema: CollectionSchema): CollectionSchema {
    const schema = { ...subSchema, fields: { ...subSchema.fields } };

    for (const [name, jointure] of Object.entries(this.jointures)) {
      schema.fields[name] = jointure;
    }

    return schema;
  }

  protected override async refineFilter(filter: PaginatedFilter): Promise<PaginatedFilter> {
    return filter?.override({
      conditionTree: await filter.conditionTree?.replaceLeafsAsync(this.rewriteLeaf, this),

      // Replace sort in emulated relations to
      // - sorting by the fk of the relation for many to one
      // - removing the sort altogether for one to one
      //
      // This is far from ideal, but the best that can be done without taking a major
      // performance hit.
      // Customers which want proper sorting should enable emulation in the associated
      // middleware
      sort: filter.sort?.replaceClauses(clause =>
        this.rewriteField(clause.field).map(field => ({ ...clause, field })),
      ),
    });
  }

  private jointWithOptionalFields(partialJoint: PartialRelationSchema): RelationSchema {
    const joint = { ...partialJoint };
    const target = this.dataSource.getCollection(joint.foreignCollection);

    if (joint.type === FieldTypes.ManyToOne) {
      joint.foreignKeyTarget ??= SchemaUtils.getPrimaryKeys(target.schema)[0];
    } else if (joint.type === FieldTypes.OneToOne || joint.type === FieldTypes.OneToMany) {
      joint.originKeyTarget ??= SchemaUtils.getPrimaryKeys(this.schema)[0];
    } else if (joint.type === FieldTypes.ManyToMany) {
      joint.originKeyTarget ??= SchemaUtils.getPrimaryKeys(this.schema)[0];
      joint.foreignKeyTarget ??= SchemaUtils.getPrimaryKeys(target.schema)[0];
    }

    return joint as RelationSchema;
  }

  private checkForeignKeys(joint: RelationSchema): void {
    if (joint.type === FieldTypes.ManyToOne || joint.type === FieldTypes.ManyToMany) {
      JointureCollectionDecorator.checkKeys(
        joint.type === FieldTypes.ManyToMany
          ? this.dataSource.getCollection(joint.throughCollection)
          : this,
        this.dataSource.getCollection(joint.foreignCollection),
        joint.foreignKey,
        joint.foreignKeyTarget,
      );
    }
  }

  private checkOriginKeys(joint: RelationSchema): void {
    if (
      joint.type === FieldTypes.OneToMany ||
      joint.type === FieldTypes.OneToOne ||
      joint.type === FieldTypes.ManyToMany
    ) {
      JointureCollectionDecorator.checkKeys(
        joint.type === FieldTypes.ManyToMany
          ? this.dataSource.getCollection(joint.throughCollection)
          : this.dataSource.getCollection(joint.foreignCollection),
        this,
        joint.originKey,
        joint.originKeyTarget,
      );
    }
  }

  private static checkKeys(
    owner: Collection,
    targetOwner: Collection,
    keyName: string,
    targetName: string,
  ): void {
    JointureCollectionDecorator.checkColumn(owner, keyName);
    JointureCollectionDecorator.checkColumn(targetOwner, targetName);

    const key = owner.schema.fields[keyName] as ColumnSchema;
    const target = targetOwner.schema.fields[targetName] as ColumnSchema;

    if (key.columnType !== target.columnType) {
      throw new Error(
        `Types from '${owner.name}.${keyName}' and ` +
          `'${targetOwner.name}.${targetName}' do not match.`,
      );
    }
  }

  private static checkColumn(owner: Collection, name: string): void {
    const column = owner.schema.fields[name];

    if (!column || column.type !== FieldTypes.Column) {
      throw new Error(`Column not found: '${owner.name}.${name}'`);
    }

    if (!column.filterOperators.has(Operator.In)) {
      throw new Error(`Column does not support the In operator: '${owner.name}.${name}'`);
    }
  }

  private rewriteField(field: string): string[] {
    const prefix = field.split(':').shift();
    const schema = this.schema.fields[prefix];
    if (schema.type === FieldTypes.Column) return [field];

    const relation = this.dataSource.getCollection(schema.foreignCollection);
    let result = [] as string[];

    if (!this.jointures[prefix]) {
      result = relation
        .rewriteField(field.substring(prefix.length + 1))
        .map(subField => `${prefix}:${subField}`);
    } else if (schema.type === FieldTypes.ManyToOne) {
      result = [schema.foreignKey];
    } else if (
      schema.type === FieldTypes.OneToOne ||
      schema.type === FieldTypes.OneToMany ||
      schema.type === FieldTypes.ManyToMany
    ) {
      result = [schema.originKeyTarget];
    }

    return result;
  }

  private async rewriteLeaf(leaf: ConditionTreeLeaf): Promise<ConditionTree> {
    const prefix = leaf.field.split(':').shift();
    const schema = this.schema.fields[prefix];
    if (schema.type === FieldTypes.Column) return leaf;

    const relation = this.dataSource.getCollection(schema.foreignCollection);
    let result = leaf as ConditionTree;

    if (!this.jointures[prefix]) {
      result = (await relation.rewriteLeaf(leaf.unnest())).nest(prefix);
    } else if (schema.type === FieldTypes.ManyToOne) {
      const records = await relation.list(
        new Filter({ conditionTree: leaf.unnest() }),
        new Projection().withPks(this),
      );

      result = new ConditionTreeLeaf(
        schema.foreignKey,
        Operator.In,
        records.map(record => RecordUtils.getFieldValue(record, schema.foreignKeyTarget)),
      );
    } else if (schema.type === FieldTypes.OneToOne) {
      const records = await relation.list(
        new Filter({ conditionTree: leaf.unnest() }),
        new Projection(schema.originKey),
      );

      result = new ConditionTreeLeaf(
        schema.originKeyTarget,
        Operator.In,
        records.map(record => RecordUtils.getFieldValue(record, schema.originKey)),
      );
    }

    return result;
  }

  private async reprojectInPlace(records: RecordData[], projection: Projection): Promise<void> {
    const promises = Object.entries(projection.relations).map(async ([prefix, subProjection]) =>
      this.reprojectRelationInPlace(records, prefix, subProjection),
    );

    await Promise.all(promises);
  }

  private async reprojectRelationInPlace(
    records: RecordData[],
    name: string,
    projection: Projection,
  ): Promise<void> {
    const schema = this.schema.fields[name] as RelationSchema;
    const association = this.dataSource.getCollection(schema.foreignCollection);

    if (!this.jointures[name]) {
      await association.reprojectInPlace(
        records.map(r => r[name]).filter(Boolean) as RecordData[],
        projection,
      );
    } else if (schema.type === FieldTypes.ManyToOne) {
      const ids = records.map(record => record[schema.foreignKey]).filter(fk => fk !== null);
      const subFilter = new Filter({
        conditionTree: new ConditionTreeLeaf(schema.foreignKeyTarget, Operator.In, [
          ...new Set(ids),
        ]),
      });
      const subRecords = await association.list(
        subFilter,
        projection.union([schema.foreignKeyTarget]),
      );

      for (const record of records) {
        const subRecord = subRecords.filter(
          sr => sr[schema.foreignKeyTarget] === record[schema.foreignKey],
        );
        record[name] = subRecord.length ? subRecord[0] : null;
      }
    } else if (schema.type === FieldTypes.OneToOne) {
      const ids = records.map(record => record[schema.originKeyTarget]);
      const subFilter = new Filter({
        conditionTree: new ConditionTreeLeaf(schema.originKey, Operator.In, [...new Set(ids)]),
      });
      const subRecords = await association.list(subFilter, projection.union([schema.originKey]));

      for (const record of records) {
        const subRecord = subRecords.filter(
          sr => sr[schema.originKey] === record[schema.originKeyTarget],
        );
        record[name] = subRecord.length ? subRecord[0] : null;
      }
    }
  }
}
