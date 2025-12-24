import type { ColumnSchema } from '@forestadmin/datasource-toolkit';

import {
  ConditionTreeFactory,
  ConditionTreeLeaf,
  allOperators,
} from '@forestadmin/datasource-toolkit';

import buildEnumFieldFilter from '../../../../src/decorators/search/filter-builder/build-enum-field-filter';

describe('buildEnumFieldFilter', () => {
  describe('when the value is part of the enum', () => {
    describe('when not negated', () => {
      const isNegated = false;

      describe('when Equal is supported', () => {
        const schema: ColumnSchema = {
          enumValues: ['foo', 'bar'],
          columnType: 'Enum',
          type: 'Column',
          filterOperators: new Set(['Equal']),
        };

        it('should return a valid condition tree', () => {
          const result = buildEnumFieldFilter('fieldName', schema, 'foo', isNegated);

          expect(result).toEqual(new ConditionTreeLeaf('fieldName', 'Equal', 'foo'));
        });

        describe('lenient find', () => {
          it('should return a condition when the casing is different', () => {
            const result = buildEnumFieldFilter('fieldName', schema, 'FOO', isNegated);

            expect(result).toEqual(new ConditionTreeLeaf('fieldName', 'Equal', 'foo'));
          });

          it('should return a condition when the value has extra spaces', () => {
            const result = buildEnumFieldFilter('fieldName', schema, ' foo ', isNegated);

            expect(result).toEqual(new ConditionTreeLeaf('fieldName', 'Equal', 'foo'));
          });
        });
      });

      describe('when Equal is not supported', () => {
        it('should return match-none', () => {
          const schema: ColumnSchema = {
            enumValues: ['foo', 'bar'],
            columnType: 'Enum',
            type: 'Column',
            filterOperators: new Set([]),
          };
          const result = buildEnumFieldFilter('fieldName', schema, 'foo', isNegated);

          expect(result).toEqual(ConditionTreeFactory.MatchNone);
        });
      });
    });

    describe('when negated', () => {
      const isNegated = true;

      describe('when NotEqual and Missing are supported', () => {
        const schema: ColumnSchema = {
          type: 'Column',
          columnType: 'Enum',
          enumValues: ['foo', 'bar'],
          filterOperators: new Set(['NotEqual', 'Missing']),
        };

        it('should return a valid condition tree', () => {
          const result = buildEnumFieldFilter('fieldName', schema, 'foo', isNegated);

          expect(result).toEqual(
            ConditionTreeFactory.union(
              new ConditionTreeLeaf('fieldName', 'NotEqual', 'foo'),
              new ConditionTreeLeaf('fieldName', 'Missing'),
            ),
          );
        });
      });

      describe('when NotEqual only is supported', () => {
        const schema: ColumnSchema = {
          type: 'Column',
          columnType: 'Enum',
          enumValues: ['foo', 'bar'],
          filterOperators: new Set(['NotEqual']),
        };

        it('should return a valid condition tree', () => {
          const result = buildEnumFieldFilter('fieldName', schema, 'foo', isNegated);

          expect(result).toEqual(new ConditionTreeLeaf('fieldName', 'NotEqual', 'foo'));
        });
      });

      describe('when NotEqual is not supported', () => {
        it('should return match-all', () => {
          const schema: ColumnSchema = {
            type: 'Column',
            columnType: 'Enum',
            enumValues: ['foo', 'bar'],
            filterOperators: new Set(['Missing']),
          };

          const result = buildEnumFieldFilter('fieldName', schema, 'foo', isNegated);

          expect(result).toEqual(ConditionTreeFactory.MatchAll);
        });
      });
    });
  });

  describe('when the value is not part of the enum', () => {
    const schema: ColumnSchema = {
      type: 'Column',
      columnType: 'Enum',
      filterOperators: new Set(allOperators),
      enumValues: ['foo', 'bar'],
    };

    it('should return match-none when isNegated=false', () => {
      const result = buildEnumFieldFilter('fieldName', schema, 'fooBAR', false);

      expect(result).toEqual(ConditionTreeFactory.MatchNone);
    });

    it('should return match-all when isNegated=true', () => {
      const result = buildEnumFieldFilter('fieldName', schema, 'fooBAR', true);

      expect(result).toEqual(ConditionTreeFactory.MatchAll);
    });
  });
});
