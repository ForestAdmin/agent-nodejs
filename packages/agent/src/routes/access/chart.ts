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
import { DateTime } from 'luxon';
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

  private async handleStat(context: Context) {
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
    const withCountPrevious = context.request.body.filters;

    if (withCountPrevious) {
      result.countPrevious = await this.computeValue(
        context,
        this.getPreviousPeriodFilter(context),
      );
    }

    return result;
  }

  private async makeObjectiveChart(context: Context): Promise<{ value: unknown }> {
    return { value: await this.computeValue(context, await this.getFilter(context)) };
  }

  private async makePieChart(context: Context): Promise<Array<{ key: string; value: unknown }>> {
    const {
      group_by_field: groupByField,
      aggregate,
      aggregate_field: aggregateField,
    } = context.request.body;
    const rows = await this.collection.aggregate(
      await this.getFilter(context),
      new Aggregation({
        operation: aggregate,
        field: aggregateField,
        groups: [{ field: groupByField }],
      }),
    );

    return rows.map(row => ({ key: row.group[groupByField] as string, value: row.value }));
  }

  private async makeLineChart(context: Context): Promise<Array<{ label: string; value: unknown }>> {
    const {
      aggregate,
      aggregate_field: aggregateField,
      group_by_date_field: groupByDateField,
      time_range: timeRange,
    } = context.request.body;

    const rows = await this.collection.aggregate(
      await this.getFilter(context),
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

  // async makeLeaderboardChart(ctx: Context): Promise<any> {
  //   const aggregateField =
  //      `${ctx.request.body.relationship_field}:${ctx.request.body.aggregate_field}`;
  //   const rows = await this.collection.aggregate(
  //     await this.getSelection(ctx),
  //     {
  //       aggregate: { operation: ctx.request.body.aggregate, field: aggregateField },
  //       buckets: [{ field: 'title' }],
  //     },
  //     ctx.request.body.limit,
  //   );

  //   return rows;
  // }

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

  private getPreviousPeriodFilter(context: Context): Filter {
    const filter = this.getFilter(context);
    filter.conditionTree = filter.conditionTree.replaceLeafs(leaf => {
      switch (leaf.operator) {
        case Operator.Today:
          return leaf.override({ operator: Operator.Yesterday });
        case Operator.Yesterday:
          return leaf;
        case Operator.PreviousWeek:
          return leaf;
        case Operator.PreviousMonth:
          return leaf;
        case Operator.PreviousQuarter:
          return leaf;
        case Operator.PreviousYear:
          return leaf;
        case Operator.PreviousXDays:
          return leaf;
        case Operator.PreviousXDaysToDate:
          return leaf;
        case Operator.PreviousMonthToDate:
          return leaf.override({ operator: Operator.PreviousMonth });
        case Operator.PreviousQuarterToDate:
          return leaf.override({ operator: Operator.PreviousQuarter });
        case Operator.PreviousYearToDate:
          return leaf.override({ operator: Operator.PreviousYear });
        default:
          return leaf;
      }

      return leaf;
    });

    return filter;
  }
}
