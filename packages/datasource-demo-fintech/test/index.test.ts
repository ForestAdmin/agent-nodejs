import { createDemoFintechDataSource } from '../src/index';

describe('createDemoFintechDataSource', () => {
  it('should not crash', () => {
    expect(() => createDemoFintechDataSource()).not.toThrow();
  });
});
