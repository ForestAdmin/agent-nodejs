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

import {
  Chart,
  ChartType,
  LeaderboardChart,
  LineChart,
  ObjectiveChart,
  PieChart,
  ValueChart,
} from '@forestadmin/forestadmin-client';
import CollectionRoute from '../collection-route';
import ContextFilterFactory from '../../utils/context-filter-factory';
import QueryStringParser from '../../utils/query-string';

export default class ChartRoute extends CollectionRoute {
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
    await this.services.authorization.assertCanRetrieveChart(context);

    context.response.body = {
      data: {
        id: uuidv1(),
        type: 'stats',
        attributes: { value: await this.makeChart(context) },
      },
    };
  }

  private async makeChart(context: Context) {
    const { type } = <Chart>context.request.body;

    switch (type) {
      case ChartType.Value:
        return this.makeValueChart(context);
      case ChartType.Leaderboard:
        return this.makeLeaderboardChart(context);
      case ChartType.Objective:
        return this.makeObjectiveChart(context);
      case ChartType.Pie:
        return this.makePieChart(context);
      case ChartType.Line:
        return this.makeLineChart(context);
      default:
        throw new ValidationError(`Invalid Chart type "${type}"`);
    }
  }

  private async makeValueChart(
    context: Context,
  ): Promise<{ countCurrent: number; countPrevious?: number }> {
    const caller = QueryStringParser.parseCaller(context);
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
        FilterFactory.getPreviousPeriodFilter(currentFilter, caller.timezone),
      );
    }

    return result;
  }

  private async makeObjectiveChart(context: Context): Promise<{ value: number }> {
    return { value: await this.computeValue(context, await this.getFilter(context)) };
  }

  private async makePieChart(context: Context): Promise<Array<{ key: string; value: number }>> {
    const {
      groupByFieldName: groupByField,
      aggregator,
      aggregateFieldName: aggregateField,
    } = <PieChart>context.request.body;

    const rows = await this.collection.aggregate(
      QueryStringParser.parseCaller(context),
      await this.getFilter(context),
      new Aggregation({
        operation: aggregator,
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
      aggregator,
      aggregateFieldName: aggregateField,
      groupByFieldName: groupByDateField,
      timeRange,
    } = <LineChart>context.request.body;

    const rows = await this.collection.aggregate(
      QueryStringParser.parseCaller(context),
      await this.getFilter(context),
      new Aggregation({
        operation: aggregator,
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
    const format = ChartRoute.formats[timeRange];

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
    const body = <LeaderboardChart>context.request.body;
    const field = this.collection.schema.fields[body.relationshipFieldName] as RelationSchema;

    let collection: string;
    let filter: Filter;
    let aggregation: Aggregation;

    if (field?.type === 'OneToMany') {
      const inverse = CollectionUtils.getInverseRelation(
        this.collection,
        body.relationshipFieldName,
      );

      if (inverse) {
        collection = field.foreignCollection;
        filter = (await this.getFilter(context)).nest(inverse);
        aggregation = new Aggregation({
          operation: body.aggregator,
          field: body.aggregateFieldName,
          groups: [{ field: `${inverse}:${body.labelFieldName}` }],
        });
      }
    }

    if (field?.type === 'ManyToMany') {
      const origin = CollectionUtils.getThroughOrigin(this.collection, body.relationshipFieldName);
      const target = CollectionUtils.getThroughTarget(this.collection, body.relationshipFieldName);

      if (origin && target) {
        collection = field.throughCollection;
        filter = (await this.getFilter(context)).nest(origin);
        aggregation = new Aggregation({
          operation: body.aggregator,
          field: body.aggregateFieldName ? `${target}:${body.aggregateFieldName}` : null,
          groups: [{ field: `${origin}:${body.labelFieldName}` }],
        });
      }
    }

    if (collection && filter && aggregation) {
      const rows = await this.dataSource
        .getCollection(collection)
        .aggregate(QueryStringParser.parseCaller(context), filter, aggregation, Number(body.limit));

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
    const { aggregator, aggregateFieldName: aggregateField } = <ValueChart | ObjectiveChart>(
      context.request.body
    );
    const aggregation = new Aggregation({ operation: aggregator, field: aggregateField });

    const rows = await this.collection.aggregate(
      QueryStringParser.parseCaller(context),
      filter,
      aggregation,
    );

    return rows.length ? (rows[0].value as number) : 0;
  }

  private async getFilter(context: Context): Promise<Filter> {
    const scope = await this.services.authorization.getScope(this.collection, context);

    return ContextFilterFactory.build(this.collection, context, scope);
  }
}
