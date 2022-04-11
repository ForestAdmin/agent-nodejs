import { Dialect } from 'sequelize/types';

import { DateOperation } from '@forestadmin/datasource-toolkit';

import DateAggregationConverter from '../../src/utils/date-aggregation-converter';

describe('Utils > DateAggregationConverter', () => {
  describe('convertToDialect', () => {
    describe('when the dialect is unsupported', () => {
      it('should throw an error', () => {
        expect(() =>
          DateAggregationConverter.convertToDialect('unknown' as Dialect, 'a__field', 'Day'),
        ).toThrowError('Unsupported dialect: "unknown"');
      });
    });

    describe('with postgres', () => {
      it('should return the right aggregation function', () => {
        const aggregationFunction = DateAggregationConverter.convertToDialect(
          'postgres',
          'a__field',
          'Day',
        );

        expect(aggregationFunction).toEqual({
          fn: 'TO_CHAR',
          args: [
            {
              fn: 'DATE_TRUNC',
              args: ['day', { col: 'a__field' }],
            },
            'YYYY-MM-DD',
          ],
        });
      });
    });

    describe('with mssql', () => {
      it('should throw an error for an unknown operation', () => {
        expect(() =>
          DateAggregationConverter.convertToDialect(
            'mssql',
            'a__field',
            'unknown' as DateOperation,
          ),
        ).toThrowError('Unknown Date operation: "unknown"');
      });

      it('should return the right aggregation function for Year operation', () => {
        const aggregationFunction = DateAggregationConverter.convertToDialect(
          'mssql',
          'a__field',
          'Year',
        );

        expect(aggregationFunction).toEqual({
          fn: 'CONVERT',
          args: [
            { val: 'varchar(10)' },
            {
              fn: 'DATEFROMPARTS',
              args: [{ fn: 'DATEPART', args: [{ val: 'YEAR' }, { col: 'a__field' }] }, '01', '01'],
            },
            23,
          ],
        });
      });

      it('should return the right aggregation function for Month operation', () => {
        const aggregationFunction = DateAggregationConverter.convertToDialect(
          'mssql',
          'a__field',
          'Month',
        );

        expect(aggregationFunction).toEqual({
          fn: 'CONVERT',
          args: [
            { val: 'varchar(10)' },
            {
              fn: 'DATEFROMPARTS',
              args: [
                { fn: 'DATEPART', args: [{ val: 'YEAR' }, { col: 'a__field' }] },
                { fn: 'DATEPART', args: [{ val: 'MONTH' }, { col: 'a__field' }] },
                '01',
              ],
            },
            23,
          ],
        });
      });

      it('should return the right aggregation function for Day operation', () => {
        const aggregationFunction = DateAggregationConverter.convertToDialect(
          'mssql',
          'a__field',
          'Day',
        );

        expect(aggregationFunction).toEqual({
          fn: 'CONVERT',
          args: [{ val: 'varchar(10)' }, { col: 'a__field' }, 23],
        });
      });

      it('should return the right aggregation function for Week operation', () => {
        const aggregationFunction = DateAggregationConverter.convertToDialect(
          'mssql',
          'a__field',
          'Week',
        );

        expect(aggregationFunction).toEqual({
          fn: 'CONVERT',
          args: [
            { val: 'varchar(10)' },
            {
              fn: 'DATEADD',
              args: [{ val: 'DAY' }, { val: '-DATEPART(dw, a__field)+2' }, { col: 'a__field' }],
            },
            23,
          ],
        });
      });
    });

    describe.each(['mysql', 'mariadb'] as Dialect[])('with %s', dialect => {
      it('should throw an error for an unknown operation', () => {
        expect(() =>
          DateAggregationConverter.convertToDialect(
            dialect,
            'a__field',
            'unknown' as DateOperation,
          ),
        ).toThrowError('Unknown Date operation: "unknown"');
      });

      it.each([
        ['Year', '%Y-01-01'],
        ['Month', '%Y-%m-01'],
        ['Day', '%Y-%m-%d'],
      ])(
        'should return the right aggregation function for %s operation',
        (dateOperation, format) => {
          const aggregationFunction = DateAggregationConverter.convertToDialect(
            dialect,
            'a__field',
            dateOperation as DateOperation,
          );

          expect(aggregationFunction).toEqual({
            fn: 'DATE_FORMAT',
            args: [
              {
                col: 'a__field',
              },
              format,
            ],
          });
        },
      );

      it('should return the right aggregation function for Week operation', () => {
        const aggregationFunction = DateAggregationConverter.convertToDialect(
          dialect,
          'a__field',
          'Week',
        );

        expect(aggregationFunction).toEqual({
          fn: 'DATE_FORMAT',
          args: [
            {
              fn: 'DATE_SUB',
              args: [
                {
                  col: 'a__field',
                },
                {
                  val: 'INTERVAL(WEEKDAY(a__field)) DAY',
                },
              ],
            },
            '%Y-%m-%d',
          ],
        });
      });
    });

    describe('with sqlite', () => {
      it('should throw an error for an unknown operation', () => {
        expect(() =>
          DateAggregationConverter.convertToDialect(
            'sqlite',
            'a__field',
            'unknown' as DateOperation,
          ),
        ).toThrowError('Unknown Date operation: "unknown"');
      });

      it.each([
        ['Year', '%Y-01-01'],
        ['Month', '%Y-%m-01'],
        ['Day', '%Y-%m-%d'],
      ])(
        'should return the right aggregation function for %s operation',
        (dateOperation, format) => {
          const aggregationFunction = DateAggregationConverter.convertToDialect(
            'sqlite',
            'a__field',
            dateOperation as DateOperation,
          );

          expect(aggregationFunction).toEqual({
            fn: 'STRFTIME',
            args: [
              format,
              {
                col: 'a__field',
              },
            ],
          });
        },
      );

      it('should return the right aggregation function for Week operation', () => {
        const aggregationFunction = DateAggregationConverter.convertToDialect(
          'sqlite',
          'a__field',
          'Week',
        );

        expect(aggregationFunction).toEqual({
          fn: 'DATE',
          args: [
            {
              col: 'a__field',
            },
            'weekday 0',
          ],
        });
      });
    });
  });
});
