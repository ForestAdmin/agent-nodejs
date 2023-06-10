import { DateOperation } from '@forestadmin/datasource-toolkit';
import { Dialect, Sequelize } from 'sequelize';

import DateAggregationConverter from '../../src/utils/date-aggregation-converter';

describe('Utils > DateAggregationConverter', () => {
  describe('convertToDialect', () => {
    describe('when the dialect is unsupported', () => {
      it('should throw an error', () => {
        const sequelize = new Sequelize({ dialect: 'postgres' });
        sequelize.getDialect = jest.fn().mockReturnValue('unknown');
        const dateAggregationConverter = new DateAggregationConverter(sequelize);
        expect(() => dateAggregationConverter.convertToDialect('a__field', 'Day')).toThrow(
          'Unsupported dialect: "unknown"',
        );
      });
    });

    describe('with postgres', () => {
      const setup = () => {
        const sequelize = new Sequelize({ dialect: 'postgres' });

        return new DateAggregationConverter(sequelize);
      };

      it('should return the right aggregation function', () => {
        const dateAggregationConverter = setup();
        const aggregationFunction = dateAggregationConverter.convertToDialect('a__field', 'Day');

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
      const setup = () => {
        const sequelize = new Sequelize({ dialect: 'mssql' });

        return new DateAggregationConverter(sequelize);
      };

      it('should throw an error for an unknown operation', () => {
        const dateAggregationConverter = setup();
        expect(() =>
          dateAggregationConverter.convertToDialect('a__field', 'unknown' as DateOperation),
        ).toThrow('Unknown Date operation: "unknown"');
      });

      it('should return the right aggregation function for Year operation', () => {
        const dateAggregationConverter = setup();
        const aggregationFunction = dateAggregationConverter.convertToDialect('a__field', 'Year');

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
        const dateAggregationConverter = setup();
        const aggregationFunction = dateAggregationConverter.convertToDialect('a__field', 'Month');

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
        const dateAggregationConverter = setup();
        const aggregationFunction = dateAggregationConverter.convertToDialect('a__field', 'Day');

        expect(aggregationFunction).toEqual({
          fn: 'CONVERT',
          args: [{ val: 'varchar(10)' }, { col: 'a__field' }, 23],
        });
      });

      it('should return the right aggregation function for Week operation', () => {
        const dateAggregationConverter = setup();
        const aggregationFunction = dateAggregationConverter.convertToDialect('a__field', 'Week');

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
      const setup = () => {
        const sequelize = new Sequelize({ dialect });

        return new DateAggregationConverter(sequelize);
      };

      it('should throw an error for an unknown operation', () => {
        const dateAggregationConverter = setup();
        expect(() =>
          dateAggregationConverter.convertToDialect('a__field', 'unknown' as DateOperation),
        ).toThrow('Unknown Date operation: "unknown"');
      });

      it.each([
        ['Year', '%Y-01-01'],
        ['Month', '%Y-%m-01'],
        ['Day', '%Y-%m-%d'],
      ])(
        'should return the right aggregation function for %s operation',
        (dateOperation, format) => {
          const dateAggregationConverter = setup();
          const aggregationFunction = dateAggregationConverter.convertToDialect(
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
        const dateAggregationConverter = setup();
        const aggregationFunction = dateAggregationConverter.convertToDialect('a__field', 'Week');

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
  });
});
