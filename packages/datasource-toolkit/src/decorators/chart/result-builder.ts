import { DateTime, DateTimeUnit } from 'luxon';

import { DateOperation } from '../../interfaces/query/aggregation';
import {
  DistributionChart,
  LeaderboardChart,
  ObjectiveChart,
  PercentageChart,
  SmartChart,
  TimeBasedChart,
  ValueChart,
} from '../../interfaces/chart';

export default class ResultBuilder {
  private static readonly formats: Record<DateOperation, string> = {
    Day: 'dd/MM/yyyy',
    Week: "'W'W-kkkk",
    Month: 'MMM yy',
    Year: 'yyyy',
  };

  value(value: number, previousValue?: number): ValueChart {
    return { countCurrent: value, countPrevious: previousValue };
  }

  distribution(obj: Record<string, number>): DistributionChart {
    return Object.entries(obj).map(([key, value]) => ({ key, value }));
  }

  timeBased(timeRange: DateOperation, values: Record<string, number>): TimeBasedChart {
    const format = ResultBuilder.formats[timeRange];
    const formatted = {};

    for (const [date, value] of Object.entries(values)) {
      const label = DateTime.fromISO(date).toFormat(format);
      formatted[label] = (formatted[label] ?? 0) + value;
    }

    const dataPoints = [];
    const dates = Object.keys(values).sort((dateA, dateB) => dateA.localeCompare(dateB));
    const first = DateTime.fromISO(dates[0]).startOf(timeRange.toLowerCase() as DateTimeUnit);
    const last = DateTime.fromISO(dates[dates.length - 1]);

    for (let current = first; current <= last; current = current.plus({ [timeRange]: 1 })) {
      const label = current.toFormat(format);
      dataPoints.push({ label, values: { value: formatted[label] ?? 0 } });
    }

    return dataPoints;
  }

  percentage(value: number): PercentageChart {
    return value;
  }

  objective(value: number, objective: number): ObjectiveChart {
    return { value, objective };
  }

  leaderboard(obj: Record<string, number>): LeaderboardChart {
    return this.distribution(obj).sort((a, b) => b.value - a.value);
  }

  smart(data: unknown): SmartChart {
    return data;
  }
}
