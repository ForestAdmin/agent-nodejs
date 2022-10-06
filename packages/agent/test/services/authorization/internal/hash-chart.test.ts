import {
  Chart,
  ChartType,
  LineChart,
  PieChart,
  ValueChart,
} from '../../../../src/services/authorization/internal/types';
import {
  hashChartRequest,
  hashServerCharts,
} from '../../../../src/services/authorization/internal/hash-chart';

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
            filter: '{}',
            aggregator: 'Count',
            aggregateFieldName: 'Year',
            sourceCollectionId: 'books',
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
          sourceCollectionId: 'books',
          groupByFieldName: 'id',
          timeRange: 'Day',
        },
        {
          type: ChartType.Line,
          filter: undefined,
          aggregator: 'Count',
          aggregateFieldName: '',
          sourceCollectionId: 'books',
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
          sourceCollectionId: 'books',
          groupByFieldName: 'id',
          timeRange: 'Day',
        },
        {
          type: ChartType.Line,
          aggregator: 'Count',
          aggregateFieldName: '',
          sourceCollectionId: 'books',
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
        sourceCollectionId: 'books',
      };

      const hash = hashChartRequest(valueChart);
      const hash2 = hashChartRequest({ ...valueChart });

      expect(hash).toBe(hash2);
    });

    it('should generate different hashes for different requests', () => {
      const valueChart1 = {
        type: ChartType.Value,
        filter: null,
        aggregate: 'Count',
        aggregate_field: 'year',
        collection: 'books',
      };

      const valueChart2 = {
        type: ChartType.Value,
        filter: null,
        aggregate: 'Count',
        aggregate_field: 'price',
        collection: 'books',
      };

      const hash1 = hashChartRequest(valueChart1);
      const hash2 = hashChartRequest(valueChart2);

      expect(hash1).not.toBe(hash2);
    });

    it('should generate hashes without subfields in group by', () => {
      const pieChart1 = {
        type: ChartType.Pie,
        filter: null,
        aggregate: 'Count',
        aggregate_field: 'year',
        collection: 'books',
        group_by_field: 'author:age',
      };

      const pieChart2 = {
        type: ChartType.Pie,
        filter: null,
        aggregate: 'Count',
        aggregate_field: 'year',
        collection: 'books',
        group_by_field: 'author:bookCount',
      };

      const hash1 = hashChartRequest(pieChart1);
      const hash2 = hashChartRequest(pieChart2);

      expect(hash1).toBe(hash2);
    });

    it('should not compare null or undefined values', () => {
      const chart1 = {
        type: ChartType.Pie,
        filter: null,
        aggregate: 'Count',
        aggregate_field: 'year',
        collection: 'books',
        group_by_field: 'author:age',
      };

      const chart2 = {
        type: ChartType.Pie,
        aggregate: 'Count',
        aggregate_field: 'year',
        collection: 'books',
        group_by_field: 'author:age',
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
          sourceCollectionId: 'books',
          groupByFieldName: 'publishedAt',
          timeRange: 'Day',
        };

        const requestChart = {
          type: ChartType.Line,
          aggregate: 'Count',
          aggregate_field: 'id',
          collection: 'books',
          time_range: 'Day',
          group_by_date_field: 'publishedAt',
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
          sourceCollectionId: 'books',
          groupByFieldName: 'publishedAt',
          timeRange: 'Day',
        };

        const requestChart = {
          type: ChartType.Line,
          filters: null,
          aggregate: 'Count',
          aggregate_field: 'id',
          collection: 'books',
          time_range: 'Day',
          group_by_date_field: 'createdAt',
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
          sourceCollectionId: 'books',
          groupByFieldName: 'price',
        };

        const requestChart = {
          type: ChartType.Pie,
          filters: null,
          aggregate: 'Sum',
          aggregate_field: 'id',
          collection: 'books',
          group_by_field: 'price',
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
          sourceCollectionId: 'books',
          groupByFieldName: 'count',
        };

        const requestChart = {
          type: ChartType.Pie,
          filters: null,
          aggregate: 'Sum',
          aggregate_field: 'id',
          collection: 'books',
          group_by_field: 'price',
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
          sourceCollectionId: 'books',
        };

        const requestChart = {
          type: ChartType.Value,
          filters: null,
          aggregate: 'Count',
          aggregate_field: 'id',
          collection: 'books',
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
          sourceCollectionId: 'books',
        };

        const requestChart = {
          type: ChartType.Value,
          filters: null,
          aggregate: 'Count',
          aggregate_field: 'title',
          collection: 'books',
        };

        const serverHash = hashServerCharts([serverChart]);

        const requestHash = hashChartRequest(requestChart);

        expect(serverHash.has(requestHash)).toBe(false);
      });
    });
  });
});
