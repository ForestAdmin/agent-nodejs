import * as mod from '../src/index';

describe('workflow-executor', () => {
  it('should export an empty module', () => {
    expect(Object.keys(mod)).toHaveLength(0);
  });
});
