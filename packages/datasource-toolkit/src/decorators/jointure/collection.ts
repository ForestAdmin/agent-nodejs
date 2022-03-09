import { AggregateResult } from '../../interfaces/query/aggregation';
import { Aggregation, FieldValidator } from '../..';
import {
  CollectionSchema,
  ColumnSchema,
  FieldTypes,
  RelationSchema,
} from '../../interfaces/schema';
import { RecordData } from '../../interfaces/record';
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

  addJointure(name: string, joint: RelationSchema): void {
    this.checkDependenciesExist(joint);
    this.checkForeignKeyType(joint);
    this.checkOtherKeyType(joint);
    this.checkOperators(joint);

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

  private checkDependenciesExist(joint: RelationSchema): void {
    // @fixme we should add an optional parameter in FieldValidator.validate() to ensure
    // that the field in in the collection, not in a relation.

    const target = this.dataSource.getCollection(joint.foreignCollection);

    if (joint.type === FieldTypes.ManyToOne) {
      FieldValidator.validate(this, joint.foreignKey);
    }

    if (joint.type === FieldTypes.OneToMany || joint.type === FieldTypes.OneToOne) {
      FieldValidator.validate(target, joint.foreignKey);
    }

    if (joint.type === FieldTypes.ManyToMany) {
      const through = this.dataSource.getCollection(joint.throughCollection);
      FieldValidator.validate(through, joint.foreignKey);
      FieldValidator.validate(through, joint.otherField);
    }
  }

  private checkForeignKeyType(joint: RelationSchema): void {
    const target = this.dataSource.getCollection(joint.foreignCollection);
    let foreignKey: ColumnSchema;
    let primaryKey: ColumnSchema;

    if (joint.type === FieldTypes.ManyToOne) {
      foreignKey = this.schema.fields[joint.foreignKey] as ColumnSchema;
      primaryKey = target.schema.fields[
        SchemaUtils.getPrimaryKeys(target.schema)[0]
      ] as ColumnSchema;
    }

    if (joint.type === FieldTypes.OneToMany || joint.type === FieldTypes.OneToOne) {
      foreignKey = target.schema.fields[joint.foreignKey] as ColumnSchema;
      primaryKey = this.schema.fields[SchemaUtils.getPrimaryKeys(this.schema)[0]] as ColumnSchema;
    }

    if (joint.type === FieldTypes.ManyToMany) {
      const through = this.dataSource.getCollection(joint.throughCollection);
      foreignKey = through.schema.fields[joint.foreignKey] as ColumnSchema;
      primaryKey = target.schema.fields[SchemaUtils.getPrimaryKeys(this.schema)[0]] as ColumnSchema;
    }

    if (foreignKey.columnType !== primaryKey.columnType) {
      throw new Error('Types from source foreignKey and target primary key do not match.');
    }
  }

  private checkOtherKeyType(joint: RelationSchema): void {
    if (joint.type !== FieldTypes.ManyToMany) return;

    const through = this.dataSource.getCollection(joint.throughCollection);
    const otherKey = through.schema.fields[joint.otherField] as ColumnSchema;
    const primaryKey = this.schema.fields[
      SchemaUtils.getPrimaryKeys(this.schema)[0]
    ] as ColumnSchema;

    if (otherKey.columnType !== primaryKey.columnType) {
      throw new Error('Types from source otherField and target primary key do not match.');
    }
  }

  private checkOperators(joint: RelationSchema): void {
    const target = this.dataSource.getCollection(joint.foreignCollection);
    const primaryKey = target.schema.fields[
      SchemaUtils.getPrimaryKeys(target.schema)[0]
    ] as ColumnSchema;
    const foreignKey = target.schema.fields[joint.foreignKey] as ColumnSchema;

    const isValid =
      joint.type === FieldTypes.ManyToMany ||
      joint.type === FieldTypes.OneToMany ||
      (joint.type === FieldTypes.OneToOne && foreignKey.filterOperators.has(Operator.In)) ||
      (joint.type === FieldTypes.ManyToOne && primaryKey.filterOperators.has(Operator.In));

    if (!isValid) {
      throw new Error(
        'Jointure emulation requires target collection primary and ' +
          'foreign key to support the In operator',
      );
    }
  }

  private rewriteField(field: string): string[] {
    const prefix = field.split(':').shift();
    const schema = this.schema.fields[prefix];
    if (schema.type === FieldTypes.Column) return [field];

    const relation = this.dataSource.getCollection(schema.foreignCollection);
    let result = [] as string[];

    if (!this.jointures[prefix]) {
      result = [`${prefix}:${relation.rewriteField(field.substring(prefix.length + 1))}`];
    } else if (schema.type === FieldTypes.ManyToOne) {
      result = [schema.foreignKey];
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
        records.map(record => RecordUtils.getPrimaryKey(relation.schema, record)[0]),
      );
    } else if (schema.type === FieldTypes.OneToOne) {
      const records = await relation.list(
        new Filter({ conditionTree: leaf.unnest() }),
        new Projection(schema.foreignKey),
      );

      result = new ConditionTreeLeaf(
        SchemaUtils.getPrimaryKeys(this.schema)[0],
        Operator.In,
        records.map(record => RecordUtils.getFieldValue(record, schema.foreignKey)),
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
    prefix: string,
    subProjection: Projection,
  ): Promise<void> {
    const { foreignCollection, foreignKey, type } = this.schema.fields[prefix] as RelationSchema;
    const association = this.dataSource.getCollection(foreignCollection);

    if (!this.jointures[prefix]) {
      await association.reprojectInPlace(
        records.map(r => r[prefix]).filter(Boolean) as RecordData[],
        subProjection,
      );
    } else if (type === FieldTypes.ManyToOne) {
      const [associationPk] = SchemaUtils.getPrimaryKeys(association.schema);
      const ids = records.map(record => record[foreignKey]).filter(fk => fk !== null);
      const subFilter = new Filter({
        conditionTree: new ConditionTreeLeaf(associationPk, Operator.In, [...new Set(ids)]),
      });
      const subRecords = await association.list(subFilter, subProjection.union([associationPk]));

      for (const record of records) {
        const subRecord = subRecords.filter(sr => sr[associationPk] === record[foreignKey]);
        record[prefix] = subRecord.length ? subRecord[0] : null;
      }
    } else if (type === FieldTypes.OneToOne) {
      const [myPk] = SchemaUtils.getPrimaryKeys(this.schema);
      const ids = records.map(record => record[myPk]);
      const subFilter = new Filter({
        conditionTree: new ConditionTreeLeaf(foreignKey, Operator.In, [...new Set(ids)]),
      });
      const subRecords = await association.list(subFilter, subProjection.union([foreignKey]));

      for (const record of records) {
        const subRecord = subRecords.filter(sr => sr[foreignKey] === record[myPk]);
        record[prefix] = subRecord.length ? subRecord[0] : null;
      }
    }
  }
}
