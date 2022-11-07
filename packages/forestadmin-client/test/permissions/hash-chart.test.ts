import { Chart, ChartType, LineChart, PieChart, ValueChart } from '../../src/charts/types';
import { hashChartRequest, hashServerCharts } from '../../src/permissions/hash-chart';

describe('HashChart', () => {
  describe('hashServerCharts', () => {
    it('should hash queries', () => {
      const charts: Chart[] = [
        {
          query: 'select * from books',
          type: ChartType.Value,
        },
        {
          query: 'select * from authors',
          type: ChartType.Value,
        },
      ];

      const result = hashServerCharts(charts);

      expect(result.size).toBe(2);
    });

    describe.each([
      ChartType.Leaderboard,
      ChartType.Objective,
      ChartType.Percentage,
      ChartType.Pie,
      ChartType.Value,
      ChartType.Line,
    ])('with %s charts', type => {
      it('should generate a hash for the type', () => {
        const charts: Chart[] = [
          {
            type,
            filter: { aggregator: 'or', conditions: [] },
            aggregator: 'Count',
            aggregateFieldName: 'Year',
            sourceCollectionName: 'books',
            labelFieldName: 'year',
          } as Chart,
        ];

        const result = hashServerCharts(charts);

        expect(result.size).toBe(1);
      });
    });

    it('should exclude null or undefined values from the hash', () => {
      const charts: Chart[] = [
        {
          type: ChartType.Line,
          aggregator: 'Count',
          aggregateFieldName: '',
          sourceCollectionName: 'books',
          groupByFieldName: 'id',
          timeRange: 'Day',
        },
        {
          type: ChartType.Line,
          filter: undefined,
          aggregator: 'Count',
          aggregateFieldName: '',
          sourceCollectionName: 'books',
          groupByFieldName: 'id',
          timeRange: 'Day',
        } as unknown as LineChart,
      ];

      const result = hashServerCharts(charts);

      expect(result.size).toBe(1);
    });

    it('should generate different hashes for different properties', () => {
      const charts: Chart[] = [
        {
          type: ChartType.Line,
          aggregator: 'Count',
          aggregateFieldName: '',
          sourceCollectionName: 'books',
          groupByFieldName: 'id',
          timeRange: 'Day',
        },
        {
          type: ChartType.Line,
          aggregator: 'Count',
          aggregateFieldName: '',
          sourceCollectionName: 'books',
          groupByFieldName: 'id',
          timeRange: 'Year',
        },
      ];

      const result = hashServerCharts(charts);

      expect(result.size).toBe(2);
    });
  });

  describe('hashChartRequest', () => {
    it('should generate the same hash for the same request', () => {
      const valueChart: ValueChart = {
        type: ChartType.Value,
        aggregator: 'Count',
        aggregateFieldName: 'year',
        sourceCollectionName: 'books',
      };

      const hash = hashChartRequest(valueChart);
      const hash2 = hashChartRequest({ ...valueChart });

      expect(hash).toBe(hash2);
    });

    it('should generate different hashes for different requests', () => {
      const valueChart1: ValueChart = {
        type: ChartType.Value,
        filter: null,
        aggregator: 'Count',
        aggregateFieldName: 'year',
        sourceCollectionName: 'books',
      };

      const valueChart2: ValueChart = {
        type: ChartType.Value,
        filter: null,
        aggregator: 'Count',
        aggregateFieldName: 'price',
        sourceCollectionName: 'books',
      };

      const hash1 = hashChartRequest(valueChart1);
      const hash2 = hashChartRequest(valueChart2);

      expect(hash1).not.toBe(hash2);
    });

    it('should generate hashes without subfields in group by', () => {
      const pieChart1: PieChart = {
        type: ChartType.Pie,
        filter: null,
        aggregator: 'Count',
        aggregateFieldName: 'year',
        sourceCollectionName: 'books',
        groupByFieldName: 'author:age',
      };

      const pieChart2: PieChart = {
        type: ChartType.Pie,
        filter: null,
        aggregator: 'Count',
        aggregateFieldName: 'year',
        sourceCollectionName: 'books',
        groupByFieldName: 'author:bookCount',
      };

      const hash1 = hashChartRequest(pieChart1);
      const hash2 = hashChartRequest(pieChart2);

      expect(hash1).not.toBe(hash2);
    });

    it('should not compare null or undefined values', () => {
      const chart1: PieChart = {
        type: ChartType.Pie,
        filter: null,
        aggregator: 'Count',
        aggregateFieldName: 'year',
        sourceCollectionName: 'books',
        groupByFieldName: 'author:age',
      };

      const chart2: PieChart = {
        type: ChartType.Pie,
        aggregator: 'Count',
        aggregateFieldName: 'year',
        sourceCollectionName: 'books',
        groupByFieldName: 'author:age',
      };

      const hash1 = hashChartRequest(chart1);
      const hash2 = hashChartRequest(chart2);

      expect(hash1).toBe(hash2);
    });
  });

  describe('both', () => {
    describe('lineChart', () => {
      it('should generate the same hash for server & request formats', () => {
        const serverChart: LineChart = {
          type: ChartType.Line,
          aggregator: 'Count',
          aggregateFieldName: 'id',
          sourceCollectionName: 'books',
          groupByFieldName: 'publishedAt',
          timeRange: 'Day',
        };

        const requestChart: LineChart = {
          type: ChartType.Line,
          aggregator: 'Count',
          aggregateFieldName: 'id',
          sourceCollectionName: 'books',
          timeRange: 'Day',
          groupByFieldName: 'publishedAt',
        };

        const serverHash = hashServerCharts([serverChart]);

        const requestHash = hashChartRequest(requestChart);

        expect(serverHash.has(requestHash)).toBe(true);
      });

      it('should generate different hashes if requests are different', () => {
        const serverChart: LineChart = {
          type: ChartType.Line,
          aggregator: 'Count',
          aggregateFieldName: 'id',
          sourceCollectionName: 'books',
          groupByFieldName: 'publishedAt',
          timeRange: 'Day',
        };

        const requestChart: LineChart = {
          type: ChartType.Line,
          filter: null,
          aggregator: 'Count',
          aggregateFieldName: 'id',
          sourceCollectionName: 'books',
          timeRange: 'Day',
          groupByFieldName: 'createdAt',
        };

        const serverHash = hashServerCharts([serverChart]);

        const requestHash = hashChartRequest(requestChart);

        expect(serverHash.has(requestHash)).toBe(false);
      });
    });

    describe('pieChart', () => {
      it('should generate the same hash for server & request formats', () => {
        const serverChart: PieChart = {
          type: ChartType.Pie,
          aggregator: 'Sum',
          aggregateFieldName: 'id',
          sourceCollectionName: 'books',
          groupByFieldName: 'price',
        };

        const requestChart: PieChart = {
          type: ChartType.Pie,
          filter: null,
          aggregator: 'Sum',
          aggregateFieldName: 'id',
          sourceCollectionName: 'books',
          groupByFieldName: 'price',
        };

        const serverHash = hashServerCharts([serverChart]);

        const requestHash = hashChartRequest(requestChart);

        expect(serverHash.has(requestHash)).toBe(true);
      });

      it('should generate different hashes if requests are different', () => {
        const serverChart: PieChart = {
          type: ChartType.Pie,
          aggregator: 'Sum',
          aggregateFieldName: 'id',
          sourceCollectionName: 'books',
          groupByFieldName: 'count',
        };

        const requestChart: PieChart = {
          type: ChartType.Pie,
          filter: null,
          aggregator: 'Sum',
          aggregateFieldName: 'id',
          sourceCollectionName: 'books',
          groupByFieldName: 'price',
        };

        const serverHash = hashServerCharts([serverChart]);

        const requestHash = hashChartRequest(requestChart);

        expect(serverHash.has(requestHash)).toBe(false);
      });
    });

    describe('valueChart', () => {
      it('should generate the same hash for server & request formats', () => {
        const serverChart: ValueChart = {
          type: ChartType.Value,
          aggregator: 'Count',
          aggregateFieldName: 'id',
          sourceCollectionName: 'books',
        };

        const requestChart: ValueChart = {
          type: ChartType.Value,
          filter: null,
          aggregator: 'Count',
          aggregateFieldName: 'id',
          sourceCollectionName: 'books',
        };

        const serverHash = hashServerCharts([serverChart]);

        const requestHash = hashChartRequest(requestChart);

        expect(serverHash.has(requestHash)).toBe(true);
      });

      it('should generate different hashes if requests are different', () => {
        const serverChart: ValueChart = {
          type: ChartType.Value,
          aggregator: 'Count',
          aggregateFieldName: 'id',
          sourceCollectionName: 'books',
        };

        const requestChart: ValueChart = {
          type: ChartType.Value,
          filter: null,
          aggregator: 'Count',
          aggregateFieldName: 'title',
          sourceCollectionName: 'books',
        };

        const serverHash = hashServerCharts([serverChart]);

        const requestHash = hashChartRequest(requestChart);

        expect(serverHash.has(requestHash)).toBe(false);
      });
    });
  });
});
