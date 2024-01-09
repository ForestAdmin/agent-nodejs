import {
  ColumnSchema,
  ConditionTreeFactory,
  ConditionTreeLeaf,
  PrimitiveTypes,
  allOperators,
} from '@forestadmin/datasource-toolkit';

import buildBooleanFieldFilter from '../../../../src/decorators/search/filter-builder/build-boolean-field-filter';
import buildDateFieldFilter from '../../../../src/decorators/search/filter-builder/build-date-field-filter';
import buildEnumFieldFilter from '../../../../src/decorators/search/filter-builder/build-enum-field-filter';
import buildFieldFilter from '../../../../src/decorators/search/filter-builder/build-field-filter';
import buildNumberFieldFilter from '../../../../src/decorators/search/filter-builder/build-number-field-filter';
import buildStringFieldFilter from '../../../../src/decorators/search/filter-builder/build-string-field-filter';
import buildUuidFieldFilter from '../../../../src/decorators/search/filter-builder/build-uuid-field-filter';

jest.mock('../../../../src/decorators/search/filter-builder/build-boolean-field-filter');
jest.mock('../../../../src/decorators/search/filter-builder/build-date-field-filter');
jest.mock('../../../../src/decorators/search/filter-builder/build-enum-field-filter');
jest.mock('../../../../src/decorators/search/filter-builder/build-number-field-filter');
jest.mock('../../../../src/decorators/search/filter-builder/build-string-field-filter');
jest.mock('../../../../src/decorators/search/filter-builder/build-uuid-field-filter');

const BUILDER_BY_TYPE: Record<
  PrimitiveTypes,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { builder: jest.MaybeMockedDeep<any>; callWithSchema?: true } | undefined
> = {
  Boolean: { builder: jest.mocked(buildBooleanFieldFilter) },
  Date: { builder: jest.mocked(buildDateFieldFilter) },
  Dateonly: { builder: jest.mocked(buildDateFieldFilter) },
  Enum: { builder: jest.mocked(buildEnumFieldFilter), callWithSchema: true },
  Number: { builder: jest.mocked(buildNumberFieldFilter) },
  String: { builder: jest.mocked(buildStringFieldFilter) },
  Uuid: { builder: jest.mocked(buildUuidFieldFilter) },
  Json: { builder: jest.mocked(buildStringFieldFilter) },
  Binary: undefined,
  Point: undefined,
  Time: undefined,
};

describe('buildFieldFilter', () => {
  const field = 'fieldName';

  describe('with a NULL search string', () => {
    const searchString = 'NULL';

    describe('when not negated', () => {
      const isNegated = false;

      it('returns a valid condition tree if the operator Missing is present', () => {
        const schema: ColumnSchema = {
          type: 'Column',
          columnType: 'Number',
          filterOperators: new Set(['Missing']),
        };
        const result = buildFieldFilter(field, schema, searchString, isNegated);

        expect(result).toEqual(new ConditionTreeLeaf(field, 'Missing'));
      });

      it('returns a match-none if the operator missing is missing', () => {
        const schema: ColumnSchema = {
          type: 'Column',
          columnType: 'Number',
          filterOperators: new Set([]),
        };
        const result = buildFieldFilter(field, schema, searchString, isNegated);

        expect(result).toEqual(ConditionTreeFactory.MatchNone);
      });
    });

    describe('when negated', () => {
      it('returns a valid condition if the operator Present is present', () => {
        const schema: ColumnSchema = {
          type: 'Column',
          columnType: 'Number',
          filterOperators: new Set(['Present']),
        };
        const result = buildFieldFilter(field, schema, searchString, true);

        expect(result).toEqual(new ConditionTreeLeaf(field, 'Present'));
      });

      it('should return match-all if the operator is missing', () => {
        const schema: ColumnSchema = {
          type: 'Column',
          columnType: 'Number',
          filterOperators: new Set([]),
        };
        const result = buildFieldFilter(field, schema, searchString, true);

        expect(result).toEqual(ConditionTreeFactory.MatchAll);
      });
    });
  });

  describe.each(Object.entries(BUILDER_BY_TYPE))('for type %s', (type, expected) => {
    const schema: ColumnSchema = {
      type: 'Column',
      columnType: type as PrimitiveTypes,
      filterOperators: new Set(allOperators),
    };

    if (expected) {
      it('should call the builder with the right arguments', () => {
        buildFieldFilter(field, schema, 'searchString', false);

        expect(expected.builder).toHaveBeenCalledWith(
          field,
          expected.callWithSchema ? schema : schema.filterOperators,
          'searchString',
          false,
        );
      });

      it('should also delegate if the type is an array of the expected type', () => {
        const arraySchema: ColumnSchema = {
          ...schema,
          columnType: [type as PrimitiveTypes],
        };

        buildFieldFilter(field, arraySchema, 'searchString', false);

        expect(expected.builder).toHaveBeenCalledWith(
          field,
          expected.callWithSchema ? arraySchema : schema.filterOperators,
          'searchString',
          false,
        );
      });

      it('should pass isNegated = true if negated', () => {
        buildFieldFilter(field, schema, 'searchString', true);

        expect(expected.builder).toHaveBeenCalledWith(
          field,
          expected.callWithSchema ? schema : schema.filterOperators,
          'searchString',
          true,
        );
      });
    } else {
      describe('if not negated', () => {
        it('should return match-none', () => {
          const result = buildFieldFilter(field, schema, 'searchString', false);

          expect(result).toEqual(ConditionTreeFactory.MatchNone);
        });
      });

      describe('if negated', () => {
        it('should return match-all', () => {
          const result = buildFieldFilter(field, schema, 'searchString', true);

          expect(result).toEqual(ConditionTreeFactory.MatchAll);
        });
      });
    }
  });
});
