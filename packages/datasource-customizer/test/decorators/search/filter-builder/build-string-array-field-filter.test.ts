import type { Operator } from '@forestadmin/datasource-toolkit';

import { ConditionTreeLeaf } from '@forestadmin/datasource-toolkit';

import buildBasicArrayFieldFilter from '../../../../src/decorators/search/filter-builder/build-basic-array-field-filter';
import buildStringArrayFieldFilter from '../../../../src/decorators/search/filter-builder/build-string-array-field-filter';

jest.mock('../../../../src/decorators/search/filter-builder/build-basic-array-field-filter');

describe('buildStringArrayFieldFilter', () => {
  const operators = new Set<Operator>(['In']);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should delegate to the basic array builder', () => {
    const expectedResult = new ConditionTreeLeaf('field', 'In', 'value');

    jest.mocked(buildBasicArrayFieldFilter).mockReturnValue(expectedResult);

    const result = buildStringArrayFieldFilter('field', operators, 'value', false);

    expect(buildBasicArrayFieldFilter).toHaveBeenCalledWith('field', operators, 'value', false);
    expect(result).toBe(expectedResult);
  });
});
