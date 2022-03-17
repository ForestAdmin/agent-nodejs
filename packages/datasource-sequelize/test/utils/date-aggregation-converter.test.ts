import { DateOperation } from '@forestadmin/datasource-toolkit';
import { Dialect } from 'sequelize/dist';

import DateAggregationConverter from '../../src/utils/date-aggregation-converter';

describe('Utils > DateAggregationConverter', () => {
  describe('convertToDialect', () => {
    describe('when the dialect is unsupported', () => {
      it('should throw an error', () => {
        expect(() =>
          DateAggregationConverter.convertToDialect(
            'unknown' as Dialect,
            'a__field',
            DateOperation.ToDay,
          ),
        ).toThrowError('Unsupported dialect: "unknown"');
      });
    });

    describe('with postgres', () => {
      it('should return the right aggregation function', () => {
        const aggregationFunction = DateAggregationConverter.convertToDialect(
          'postgres',
          'a__field',
          DateOperation.ToDay,
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
          DateOperation.ToYear,
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
          DateOperation.ToMonth,
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
          DateOperation.ToDay,
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
          DateOperation.ToWeek,
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
        [DateOperation.ToYear, '%Y-01-01'],
        [DateOperation.ToMonth, '%Y-%m-01'],
        [DateOperation.ToDay, '%Y-%m-%d'],
      ])(
        'should return the right aggregation function for %s operation',
        (dateOperation, format) => {
          const aggregationFunction = DateAggregationConverter.convertToDialect(
            dialect,
            'a__field',
            dateOperation,
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
          DateOperation.ToWeek,
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
        [DateOperation.ToYear, '%Y-01-01'],
        [DateOperation.ToMonth, '%Y-%m-01'],
        [DateOperation.ToDay, '%Y-%m-%d'],
      ])(
        'should return the right aggregation function for %s operation',
        (dateOperation, format) => {
          const aggregationFunction = DateAggregationConverter.convertToDialect(
            'sqlite',
            'a__field',
            dateOperation,
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
          DateOperation.ToWeek,
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
