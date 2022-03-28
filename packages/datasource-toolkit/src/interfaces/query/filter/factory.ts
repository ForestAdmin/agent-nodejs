import { DateTime, DateTimeUnit } from 'luxon';

import { Collection } from '../../collection';
import { CompositeId } from '../../record';
import { FieldTypes, ManyToManySchema } from '../../schema';
import CollectionUtils from '../../../utils/collection';
import ConditionTree from '../condition-tree/nodes/base';
import ConditionTreeFactory from '../condition-tree/factory';
import ConditionTreeLeaf, { Operator } from '../condition-tree/nodes/leaf';
import Filter from './unpaginated';
import PaginatedFilter from './paginated';
import Projection from '../projection';
import SchemaUtils from '../../../utils/schema';

export default class FilterFactory {
  private static getPreviousConditionTree(
    field: string,
    startPeriod: DateTime,
    endPeriod: DateTime,
  ): ConditionTree {
    return ConditionTreeFactory.intersect(
      new ConditionTreeLeaf(field, Operator.GreaterThan, startPeriod.toISO()),
      new ConditionTreeLeaf(field, Operator.LessThan, endPeriod.toISO()),
    );
  }

  private static getPreviousPeriodByUnit(
    field: string,
    now: DateTime,
    interval: string,
  ): ConditionTree {
    const dayBeforeYesterday = now.minus({ [interval]: 2 });

    return this.getPreviousConditionTree(
      field,
      dayBeforeYesterday.startOf(interval as DateTimeUnit),
      dayBeforeYesterday.endOf(interval as DateTimeUnit),
    );
  }

  static getPreviousPeriodFilter(filter: Filter): Filter {
    const now = DateTime.now().setZone(filter.timezone);

    return filter.override({
      conditionTree: filter.conditionTree.replaceLeafs(leaf => {
        switch (leaf.operator) {
          case Operator.Today:
            return leaf.override({ operator: Operator.Yesterday });
          case Operator.Yesterday:
            return this.getPreviousPeriodByUnit(leaf.field, now, 'day');
          case Operator.PreviousWeek:
            return this.getPreviousPeriodByUnit(leaf.field, now, 'week');
          case Operator.PreviousMonth:
            return this.getPreviousPeriodByUnit(leaf.field, now, 'month');
          case Operator.PreviousQuarter:
            return this.getPreviousPeriodByUnit(leaf.field, now, 'quarter');
          case Operator.PreviousYear:
            return this.getPreviousPeriodByUnit(leaf.field, now, 'year');

          case Operator.PreviousXDays: {
            const startPeriodXDays = now.minus({ days: 2 * Number(leaf.value) });
            const endPeriodXDays = now.minus({ days: Number(leaf.value) });

            return this.getPreviousConditionTree(
              leaf.field,
              startPeriodXDays.startOf('day'),
              endPeriodXDays.startOf('day'),
            );
          }

          case Operator.PreviousXDaysToDate: {
            const startPeriod = now.minus({ days: 2 * Number(leaf.value) });
            const endPeriod = now.minus({ days: Number(leaf.value) });

            return this.getPreviousConditionTree(leaf.field, startPeriod.startOf('day'), endPeriod);
          }

          case Operator.PreviousMonthToDate:
            return leaf.override({ operator: Operator.PreviousMonth });
          case Operator.PreviousQuarterToDate:
            return leaf.override({ operator: Operator.PreviousQuarter });
          case Operator.PreviousYearToDate:
            return leaf.override({ operator: Operator.PreviousYear });
          default:
            return leaf;
        }
      }),
    });
  }

  /**
   * Make a filter targeting the through collection of a many to many relationship from the relation
   * and a filter to the target collection.
   */
  static async makeThroughFilter(
    collection: Collection,
    id: CompositeId,
    relationName: string,
    baseForeignFilter: PaginatedFilter,
  ): Promise<PaginatedFilter> {
    const relation = collection.schema.fields[relationName] as ManyToManySchema;
    const originValue = await CollectionUtils.getValue(collection, id, relation.originKeyTarget);

    // Optimization for many to many when there is not search/segment (saves one query)
    if (relation.foreignRelation && baseForeignFilter.isNestable) {
      const baseThroughFilter = baseForeignFilter.nest(relation.foreignRelation);

      return baseThroughFilter.override({
        conditionTree: ConditionTreeFactory.intersect(
          new ConditionTreeLeaf(relation.originKey, Operator.Equal, originValue),
          baseThroughFilter.conditionTree,
        ),
      });
    }

    // Otherwise we have no choice but to call the target collection so that search and segment
    // are correctly apply, and then match ids in the though collection.
    const target = collection.dataSource.getCollection(relation.foreignCollection);
    const records = await target.list(
      await FilterFactory.makeForeignFilter(collection, id, relationName, baseForeignFilter),
      new Projection(relation.foreignKeyTarget),
    );

    return new Filter({
      conditionTree: ConditionTreeFactory.intersect(
        // only children of parent
        new ConditionTreeLeaf(relation.originKey, Operator.Equal, originValue),

        // only the children which match the conditions in baseForeignFilter
        new ConditionTreeLeaf(
          relation.foreignKey,
          Operator.In,
          records.map(r => r[relation.foreignKeyTarget]),
        ),
      ),
    });
  }

  /**
   * Given a collection and a OneToMany/ManyToMany relation, generate a filter which
   * - match only children of the provided recordId
   * - can apply on the target collection of the relation
   */
  static async makeForeignFilter(
    collection: Collection,
    id: CompositeId,
    relationName: string,
    baseForeignFilter: PaginatedFilter,
  ): Promise<Filter> {
    const relation = SchemaUtils.getToManyRelation(collection.schema, relationName);
    const originValue = await CollectionUtils.getValue(collection, id, relation.originKeyTarget);

    // Compute condition tree to match parent record.
    let originTree: ConditionTree;

    if (relation.type === FieldTypes.OneToMany) {
      // OneToMany case (can be done in one request all the time)
      originTree = new ConditionTreeLeaf(relation.originKey, Operator.Equal, originValue);
    } else {
      // ManyToMany case (more complicated...)
      const through = collection.dataSource.getCollection(relation.throughCollection);
      const throughTree = new ConditionTreeLeaf(relation.originKey, Operator.Equal, originValue);
      const records = await through.list(
        new Filter({ conditionTree: throughTree }),
        new Projection(relation.foreignKey),
      );

      originTree = new ConditionTreeLeaf(
        relation.foreignKeyTarget,
        Operator.In,
        records.map(r => r[relation.foreignKey]),
      );
    }

    // Merge with existing filter.
    return baseForeignFilter.override({
      conditionTree: ConditionTreeFactory.intersect(baseForeignFilter.conditionTree, originTree),
    });
  }
}
