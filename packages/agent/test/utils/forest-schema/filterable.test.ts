import { allOperators } from '@forestadmin/datasource-toolkit/dist/src/interfaces/query/condition-tree/nodes/operators';

import FilterableUtils from '../../../src/utils/forest-schema/filterable';

describe('FrontendFilterableUtils', () => {
  test('With undefined operators', () => {
    const isFilterable = FilterableUtils.isFilterable(undefined);
    expect(isFilterable).toBe(false);
  });

  test('With no operators', () => {
    const isFilterable = FilterableUtils.isFilterable(new Set());
    expect(isFilterable).toBe(false);
  });

  test('With some operators', () => {
    const isFilterable = FilterableUtils.isFilterable(
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
    const isFilterable = FilterableUtils.isFilterable(new Set(allOperators));

    expect(isFilterable).toBeTruthy();
  });
});
