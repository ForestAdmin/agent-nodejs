import {
  DateOperation,
  DistributionChart,
  LeaderboardChart,
  MultipleTimeBasedChart,
  ObjectiveChart,
  PercentageChart,
  SmartChart,
  TimeBasedChart,
  ValueChart,
} from '@forestadmin/datasource-toolkit';
import { DateTime, DateTimeUnit } from 'luxon';

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
    return ResultBuilder.buildTimeBasedChartResult(timeRange, values);
  }

  /**
   * Add lines on the same timeBased chart.
   * @param timeRange time range of the chart.
   * @param times times of the chart in the ISO format.
   * @param lines:label label of the line. It will be displayed in the legend.
   * @param lines:values values of the line. It must be in the same order as the times.
   * @returns the time based chart with the lines.
   *
   * @example
   * collection.multipleTimeBased(
   *  'Day',
   *  ['1985-10-26', '2011-10-05T14:48:00.000Z', new Date().toISOString()],
   *  [{ label: 'line1', values: [1, 2, 3] }, { label: 'line2', values: [3, 4, null] }],
   * );
   */
  multipleTimeBased(
    timeRange: DateOperation,
    times: string[],
    lines: { label: string; values: number[] }[],
  ): MultipleTimeBasedChart {
    let formattedTimes;
    const formattedLine = lines.map(line => {
      const values = times.reduce((computed, time, index) => {
        computed[time] = line.values[index];

        return computed;
      }, {});

      const buildTimeBased = ResultBuilder.buildTimeBasedChartResult(timeRange, values);
      if (!formattedTimes) formattedTimes = buildTimeBased.map(timeBased => timeBased.label);

      return { key: line.label, values: buildTimeBased.map(timeBased => timeBased.values.value) };
    });

    return { labels: formattedTimes, values: formattedLine };
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

  /*
   * Normalize the time based chart result to have a value for each time range.
   * For example, if the time range is 'Month' and the values are:
   * {
   *  // YYYY-MM-DD
   *  '2022-01-07': 1, // Jan 22
   *  '2022-02-02': 2, // Feb 22
   *  '2022-01-01': 3, // Jan 22
   *  '2022-02-01': 4, // Feb 22
   * }
   * The result will be:
   * [
   *  { label: 'Jan 22', values: { value: 4 } },
   *  { label: 'Feb 22', values: { value: 6 } },
   * ]
   */
  private static buildTimeBasedChartResult(
    timeRange: DateOperation,
    values: Record<string, number>,
  ): TimeBasedChart {
    const format = ResultBuilder.formats[timeRange];
    const formatted = {};

    for (const [date, value] of Object.entries(values)) {
      const isoDate = DateTime.fromISO(date);
      if (!isoDate.isValid) throw new Error(`Date ${date} must be to ISO format.`);
      const label = isoDate.toFormat(format);

      if (typeof value === 'number') formatted[label] = (formatted[label] ?? 0) + value;
    }

    const dataPoints = [];
    const dates = Object.keys(values).sort((dateA, dateB) => dateA.localeCompare(dateB));
    const first = DateTime.fromISO(dates[0]).startOf(timeRange.toLowerCase() as DateTimeUnit);
    const last = DateTime.fromISO(dates[dates.length - 1]);

    for (let current = first; current <= last; current = current.plus({ [timeRange]: 1 })) {
      const label = current.toFormat(format);
      dataPoints.push({ label, values: { value: formatted[label] ?? null } });
    }

    return dataPoints;
  }
}
