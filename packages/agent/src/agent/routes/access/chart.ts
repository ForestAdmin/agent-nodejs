import {
  Aggregation,
  CollectionUtils,
  ConditionTreeBranch,
  DateOperation,
  Filter,
  FilterFactory,
  RelationSchema,
  ValidationError,
} from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import { DateTime } from 'luxon';
import { v1 as uuidv1 } from 'uuid';
import Router from '@koa/router';

import CollectionRoute from '../collection-route';
import ContextFilterFactory from '../../utils/context-filter-factory';

enum ChartType {
  Value = 'Value',
  Objective = 'Objective',
  Pie = 'Pie',
  Line = 'Line',
  Leaderboard = 'Leaderboard',
}

export default class Chart extends CollectionRoute {
  private static readonly formats: Record<DateOperation, string> = {
    Day: 'dd/MM/yyyy',
    Week: "'W'W-yyyy",
    Month: 'MMM yy',
    Year: 'yyyy',
  };

  setupRoutes(router: Router): void {
    router.post(`/stats/${this.collection.name}`, this.handleChart.bind(this));
  }

  async handleChart(context: Context) {
    const { body } = context.request;

    await this.services.permissions.canChart(context);

    if (!Object.values(ChartType).includes(body.type)) {
      throw new ValidationError(`Invalid Chart type "${body.type}"`);
    }

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
    const currentFilter = await this.getFilter(context);
    const result = {
      countCurrent: await this.computeValue(context, currentFilter),
      countPrevious: undefined,
    };

    const isAndAggregator =
      (currentFilter.conditionTree as ConditionTreeBranch)?.aggregator === 'And';
    const withCountPrevious = currentFilter.conditionTree?.someLeaf(
      leaf => leaf.useIntervalOperator,
    );

    if (withCountPrevious && !isAndAggregator) {
      result.countPrevious = await this.computeValue(
        context,
        FilterFactory.getPreviousPeriodFilter(currentFilter),
      );
    }

    return result;
  }

  private async makeObjectiveChart(context: Context): Promise<{ value: number }> {
    return { value: await this.computeValue(context, await this.getFilter(context)) };
  }

  private async makePieChart(context: Context): Promise<Array<{ key: string; value: number }>> {
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
      await this.getFilter(context),
      new Aggregation({
        operation: aggregate,
        field: aggregateField,
        groups: [{ field: groupByDateField, operation: timeRange }],
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

  private async makeLeaderboardChart(
    context: Context,
  ): Promise<Array<{ key: string; value: number }>> {
    const { body } = context.request;
    const field = this.collection.schema.fields[body.relationship_field] as RelationSchema;

    let collection: string;
    let filter: Filter;
    let aggregation: Aggregation;

    if (field?.type === 'OneToMany') {
      const inverse = CollectionUtils.getInverseRelation(this.collection, body.relationship_field);

      if (inverse) {
        collection = field.foreignCollection;
        filter = (await this.getFilter(context)).nest(inverse);
        aggregation = new Aggregation({
          operation: body.aggregate,
          field: body.aggregate_field,
          groups: [{ field: `${inverse}:${body.label_field}` }],
        });
      }
    }

    if (field?.type === 'ManyToMany') {
      const origin = CollectionUtils.getOriginRelation(this.collection, body.relationship_field);
      const target = CollectionUtils.getForeignRelation(this.collection, body.relationship_field);

      if (origin && target) {
        collection = field.throughCollection;
        filter = (await this.getFilter(context)).nest(origin);
        aggregation = new Aggregation({
          operation: body.aggregate,
          field: `${target}:${body.aggregate_field}`,
          groups: [{ field: `${origin}:${body.label_field}` }],
        });
      }
    }

    if (collection && filter && aggregation) {
      const rows = await this.dataSource
        .getCollection(collection)
        .aggregate(filter, aggregation, Number(body.limit));

      return rows.map(row => ({
        key: row.group[aggregation.groups[0].field] as string,
        value: row.value as number,
      }));
    }

    throw new ValidationError(
      `Failed to generate leaderboard chart: parameters do not match pre-requisites`,
    );
  }

  private async computeValue(context: Context, filter: Filter): Promise<number> {
    const { aggregate, aggregate_field: aggregateField } = context.request.body;
    const aggregation = new Aggregation({ operation: aggregate, field: aggregateField });

    const rows = await this.collection.aggregate(filter, aggregation);

    return rows.length ? (rows[0].value as number) : 0;
  }

  private async getFilter(context: Context): Promise<Filter> {
    const scope = await this.services.permissions.getScope(this.collection, context);

    return ContextFilterFactory.build(this.collection, context, scope);
  }
}
