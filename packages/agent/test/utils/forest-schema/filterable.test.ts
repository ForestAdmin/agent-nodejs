import { allOperators } from '@forestadmin/datasource-toolkit/dist/src/interfaces/query/condition-tree/nodes/operators';

import FilterableUtils from '../../../src/utils/forest-schema/filterable';

describe('FrontendFilterableUtils', () => {
  describe('Normal types need to have defined minimum operators', () => {
    test('With undefined operators', () => {
      const isFilterable = FilterableUtils.isFilterable('String');
      expect(isFilterable).toBe(false);
    });

    test('With no operators', () => {
      const isFilterable = FilterableUtils.isFilterable('String', new Set());
      expect(isFilterable).toBe(false);
    });

    test('With only the relevant operators', () => {
      const isFilterable = FilterableUtils.isFilterable(
        'String',
        new Set([
          'Equal',
          'NotEqual',
          'Present',
          'Blank',
          'In',
          'StartsWith',
          'EndsWith',
          'Contains',
          'NotContains',
        ]),
      );

      expect(isFilterable).toBe(true);
    });

    test('With all operators', () => {
      const isFilterable = FilterableUtils.isFilterable('String', new Set(allOperators));

      expect(isFilterable).toBeTruthy();
    });
  });

  describe('Arrays need the IncludesAll operator', () => {
    test('With no operators', () => {
      const isFilterable = FilterableUtils.isFilterable(['String'], new Set());
      expect(isFilterable).toBe(false);
    });

    test('With includeAll', () => {
      const isFilterable = FilterableUtils.isFilterable(['String'], new Set(['IncludesAll']));

      expect(isFilterable).toBeTruthy();
    });
  });

  describe('Point is never filterable', () => {
    test('With no operators', () => {
      const isFilterable = FilterableUtils.isFilterable('Point', new Set());
      expect(isFilterable).toBe(false);
    });

    test('With all operators', () => {
      const isFilterable = FilterableUtils.isFilterable('Point', new Set(allOperators));

      expect(isFilterable).toBe(false);
    });
  });

  describe('Nested types are never filterable', () => {
    test('With no operators', () => {
      const isFilterable = FilterableUtils.isFilterable(
        { firstName: 'String', lastName: 'String' },
        new Set(),
      );

      expect(isFilterable).toBe(false);
    });

    test('With all operators', () => {
      const isFilterable = FilterableUtils.isFilterable(
        { firstName: 'String', lastName: 'String' },
        new Set(allOperators),
      );

      expect(isFilterable).toBe(false);
    });
  });
});
