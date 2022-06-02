import { Logger } from '@forestadmin/datasource-toolkit';

import { FirebaseDataSource } from '../src';

describe('FirebaseDataSource', () => {
  it('should create a new datasource without a logger', () => {
    const datasource = new FirebaseDataSource();
    expect(datasource).toBeInstanceOf(FirebaseDataSource);
  });

  it('should create a new datasource with a logger', () => {
    const logger = {};
    const datasource = new FirebaseDataSource(logger as unknown as Logger);
    expect(datasource).toBeInstanceOf(FirebaseDataSource);
  });
});
