import type HttpRequester from '../../src/http-requester';

import Chart from '../../src/domains/chart';

// Create a concrete implementation for testing since Chart is abstract
class TestChart extends Chart {
  constructor(httpRequester: HttpRequester) {
    super();
    this.httpRequester = httpRequester;
  }
}

describe('Chart', () => {
  let httpRequester: jest.Mocked<HttpRequester>;
  let chart: TestChart;

  beforeEach(() => {
    jest.clearAllMocks();
    httpRequester = {
      query: jest.fn(),
      stream: jest.fn(),
    } as any;
    chart = new TestChart(httpRequester);
  });

  describe('valueChart', () => {
    it('should load a value chart', async () => {
      httpRequester.query.mockResolvedValue({ value: { countCurrent: 100 } });

      const result = await chart.valueChart('totalUsers');

      expect(httpRequester.query).toHaveBeenCalledWith({
        method: 'post',
        path: '/forest/_charts/totalUsers',
        body: undefined,
      });
      expect(result).toEqual({ countCurrent: 100 });
    });
  });

  describe('distributionChart', () => {
    it('should load a distribution chart', async () => {
      const distributionData = [
        { key: 'active', value: 50 },
        { key: 'inactive', value: 30 },
      ];
      httpRequester.query.mockResolvedValue({ value: distributionData });

      const result = await chart.distributionChart('usersByStatus');

      expect(httpRequester.query).toHaveBeenCalledWith({
        method: 'post',
        path: '/forest/_charts/usersByStatus',
        body: undefined,
      });
      expect(result).toEqual(distributionData);
    });
  });

  describe('percentageChart', () => {
    it('should load a percentage chart', async () => {
      httpRequester.query.mockResolvedValue({ value: 75 });

      const result = await chart.percentageChart('conversionRate');

      expect(httpRequester.query).toHaveBeenCalledWith({
        method: 'post',
        path: '/forest/_charts/conversionRate',
        body: undefined,
      });
      expect(result).toBe(75);
    });
  });

  describe('objectiveChart', () => {
    it('should load an objective chart', async () => {
      const objectiveData = { value: 750, objective: 1000 };
      httpRequester.query.mockResolvedValue({ value: objectiveData });

      const result = await chart.objectiveChart('salesGoal');

      expect(httpRequester.query).toHaveBeenCalledWith({
        method: 'post',
        path: '/forest/_charts/salesGoal',
        body: undefined,
      });
      expect(result).toEqual(objectiveData);
    });
  });

  describe('leaderboardChart', () => {
    it('should load a leaderboard chart', async () => {
      const leaderboardData = [
        { key: 'John', value: 100 },
        { key: 'Jane', value: 90 },
        { key: 'Bob', value: 85 },
      ];
      httpRequester.query.mockResolvedValue({ value: leaderboardData });

      const result = await chart.leaderboardChart('topSellers');

      expect(httpRequester.query).toHaveBeenCalledWith({
        method: 'post',
        path: '/forest/_charts/topSellers',
        body: undefined,
      });
      expect(result).toEqual(leaderboardData);
    });
  });

  describe('timeBasedChart', () => {
    it('should load a time-based chart', async () => {
      const timeBasedData = [
        { label: '2024-01', values: { value: 100 } },
        { label: '2024-02', values: { value: 150 } },
        { label: '2024-03', values: { value: 200 } },
      ];
      httpRequester.query.mockResolvedValue({ value: timeBasedData });

      const result = await chart.timeBasedChart('monthlySales');

      expect(httpRequester.query).toHaveBeenCalledWith({
        method: 'post',
        path: '/forest/_charts/monthlySales',
        body: undefined,
      });
      expect(result).toEqual(timeBasedData);
    });
  });

  describe('loadChart error handling', () => {
    it('should throw error when httpRequester is not initialized', async () => {
      const uninitializedChart = new TestChart(undefined as any);

      await expect(uninitializedChart.valueChart('test')).rejects.toThrow(
        'HttpRequester is not initialized. Please ensure it is set before calling chart methods.',
      );
    });

    it('should escape special characters in chart name', async () => {
      httpRequester.query.mockResolvedValue({ value: 100 });

      await chart.valueChart('chart+name');

      expect(httpRequester.query).toHaveBeenCalledWith({
        method: 'post',
        path: '/forest/_charts/chart\\+name',
        body: undefined,
      });
    });
  });
});
