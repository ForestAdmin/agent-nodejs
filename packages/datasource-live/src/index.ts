import { DataSourceSchema } from '@forestadmin/datasource-toolkit';
import LiveDataSource from './datasource';

export default function getCollections(dataSourceSchema: DataSourceSchema) {
  return new LiveDataSource(dataSourceSchema).collections;
}

export { LiveDataSource };
