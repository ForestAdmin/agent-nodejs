import {
  DistributionChart,
  LeaderboardChart,
  ObjectiveChart,
  PercentageChart,
  TimeBasedChart,
  ValueChart,
} from '@forestadmin/datasource-toolkit';

import HttpRequester from '../http-requester';

export interface ChartInterface {
  valueChart(...args: unknown[]): Promise<ValueChart>;
  distributionChart(...args: unknown[]): Promise<DistributionChart>;
  percentageChart(...args: unknown[]): Promise<PercentageChart>;
  objectiveChart(...args: unknown[]): Promise<ObjectiveChart>;
  leaderboardChart(...args: unknown[]): Promise<LeaderboardChart>;
  timeBasedChart(...args: unknown[]): Promise<TimeBasedChart>;
}

export default abstract class Chart implements ChartInterface {
  protected httpRequester: HttpRequester;

  async valueChart(chartName: string): Promise<ValueChart> {
    return this.loadChart(chartName);
  }

  async distributionChart(chartName: string): Promise<DistributionChart> {
    return this.loadChart(chartName);
  }

  async percentageChart(chartName: string): Promise<PercentageChart> {
    return this.loadChart(chartName);
  }

  async objectiveChart(chartName: string): Promise<ObjectiveChart> {
    return this.loadChart(chartName);
  }

  async leaderboardChart(chartName: string): Promise<LeaderboardChart> {
    return this.loadChart(chartName);
  }

  async timeBasedChart(chartName: string): Promise<TimeBasedChart> {
    return this.loadChart(chartName);
  }

  protected async loadChart<Type>(
    chartName: string,
    body?: Record<string, unknown>,
  ): Promise<Type> {
    if (!this.httpRequester) {
      throw new Error(
        'HttpRequester is not initialized. Please ensure it is set before calling chart methods.',
      );
    }

    const result = await this.httpRequester.query<{ value: Type }>({
      method: 'post',
      path: `${HttpRequester.escapeUrlSlug(`/forest/_charts/${chartName}`)}`,
      body,
    });

    return result.value;
  }
}
