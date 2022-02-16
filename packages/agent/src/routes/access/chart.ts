import { Aggregation, DateOperation, Filter, FilterUtils } from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import { DateTime } from 'luxon';
import { v1 as uuidv1 } from 'uuid';
import Router from '@koa/router';

import { HttpCode } from '../../types';
import CollectionRoute from '../collection-route';
import QueryStringParser from '../../utils/query-string';

enum ChartType {
  Value = 'Value',
  Objective = 'Objective',
  Pie = 'Pie',
  Line = 'Line',
}

export default class Chart extends CollectionRoute {
  private static readonly formats = {
    [DateOperation.ToDay]: 'dd/MM/yyyy',
    [DateOperation.ToWeek]: "'W'W-yyyy",
    [DateOperation.ToMonth]: 'MMM yy',
    [DateOperation.ToYear]: 'yyyy',
  };

  override setupPrivateRoutes(router: Router): void {
    router.post(`/stats/${this.collection.name}`, this.handleChart.bind(this));
  }

  async handleChart(context: Context) {
    const { body } = context.request;

    if (!Object.values(ChartType).includes(body.type)) {
      return context.throw(HttpCode.BadRequest, `Invalid Chart type "${body.type}"`);
    }

    // TODO parqametters validations aggregate / timeRange

    context.response.body = {
      data: {
        id: uuidv1(),
        type: 'stats',
        attributes: { value: await this[`make${body.type}Chart`](context) },
      },
    };
  }

  private async makeValueChart(
    context: Context,
  ): Promise<{ countCurrent: number; countPrevious?: number }> {
    const currentFilter = this.getFilter(context);
    const result = {
      countCurrent: await this.computeValue(context, currentFilter),
      countPrevious: undefined,
    };

    // @fixme if multiple interval operator, skip the count previous
    // when the Aggregation op is And (Or should still trigger this)
    const withCountPrevious = currentFilter.conditionTree?.someLeaf(leaf =>
      leaf.useIntervalOperator(),
    );

    if (withCountPrevious) {
      result.countPrevious = await this.computeValue(
        context,
        FilterUtils.getPreviousPeriodFilter(currentFilter),
      );
    }

    return result;
  }

  private async makeObjectiveChart(context: Context): Promise<{ value: number }> {
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

  private async computeValue(context: Context, filter: Filter): Promise<number> {
    const { aggregate, aggregate_field: aggregateField } = context.request.body;
    const aggregation = new Aggregation({ operation: aggregate, field: aggregateField });

    const rows = await this.collection.aggregate(filter, aggregation);

    return rows.length ? (rows[0].value as number) : 0;
  }

  private getFilter(context: Context): Filter {
    return new Filter({
      conditionTree: QueryStringParser.parseConditionTree(this.collection, context),
      timezone: QueryStringParser.parseTimezone(context),
    });
  }
}
