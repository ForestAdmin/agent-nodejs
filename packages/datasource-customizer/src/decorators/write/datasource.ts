import { DataSource } from '@forestadmin/datasource-toolkit';

import DataSourceDecorator from '../datasource-decorator';
import CreateRelationsCollectionDecorator from './create-relations/collection';
import UpdateRelationsCollectionDecorator from './update-relations/collection';
import WriteReplacerCollectionDecorator from './write-replace/collection';

/**
 * Decorator which allows to change the behavior of the write actions for given fields.
 */
export default class WriteDataSourceDecorator extends DataSourceDecorator<WriteReplacerCollectionDecorator> {
  constructor(childDataSource: DataSource) {
    const create = new DataSourceDecorator(childDataSource, CreateRelationsCollectionDecorator);
    const update = new DataSourceDecorator(create, UpdateRelationsCollectionDecorator);
    super(update, WriteReplacerCollectionDecorator);
  }
}
