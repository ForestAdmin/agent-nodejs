import { DataSourceSchema } from '@forestadmin/datasource-toolkit';

import getCollections from '../src';
import LiveDataSource from '../src/datasource';

const emptyDataSourceSchema: DataSourceSchema = {
  name: '__empty_data_source__',
  collections: {},
};

describe('getCollections', () => {
  it('should return LiveDataSource collections', () => {
    const liveDataSource = new LiveDataSource(emptyDataSourceSchema);

    expect(getCollections(emptyDataSourceSchema)).toEqual(liveDataSource.collections);
  });
});
