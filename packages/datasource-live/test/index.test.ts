import getCollections from '../src';
import LiveDataSource from '../src/datasource';

import { emptyDataSourceSchema } from './helpers/schemas';

describe('getCollections', () => {
  it('should return LiveDataSource collections', () => {
    const liveDataSource = new LiveDataSource(emptyDataSourceSchema);

    expect(getCollections(emptyDataSourceSchema)).toEqual(liveDataSource.collections);
  });
});
