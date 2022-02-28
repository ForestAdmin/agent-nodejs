import {
  ActionCollectionDecorator,
  ActionFieldType,
  ActionScope,
  DataSourceDecorator,
  OperatorsEmulateCollectionDecorator,
  OperatorsReplaceCollectionDecorator,
  PublicationCollectionDecorator,
  RenameCollectionDecorator,
  SearchCollectionDecorator,
  SegmentCollectionDecorator,
  SortEmulateCollectionDecorator,
} from '@forestadmin/datasource-toolkit';
import { DummyDataSource } from '@forestadmin/datasource-dummy';

const prepareDataSource = async (): Promise<DummyDataSource> => {
  let dataSource = new DummyDataSource();
  dataSource = new DataSourceDecorator(dataSource, OperatorsEmulateCollectionDecorator);
  dataSource = new DataSourceDecorator(dataSource, OperatorsReplaceCollectionDecorator);
  dataSource = new DataSourceDecorator(dataSource, SortEmulateCollectionDecorator);
  dataSource = new DataSourceDecorator(dataSource, SegmentCollectionDecorator);
  dataSource = new DataSourceDecorator(dataSource, RenameCollectionDecorator);
  dataSource = new DataSourceDecorator(dataSource, PublicationCollectionDecorator);
  dataSource = new DataSourceDecorator(dataSource, SearchCollectionDecorator);
  dataSource = new DataSourceDecorator(dataSource, ActionCollectionDecorator);

  return dataSource;
};

export default prepareDataSource;
