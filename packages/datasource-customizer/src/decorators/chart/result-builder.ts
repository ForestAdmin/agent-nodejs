import type {
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
import type { DateTimeUnit } from 'luxon';

import { DateTime } from 'luxon';

export default class ResultBuilder {
  private static readonly formats: Record<DateOperation, string> = {
    Day: 'dd/MM/yyyy',
    Week: "'W'W-kkkk",
    Month: 'MMM yy',
    Quarter: "'Q'q-yyyy",
    Year: 'yyyy',
  };

  value(value: number, previousValue?: number): ValueChart {
    return { countCurrent: value, countPrevious: previousValue };
  }

  distribution(obj: Record<string, number>): DistributionChart {
    return Object.entries(obj).map(([key, value]) => ({ key, value }));
  }

  /**
   * Add a TimeBasedChart based on a time range and a set of values.
   * @param {DateOperation} timeRange - The time range for the chart,
   * specified as "Year", "Month", "Week" or "Day".
   * @param {Array<{ date: Date; value: number | null }> | Record<string, number>} values -
   *  This can be an array of objects with 'date' and 'value' properties,
   *  or a record (object) with date-value pairs.
   *
   * @returns {TimeBasedChart} Returns a TimeBasedChart representing the data within the specified
   * time range.
   *
   * @example
   * timeBased(
   *  'Day',
   *   [
   *    { date: new Date('2023-01-01'), value: 42 },
   *    { date: new Date('2023-01-02'), value: 55 },
   *    { date: new Date('2023-01-03'), value: null },
   *   ]
   * );
   */
  timeBased(
    timeRange: DateOperation,
    values: Array<{ date: Date; value: number | null }> | Record<string, number | null>,
  ): TimeBasedChart {
    if (!values) return [];

    if (Array.isArray(values)) {
      return ResultBuilder.buildTimeBasedChartResult(timeRange, values);
    }

    const formattedValues = Object.entries(values).map(([stringDate, value]) => ({
      date: new Date(stringDate),
      value,
    }));

    return ResultBuilder.buildTimeBasedChartResult(timeRange, formattedValues);
  }

  /**
   * Add a MultipleTimeBasedChart based on a time range,
   * an array of dates, and multiple lines of data.
   *
   * @param {DateOperation} timeRange - The time range for the chart,
   * specified as "Year", "Month", "Week" or "Day".
   * @param {Date[]} dates - An array of dates that define the x-axis values for the chart.
   * @param {Array<{ label: string; values: Array<number | null> }>} lines - An array of lines,
   * each containing a label and an array of numeric data values (or null)
   * corresponding to the dates.
   *
   * @returns {MultipleTimeBasedChart} Returns a MultipleTimeBasedChart representing multiple
   * lines of data within the specified time range.
   *
   * @example
   * multipleTimeBased(
   *  'Day',
   *  [
   *    new Date('1985-10-26'),
   *    new Date('2011-10-05T14:48:00.000Z'),
   *    new Date()
   *  ],
   *  [
   *    { label: 'line1', values: [1, 2, 3] },
   *    { label: 'line2', values: [3, 4, null] }
   *  ],
   * );
   */
  multipleTimeBased(
    timeRange: DateOperation,
    dates: Date[],
    lines: Array<{ label: string; values: Array<number | null> }>,
  ): MultipleTimeBasedChart {
    if (!dates || !lines) return { labels: null, values: null };

    let formattedTimes = null;
    const formattedLine = lines.map(line => {
      const values = dates.reduce((computed, date, index) => {
        computed.push({ date, value: line.values[index] });

        return computed;
      }, []);

      const buildTimeBased = ResultBuilder.buildTimeBasedChartResult(timeRange, values);
      if (!formattedTimes) formattedTimes = buildTimeBased.map(timeBased => timeBased.label);

      return { key: line.label, values: buildTimeBased.map(timeBased => timeBased.values.value) };
    });

    return {
      labels: formattedTimes,
      values: formattedTimes?.length > 0 ? formattedLine : null,
    };
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
   * [
   *  // YYYY-MM-DD
   *  { date: new Date('2022-01-07'), value: 1 }, // Jan 22
   *  { date: new Date('2022-02-02'), value: 2 }, // Feb 22
   *  { date: new Date('2022-01-01'), value: 3 }, // Jan 22
   *  { date: new Date('2022-02-01'), value: 4 }, // Feb 22
   * ]
   * The result will be:
   * [
   *  { label: 'Jan 22', values: { value: 4 } },
   *  { label: 'Feb 22', values: { value: 6 } },
   * ]
   */
  private static buildTimeBasedChartResult(
    timeRange: DateOperation,
    points: Array<{ date: Date; value: number | null }>,
  ): TimeBasedChart {
    if (!points.length) return [];

    const pointsInDateTime = points.map(point => ({
      date: DateTime.fromJSDate(point.date),
      value: point.value,
    }));

    const format = ResultBuilder.formats[timeRange];
    const formatted = {};

    pointsInDateTime.forEach(point => {
      const label = point.date.toFormat(format);
      if (typeof point.value === 'number') formatted[label] = (formatted[label] ?? 0) + point.value;
    });

    const dataPoints = [];
    const dates = pointsInDateTime
      .map(p => p.date)
      .sort((dateA, dateB) => dateA.toUnixInteger() - dateB.toUnixInteger());
    const first = dates[0].startOf(timeRange.toLowerCase() as DateTimeUnit);
    const last = dates[dates.length - 1];

    for (let current = first; current <= last; current = current.plus({ [timeRange]: 1 })) {
      const label = current.toFormat(format);
      dataPoints.push({ label, values: { value: formatted[label] ?? 0 } });
    }

    return dataPoints;
  }
}
