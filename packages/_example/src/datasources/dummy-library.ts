import {
  ActionCollectionDecorator,
  DataSource,
  DataSourceDecorator,
  OperatorsEmulateCollectionDecorator,
  OperatorsReplaceCollectionDecorator,
  PublicationCollectionDecorator,
  RenameCollectionDecorator,
  SearchCollectionDecorator,
  SegmentCollectionDecorator,
  SortEmulateCollectionDecorator,
} from '@forestadmin/datasource-toolkit';
import makeDummyDataSource from '@forestadmin/datasource-dummy';

const prepareDataSource = async (): Promise<DataSource> => {
  let dataSource = makeDummyDataSource();
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
