import * as factories from '../../__factories__';
import { ChartDataSourceDecorator, DataSource } from '../../../src';

describe('ChartDataSourceDecorator', () => {
  let dataSource: DataSource;
  let decorator: ChartDataSourceDecorator;

  beforeEach(() => {
    dataSource = factories.dataSource.build();
    decorator = new ChartDataSourceDecorator(dataSource);
  });

  describe('With no charts', () => {
    test('schema should be empty', () => {
      expect(decorator.schema).toStrictEqual({ charts: [] });
    });

    test('renderChart should proxy call', async () => {
      decorator.renderChart(null, 'myChart');
      expect(dataSource.renderChart).toHaveBeenCalledWith(null, 'myChart');
    });
  });

  describe('With a charts', () => {
    beforeEach(() => {
      decorator.addChart('myChart', (ctx, resultBuilder) => {
        return resultBuilder.value(34, 45);
      });
    });

    test('schema throw an error if a chart already exists', () => {
      expect(() => decorator.addChart('myChart', () => {})).toThrow(
        "Chart 'myChart' already exists.",
      );
    });

    test('schema should not be empty', () => {
      expect(decorator.schema).toStrictEqual({ charts: ['myChart'] });
    });

    test('renderChart should not proxy call', async () => {
      const result = await decorator.renderChart(null, 'myChart');

      expect(result).toStrictEqual({ countCurrent: 34, countPrevious: 45 });
      expect(dataSource.renderChart).not.toHaveBeenCalled();
    });
  });
});
