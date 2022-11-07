import type {
  AggregatedChart,
  ApiRouteChart,
  Chart,
  FilterableChart,
  GroupedByChart,
  LeaderboardChart,
  LineChart,
  ObjectiveChart,
} from '../charts/types';

import { ChartType } from '../charts/types';

export default class ChartDetector {
  public static isAPIRouteChart(chart: Chart): chart is ApiRouteChart {
    return 'apiRoute' in chart;
  }

  public static isLineChart(chart: Chart): chart is LineChart {
    return chart.type === ChartType.Line;
  }

  public static isObjectiveChart(chart: Chart): chart is ObjectiveChart {
    return chart.type === ChartType.Objective;
  }

  public static isLeaderboardChart(chart: Chart): chart is LeaderboardChart {
    return chart.type === ChartType.Leaderboard;
  }

  public static isFilterableChart(chart: Chart): chart is FilterableChart & Chart {
    return 'filter' in chart;
  }

  public static isAggregatedChart(chart: Chart): chart is AggregatedChart & Chart {
    return 'aggregator' in chart;
  }

  public static isGroupedByChart(chart: Chart): chart is GroupedByChart & Chart {
    return 'groupByFieldName' in chart;
  }
}
