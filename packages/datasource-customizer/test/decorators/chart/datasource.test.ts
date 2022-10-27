import { DataSource } from '@forestadmin/datasource-toolkit/dist/src/interfaces/collection';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import ChartDataSourceDecorator from '../../../src/decorators/chart/datasource';

describe('ChartDataSourceDecorator', () => {
  describe('When decorating an empty datasource', () => {
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
        const caller = factories.caller.build();

        decorator.renderChart(caller, 'myChart');
        expect(dataSource.renderChart).toHaveBeenCalledWith(caller, 'myChart');
      });
    });

    describe('With a chart', () => {
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
        const caller = factories.caller.build();
        const result = await decorator.renderChart(caller, 'myChart');

        expect(result).toStrictEqual({ countCurrent: 34, countPrevious: 45 });
        expect(dataSource.renderChart).not.toHaveBeenCalled();
      });
    });
  });

  describe('When decorating a datasource with charts', () => {
    let dataSource: DataSource;
    let decorator: ChartDataSourceDecorator;

    beforeEach(() => {
      dataSource = factories.dataSource.build({
        schema: { charts: ['myChart'] },
      });
      decorator = new ChartDataSourceDecorator(dataSource);
    });

    it('addChart should throw when adding a duplicate', () => {
      expect(() => decorator.addChart('myChart', (_, rb) => rb.value(10))).toThrow(
        "Chart 'myChart' already exists.",
      );
    });
  });

  describe('When adding charts on a lower layer', () => {
    let dataSource: DataSource;
    let decorator1: ChartDataSourceDecorator;
    let decorator2: ChartDataSourceDecorator;

    beforeEach(() => {
      dataSource = factories.dataSource.build();
      decorator1 = new ChartDataSourceDecorator(dataSource);
      decorator2 = new ChartDataSourceDecorator(decorator1);
    });

    it('get schema should throw when adding a duplicate', () => {
      decorator2.addChart('myChart', (_, rb) => rb.value(10));
      decorator1.addChart('myChart', (_, rb) => rb.value(10));

      expect(() => dataSource.schema).not.toThrow();
      expect(() => decorator1.schema).not.toThrow();
      expect(() => decorator2.schema).toThrow("Chart 'myChart' is defined twice.");
    });
  });
});
