import {
  DistributionChart,
  LeaderboardChart,
  ObjectiveChart,
  PercentageChart,
  TimeBasedChart,
  ValueChart,
} from '@forestadmin/datasource-toolkit';

import { ChartInterface } from './chart';
import HttpRequester from '../http-requester';

export type ChartContext = {
  recordId: string | number;
};

export default abstract class CollectionChart implements ChartInterface {
  protected httpRequester: HttpRequester;
  private collectionName: string;

  constructor(collectionName: string, httpRequester: HttpRequester) {
    this.httpRequester = httpRequester;
    this.collectionName = collectionName;
  }

  async valueChart(chartName: string, { recordId }: ChartContext): Promise<ValueChart> {
    return this.loadChart(chartName, { record_id: recordId });
  }

  async distributionChart(
    chartName: string,
    { recordId }: ChartContext,
  ): Promise<DistributionChart> {
    return this.loadChart(chartName, { record_id: recordId });
  }

  async percentageChart(chartName: string, { recordId }: ChartContext): Promise<PercentageChart> {
    return this.loadChart(chartName, { record_id: recordId });
  }

  async objectiveChart(chartName: string, { recordId }: ChartContext): Promise<ObjectiveChart> {
    return this.loadChart(chartName, { record_id: recordId });
  }

  async leaderboardChart(chartName: string, { recordId }: ChartContext): Promise<LeaderboardChart> {
    return this.loadChart(chartName, { record_id: recordId });
  }

  async timeBasedChart(chartName: string, { recordId }: ChartContext): Promise<TimeBasedChart> {
    return this.loadChart(chartName, { record_id: recordId });
  }

  protected async loadChart<Type>(
    chartName: string,
    body?: Record<string, unknown>,
  ): Promise<Type> {
    const result = await this.httpRequester.query<{ value: Type }>({
      method: 'post',
      path: `${HttpRequester.escapeUrlSlug(
        `/forest/_charts/${this.collectionName as string}/${chartName}`,
      )}`,
      body,
    });

    return result.value;
  }
}
