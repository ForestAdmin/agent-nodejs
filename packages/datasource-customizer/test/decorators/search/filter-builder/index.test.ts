import type { Caller, ColumnSchema, PrimitiveTypes } from '@forestadmin/datasource-toolkit';

import {
  ConditionTreeFactory,
  ConditionTreeLeaf,
  allOperators,
} from '@forestadmin/datasource-toolkit';

import buildFieldFilter from '../../../../src/decorators/search/filter-builder';
import buildBooleanFieldFilter from '../../../../src/decorators/search/filter-builder/build-boolean-field-filter';
import buildDateFieldFilter from '../../../../src/decorators/search/filter-builder/build-date-field-filter';
import buildEnumArrayFieldFilter from '../../../../src/decorators/search/filter-builder/build-enum-array-field-filter';
import buildEnumFieldFilter from '../../../../src/decorators/search/filter-builder/build-enum-field-filter';
import buildNumberArrayFieldFilter from '../../../../src/decorators/search/filter-builder/build-number-array-field-filter';
import buildNumberFieldFilter from '../../../../src/decorators/search/filter-builder/build-number-field-filter';
import buildStringArrayFieldFilter from '../../../../src/decorators/search/filter-builder/build-string-array-field-filter';
import buildStringFieldFilter from '../../../../src/decorators/search/filter-builder/build-string-field-filter';
import buildUuidFieldFilter from '../../../../src/decorators/search/filter-builder/build-uuid-field-filter';

jest.mock('../../../../src/decorators/search/filter-builder/build-boolean-field-filter');
jest.mock('../../../../src/decorators/search/filter-builder/build-date-field-filter');
jest.mock('../../../../src/decorators/search/filter-builder/build-enum-field-filter');
jest.mock('../../../../src/decorators/search/filter-builder/build-number-field-filter');
jest.mock('../../../../src/decorators/search/filter-builder/build-string-field-filter');
jest.mock('../../../../src/decorators/search/filter-builder/build-uuid-field-filter');
jest.mock('../../../../src/decorators/search/filter-builder/build-number-array-field-filter');
jest.mock('../../../../src/decorators/search/filter-builder/build-string-array-field-filter');
jest.mock('../../../../src/decorators/search/filter-builder/build-enum-array-field-filter');

const BUILDER_BY_TYPE: Record<
  PrimitiveTypes,
  | {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      builder: jest.MaybeMockedDeep<any>;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      arrayBuilder?: jest.MaybeMockedDeep<any>;
      callWithSchema?: true;
      structuredCall?: true;
    }
  | undefined
> = {
  Boolean: { builder: jest.mocked(buildBooleanFieldFilter) },
  Date: { builder: jest.mocked(buildDateFieldFilter), structuredCall: true },
  Dateonly: { builder: jest.mocked(buildDateFieldFilter), structuredCall: true },
  Enum: {
    builder: jest.mocked(buildEnumFieldFilter),
    arrayBuilder: jest.mocked(buildEnumArrayFieldFilter),
    callWithSchema: true,
  },
  Number: {
    builder: jest.mocked(buildNumberFieldFilter),
    arrayBuilder: jest.mocked(buildNumberArrayFieldFilter),
  },
  String: {
    builder: jest.mocked(buildStringFieldFilter),
    arrayBuilder: jest.mocked(buildStringArrayFieldFilter),
  },
  Uuid: { builder: jest.mocked(buildUuidFieldFilter) },
  Json: undefined,
  Binary: undefined,
  Point: undefined,
  Time: undefined,
  Timeonly: undefined,
};

describe('buildFieldFilter', () => {
  const field = 'fieldName';
  const caller: Caller = {
    id: 42,
  } as Caller;

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
        const result = buildFieldFilter(caller, field, schema, searchString, isNegated);

        expect(result).toEqual(new ConditionTreeLeaf(field, 'Missing'));
      });

      it('returns a match-none if the operator missing is missing', () => {
        const schema: ColumnSchema = {
          type: 'Column',
          columnType: 'Number',
          filterOperators: new Set([]),
        };
        const result = buildFieldFilter(caller, field, schema, searchString, isNegated);

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
        const result = buildFieldFilter(caller, field, schema, searchString, true);

        expect(result).toEqual(new ConditionTreeLeaf(field, 'Present'));
      });

      it('should return match-all if the operator is missing', () => {
        const schema: ColumnSchema = {
          type: 'Column',
          columnType: 'Number',
          filterOperators: new Set([]),
        };
        const result = buildFieldFilter(caller, field, schema, searchString, true);

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
        buildFieldFilter(caller, field, schema, 'searchString', false);

        const expectedArguments = expected.structuredCall
          ? [
              {
                field,
                filterOperators: schema.filterOperators,
                searchString: 'searchString',
                isNegated: false,
                columnType: schema.columnType,
                timezone: caller.timezone,
              },
            ]
          : [
              field,
              expected.callWithSchema ? schema : schema.filterOperators,
              'searchString',
              false,
            ];

        expect(expected.builder).toHaveBeenCalledWith(...expectedArguments);
      });

      it('should pass isNegated = true if negated', () => {
        buildFieldFilter(caller, field, schema, 'searchString', true);

        const expectedArguments = expected.structuredCall
          ? [
              {
                field,
                filterOperators: schema.filterOperators,
                searchString: 'searchString',
                isNegated: true,
                columnType: schema.columnType,
                timezone: caller.timezone,
              },
            ]
          : [
              field,
              expected.callWithSchema ? schema : schema.filterOperators,
              'searchString',
              true,
            ];

        expect(expected.builder).toHaveBeenCalledWith(...expectedArguments);
      });

      describe('for array types', () => {
        const arraySchema: ColumnSchema = {
          type: 'Column',
          columnType: [type as PrimitiveTypes],
          filterOperators: new Set(allOperators),
        };

        if (expected.arrayBuilder) {
          it('should call the arrayBuilder with the right arguments', () => {
            buildFieldFilter(caller, field, arraySchema, 'searchString', true);

            expect(expected.arrayBuilder).toHaveBeenCalledWith(
              field,
              expected.callWithSchema ? arraySchema : arraySchema.filterOperators,
              'searchString',
              true,
            );
          });
        } else {
          it('should have returned the default condition', () => {
            const result = buildFieldFilter(caller, field, arraySchema, 'searchString', false);

            expect(result).toEqual(ConditionTreeFactory.MatchNone);
          });
        }
      });
    } else {
      describe('if not negated', () => {
        it('should return match-none', () => {
          const result = buildFieldFilter(caller, field, schema, 'searchString', false);

          expect(result).toEqual(ConditionTreeFactory.MatchNone);
        });
      });

      describe('if negated', () => {
        it('should return match-all', () => {
          const result = buildFieldFilter(caller, field, schema, 'searchString', true);

          expect(result).toEqual(ConditionTreeFactory.MatchAll);
        });
      });
    }
  });
});
