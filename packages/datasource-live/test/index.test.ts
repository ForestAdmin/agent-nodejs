import { DataSourceSchema } from '@forestadmin/datasource-toolkit';

import getCollections, { LiveDataSource } from '../dist';

const emptyDataSourceSchema: DataSourceSchema = {
  collections: {},
};

describe('getCollections', () => {
  it('should return LiveDataSource collections', () => {
    const liveDataSource = new LiveDataSource(emptyDataSourceSchema);

    expect(getCollections(emptyDataSourceSchema)).toEqual(liveDataSource.collections);
  });
});
