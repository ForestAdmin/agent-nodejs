import {
  Aggregation,
  Aggregator,
  ConditionTree,
  ConditionTreeBranch,
  ConditionTreeFactory,
  ConditionTreeLeaf,
  DateOperation,
  Filter,
  Operator,
} from '@forestadmin/datasource-toolkit';
import Router from '@koa/router';
import { Context } from 'koa';
import { DateTime, DateTimeUnit } from 'luxon';
import { v1 as uuidv1 } from 'uuid';
import QueryStringParser from '../../utils/query-string';
import CollectionBaseRoute from '../collection-base-route';

enum ChartType {
  Value = 'Value',
  Objective = 'Objective',
  Pie = 'Pie',
  Line = 'Line',
  Leaderboard = 'Leaderboard',
}

export default class Chart extends CollectionBaseRoute {
  private static readonly formats = {
    [DateOperation.ToDay]: 'dd/MM/yyyy',
    [DateOperation.ToWeek]: "'W'W-yyyy",
    [DateOperation.ToMonth]: 'MMM yy',
    [DateOperation.ToYear]: 'yyyy',
  };

  override setupPrivateRoutes(router: Router): void {
    router.post(`/stats/${this.collection.name}`, this.handleStat.bind(this));
  }

  async handleStat(context: Context) {
    const { body } = context.request;

    if (!Object.values(ChartType).includes(body.type)) {
      context.response.status = 400;

      return;
    }

    try {
      context.response.body = {
        data: {
          id: uuidv1(),
          type: 'stats',
          attributes: { value: await this[`make${body.type}Chart`](context) },
        },
      };
    } catch (e) {
      console.log(e);
    }
  }

  private async makeValueChart(
    context: Context,
  ): Promise<{ countCurrent: unknown; countPrevious: unknown }> {
    const currentFilter = this.getFilter(context);
    const result = {
      countCurrent: await this.computeValue(context, currentFilter),
      countPrevious: undefined,
    };

    const withCountPrevious = currentFilter.conditionTree.someLeaf(leaf =>
      leaf.useIntervalOperator(),
    );

    if (withCountPrevious) {
      result.countPrevious = await this.computeValue(
        context,
        this.getPreviousPeriodFilter(context),
      );
    }

    return result;
  }

  private async makeObjectiveChart(context: Context): Promise<{ value: unknown }> {
    return { value: await this.computeValue(context, this.getFilter(context)) };
  }

  private async makePieChart(context: Context): Promise<Array<{ key: string; value: number }>> {
    const {
      group_by_field: groupByField,
      aggregate,
      aggregate_field: aggregateField,
    } = context.request.body;
    const rows = await this.collection.aggregate(
      this.getFilter(context),
      new Aggregation({
        operation: aggregate,
        field: aggregateField,
        groups: [{ field: groupByField }],
      }),
    );

    return rows.map(row => ({
      key: row.group[groupByField] as string,
      value: row.value as number,
    }));
  }

  private async makeLineChart(context: Context): Promise<Array<{ label: string; value: number }>> {
    const {
      aggregate,
      aggregate_field: aggregateField,
      group_by_date_field: groupByDateField,
      time_range: timeRange,
    } = context.request.body;

    const rows = await this.collection.aggregate(
      this.getFilter(context),
      new Aggregation({
        operation: aggregate,
        field: aggregateField,
        groups: [
          {
            field: groupByDateField,
            operation: timeRange,
          },
        ],
      }),
    );

    const values = {};
    rows.forEach(row => {
      values[DateTime.fromISO(row.group[groupByDateField] as string).toISODate()] = Number(
        row.value,
      );
    });

    const dates = Object.keys(values).sort((dateA, dateB) => dateA.localeCompare(dateB));
    const last = DateTime.fromISO(dates[dates.length - 1]);

    const dataPoints = [];
    const format = Chart.formats[timeRange];

    for (
      let current = DateTime.fromISO(dates[0]);
      current <= last;
      current = current.plus({ [timeRange]: 1 })
    ) {
      const label = current.toFormat(format);
      const value = values[current.toISODate()] ?? 0;
      dataPoints.push({ label, values: { value } });
    }

    return dataPoints;
  }

  async makeLeaderboardChart(context: Context): Promise<Array<{ key: string; value: number }>> {
    const {
      aggregate,
      label_field: labelField,
      limit,
      relationship_field: relationshipField,
    } = context.request.body;

    const aggregationField = `${relationshipField}`;
    const rows = await this.collection.aggregate(
      this.getFilter(context),
      new Aggregation({
        operation: aggregate,
        field: aggregationField,
        groups: [
          {
            field: labelField,
          },
        ],
      }),
    );

    // Limit ?
    return rows.map(row => ({ key: row.group[labelField] as string, value: row.value as number }));
  }

  private async computeValue(context: Context, selection: Filter): Promise<number> {
    const { aggregate, aggregate_field: aggregateField } = context.request.body;
    const aggregation = new Aggregation({ operation: aggregate, field: aggregateField });

    const rows = await this.collection.aggregate(selection, aggregation);

    return rows.length ? (rows[0].value as number) : 0;
  }

  private getFilter(context: Context): Filter {
    return new Filter({
      conditionTree: QueryStringParser.parseConditionTree(this.collection, context),
      segment: null,
      timezone: QueryStringParser.parseTimezone(context),
    });
  }

  private getPreviousConditionTree(
    startPeriod: DateTime,
    endPeriod: DateTime,
    field: string,
  ): ConditionTree {
    return ConditionTreeFactory.intersect(
      new ConditionTreeLeaf(field, Operator.GreaterThan, startPeriod.toISO()),
      new ConditionTreeLeaf(field, Operator.LessThan, endPeriod.toISO()),
    );
  }

  private getPreviousPeriodByUnit(now: DateTime, field: string, interval: string): ConditionTree {
    const dayBeforeYesterday = now.minus({ [interval]: 2 });
    return this.getPreviousConditionTree(
      dayBeforeYesterday.startOf(interval as DateTimeUnit),
      dayBeforeYesterday.endOf(interval as DateTimeUnit),
      field,
    );
  }

  private getPreviousPeriodFilter(context: Context): Filter {
    const filter = this.getFilter(context);
    const now = DateTime.now().setZone(QueryStringParser.parseTimezone(context));
    filter.conditionTree = filter.conditionTree.replaceLeafs(leaf => {
      switch (leaf.operator) {
        case Operator.Today:
          return leaf.override({ operator: Operator.Yesterday });
        case Operator.Yesterday:
          return this.getPreviousPeriodByUnit(now, leaf.field, 'day');
        case Operator.PreviousWeek:
          return this.getPreviousPeriodByUnit(now, leaf.field, 'week');
        case Operator.PreviousMonth:
          return this.getPreviousPeriodByUnit(now, leaf.field, 'month');
        case Operator.PreviousQuarter:
          return this.getPreviousPeriodByUnit(now, leaf.field, 'quarter');
        case Operator.PreviousYear:
          return this.getPreviousPeriodByUnit(now, leaf.field, 'year');
        case Operator.PreviousXDays:
          const startPeriodXDays = now.minus({ days: 2 * Number(leaf.value) });
          const endPeriodXDays = now.minus({ days: Number(leaf.value) });
          return this.getPreviousConditionTree(
            startPeriodXDays.startOf('day'),
            endPeriodXDays.startOf('day'),
            leaf.field,
          );
        case Operator.PreviousXDaysToDate:
          const startPeriod = now.minus({ days: 2 * Number(leaf.value) });
          const endPeriod = now.minus({ days: Number(leaf.value) });
          return this.getPreviousConditionTree(startPeriod.startOf('day'), endPeriod, leaf.field);
        case Operator.PreviousMonthToDate:
          return leaf.override({ operator: Operator.PreviousMonth });
        case Operator.PreviousQuarterToDate:
          return leaf.override({ operator: Operator.PreviousQuarter });
        case Operator.PreviousYearToDate:
          return leaf.override({ operator: Operator.PreviousYear });
        default:
          return leaf;
      }
    });
    return filter;
  }
}
