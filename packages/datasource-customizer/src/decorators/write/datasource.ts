import { DataSource } from '@forestadmin/datasource-toolkit';

import DataSourceDecorator from '../datasource-decorator';
import RelationWriterCollectionDecorator from './relation/collection';
import WriteReplacerCollectionDecorator from './write-replace/collection';

/**
 * Decorator which allows to change the behavior of the write actions for given fields.
 */
export default class WriteDataSourceDecorator extends DataSourceDecorator<WriteReplacerCollectionDecorator> {
  constructor(childDataSource: DataSource) {
    const decorator = new DataSourceDecorator(childDataSource, RelationWriterCollectionDecorator);
    super(decorator, WriteReplacerCollectionDecorator);
  }
}
