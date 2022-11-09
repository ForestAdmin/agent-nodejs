import { DateTime, DateTimeUnit } from 'luxon';

import Collection from '../../../collection';
import { Caller } from '../../caller';
import { CompositeId } from '../../record';
import { ManyToManySchema } from '../../schema';
import ConditionTreeFactory from '../condition-tree/factory';
import ConditionTree from '../condition-tree/nodes/base';
import ConditionTreeLeaf from '../condition-tree/nodes/leaf';
import Projection from '../projection';
import PaginatedFilter from './paginated';
import Filter from './unpaginated';

export default class FilterFactory {
  private static getPreviousConditionTree(
    field: string,
    startPeriod: DateTime,
    endPeriod: DateTime,
  ): ConditionTree {
    return ConditionTreeFactory.intersect(
      new ConditionTreeLeaf(field, 'GreaterThan', startPeriod.toISO()),
      new ConditionTreeLeaf(field, 'LessThan', endPeriod.toISO()),
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

  static getPreviousPeriodFilter(filter: Filter, timezone: string): Filter {
    const now = DateTime.now().setZone(timezone);

    return filter.override({
      conditionTree: filter.conditionTree.replaceLeafs(leaf => {
        switch (leaf.operator) {
          case 'Today':
            return leaf.override({ operator: 'Yesterday' });
          case 'Yesterday':
            return this.getPreviousPeriodByUnit(leaf.field, now, 'day');
          case 'PreviousWeek':
            return this.getPreviousPeriodByUnit(leaf.field, now, 'week');
          case 'PreviousMonth':
            return this.getPreviousPeriodByUnit(leaf.field, now, 'month');
          case 'PreviousQuarter':
            return this.getPreviousPeriodByUnit(leaf.field, now, 'quarter');
          case 'PreviousYear':
            return this.getPreviousPeriodByUnit(leaf.field, now, 'year');

          case 'PreviousXDays': {
            const startPeriodXDays = now.minus({ days: 2 * Number(leaf.value) });
            const endPeriodXDays = now.minus({ days: Number(leaf.value) });

            return this.getPreviousConditionTree(
              leaf.field,
              startPeriodXDays.startOf('day'),
              endPeriodXDays.startOf('day'),
            );
          }

          case 'PreviousXDaysToDate': {
            const startPeriod = now.minus({ days: 2 * Number(leaf.value) });
            const endPeriod = now.minus({ days: Number(leaf.value) });

            return this.getPreviousConditionTree(leaf.field, startPeriod.startOf('day'), endPeriod);
          }

          case 'PreviousWeekToDate':
            return leaf.override({ operator: 'PreviousWeek' });
          case 'PreviousMonthToDate':
            return leaf.override({ operator: 'PreviousMonth' });
          case 'PreviousQuarterToDate':
            return leaf.override({ operator: 'PreviousQuarter' });
          case 'PreviousYearToDate':
            return leaf.override({ operator: 'PreviousYear' });
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
    caller: Caller,
    baseForeignFilter: PaginatedFilter,
  ): Promise<PaginatedFilter> {
    const relation = collection.schema.fields[relationName] as ManyToManySchema;
    const originValue = await collection.getValue(caller, id, relation.originKeyTarget);
    const foreignRelation = collection.getThroughTarget(relationName);

    // Optimization for many to many when there is not search/segment (saves one query)
    if (foreignRelation && baseForeignFilter.isNestable) {
      const baseThroughFilter = baseForeignFilter.nest(foreignRelation);

      return baseThroughFilter.override({
        conditionTree: ConditionTreeFactory.intersect(
          new ConditionTreeLeaf(relation.originKey, 'Equal', originValue),
          new ConditionTreeLeaf(relation.foreignKey, 'Present'),
          baseThroughFilter.conditionTree,
        ),
      });
    }

    // Otherwise we have no choice but to call the target collection so that search and segment
    // are correctly apply, and then match ids in the though collection.
    const target = collection.dataSource.getCollection(relation.foreignCollection);
    const records = await target.list(
      caller,
      await FilterFactory.makeForeignFilter(
        collection,
        id,
        relationName,
        caller,
        baseForeignFilter,
      ),
      new Projection(relation.foreignKeyTarget),
    );

    return new Filter({
      conditionTree: ConditionTreeFactory.intersect(
        // only children of parent
        new ConditionTreeLeaf(relation.originKey, 'Equal', originValue),

        // only the children which match the conditions in baseForeignFilter
        new ConditionTreeLeaf(
          relation.foreignKey,
          'In',
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
    caller: Caller,
    baseForeignFilter: PaginatedFilter,
  ): Promise<Filter> {
    const relation = collection.schema.getToManyRelation(relationName);
    const originValue = await collection.getValue(caller, id, relation.originKeyTarget);

    // Compute condition tree to match parent record.
    let originTree: ConditionTree;

    if (relation.type === 'OneToMany') {
      // OneToMany case (can be done in one request all the time)
      originTree = new ConditionTreeLeaf(relation.originKey, 'Equal', originValue);
    } else {
      // ManyToMany case (more complicated...)
      const through = collection.dataSource.getCollection(relation.throughCollection);
      const throughTree = ConditionTreeFactory.intersect(
        new ConditionTreeLeaf(relation.originKey, 'Equal', originValue),
        new ConditionTreeLeaf(relation.foreignKey, 'Present'),
      );
      const records = await through.list(
        caller,
        new Filter({ conditionTree: throughTree }),
        new Projection(relation.foreignKey),
      );

      originTree = new ConditionTreeLeaf(
        relation.foreignKeyTarget,
        'In',
        records.map(r => r[relation.foreignKey]),
      );
    }

    // Merge with existing filter.
    return baseForeignFilter.override({
      conditionTree: ConditionTreeFactory.intersect(baseForeignFilter.conditionTree, originTree),
    });
  }
}
