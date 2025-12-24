import Collection from '../../src/domains/collection';
import HttpRequester from '../../src/http-requester';

jest.mock('../../src/http-requester', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      query: jest.fn(),
      stream: jest.fn(),
    })),
  };
});
jest.mock('../../src/action-fields/field-form-states');

// Restore the static method
const originalEscapeUrlSlug = jest.requireActual('../../src/http-requester').default.escapeUrlSlug;
(HttpRequester as any).escapeUrlSlug = originalEscapeUrlSlug;

describe('CollectionChart (via Collection)', () => {
  let httpRequester: jest.Mocked<HttpRequester>;
  let collection: Collection<unknown>;

  beforeEach(() => {
    jest.clearAllMocks();
    httpRequester = {
      query: jest.fn(),
      stream: jest.fn(),
    } as any;
    collection = new Collection('orders', httpRequester, {});
  });

  describe('valueChart', () => {
    it('should call httpRequester.query with correct parameters', async () => {
      const chartValue = { countCurrent: 100 };
      httpRequester.query.mockResolvedValue({ value: chartValue });

      const result = await collection.valueChart('revenue', { recordId: '123' });

      expect(httpRequester.query).toHaveBeenCalledWith({
        method: 'post',
        path: '/forest/_charts/orders/revenue',
        body: { record_id: '123' },
      });
      expect(result).toEqual(chartValue);
    });

    it('should handle numeric recordId', async () => {
      httpRequester.query.mockResolvedValue({ value: { countCurrent: 50 } });

      await collection.valueChart('count', { recordId: 456 });

      expect(httpRequester.query).toHaveBeenCalledWith({
        method: 'post',
        path: '/forest/_charts/orders/count',
        body: { record_id: 456 },
      });
    });
  });

  describe('distributionChart', () => {
    it('should call httpRequester.query and return distribution data', async () => {
      const chartValue = [
        { key: 'Category A', value: 40 },
        { key: 'Category B', value: 60 },
      ];
      httpRequester.query.mockResolvedValue({ value: chartValue });

      const result = await collection.distributionChart('by-category', { recordId: '1' });

      expect(httpRequester.query).toHaveBeenCalledWith({
        method: 'post',
        path: '/forest/_charts/orders/by-category',
        body: { record_id: '1' },
      });
      expect(result).toEqual(chartValue);
    });
  });

  describe('percentageChart', () => {
    it('should call httpRequester.query and return percentage data', async () => {
      const chartValue = { value: 75 };
      httpRequester.query.mockResolvedValue({ value: chartValue });

      const result = await collection.percentageChart('completion-rate', { recordId: '5' });

      expect(httpRequester.query).toHaveBeenCalledWith({
        method: 'post',
        path: '/forest/_charts/orders/completion-rate',
        body: { record_id: '5' },
      });
      expect(result).toEqual(chartValue);
    });
  });

  describe('objectiveChart', () => {
    it('should call httpRequester.query and return objective data', async () => {
      const chartValue = { value: 80, objective: 100 };
      httpRequester.query.mockResolvedValue({ value: chartValue });

      const result = await collection.objectiveChart('sales-goal', { recordId: '10' });

      expect(httpRequester.query).toHaveBeenCalledWith({
        method: 'post',
        path: '/forest/_charts/orders/sales-goal',
        body: { record_id: '10' },
      });
      expect(result).toEqual(chartValue);
    });
  });

  describe('leaderboardChart', () => {
    it('should call httpRequester.query and return leaderboard data', async () => {
      const chartValue = [
        { key: 'John', value: 100 },
        { key: 'Jane', value: 95 },
        { key: 'Bob', value: 80 },
      ];
      httpRequester.query.mockResolvedValue({ value: chartValue });

      const result = await collection.leaderboardChart('top-performers', { recordId: '20' });

      expect(httpRequester.query).toHaveBeenCalledWith({
        method: 'post',
        path: '/forest/_charts/orders/top-performers',
        body: { record_id: '20' },
      });
      expect(result).toEqual(chartValue);
    });
  });

  describe('timeBasedChart', () => {
    it('should call httpRequester.query and return time-based data', async () => {
      const chartValue = [
        { label: '2023-01', values: { value: 100 } },
        { label: '2023-02', values: { value: 150 } },
        { label: '2023-03', values: { value: 200 } },
      ];
      httpRequester.query.mockResolvedValue({ value: chartValue });

      const result = await collection.timeBasedChart('monthly-sales', { recordId: '30' });

      expect(httpRequester.query).toHaveBeenCalledWith({
        method: 'post',
        path: '/forest/_charts/orders/monthly-sales',
        body: { record_id: '30' },
      });
      expect(result).toEqual(chartValue);
    });
  });

  describe('URL escaping', () => {
    it('should escape space characters in collection name', async () => {
      const specialCollection = new Collection('my special collection', httpRequester, {});
      httpRequester.query.mockResolvedValue({ value: { countCurrent: 10 } });

      await specialCollection.valueChart('test-chart', { recordId: '1' });

      expect(httpRequester.query).toHaveBeenCalledWith({
        method: 'post',
        path: '/forest/_charts/my%20special%20collection/test-chart',
        body: { record_id: '1' },
      });
    });
  });
});
