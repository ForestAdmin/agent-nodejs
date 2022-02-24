import {
  ActionCollectionDecorator,
  ActionFieldType,
  ActionSchemaScope,
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

  const decorator = new DataSourceDecorator(dataSource, ActionCollectionDecorator);

  decorator.getCollection('books').registerAction('From Decorator', {
    scope: ActionSchemaScope.Single,
    dependencies: ['id', 'title'],

    form: [
      {
        label: 'field9',
        description: 'coucoucou ocucouco ',
        type: ActionFieldType.String,
        defaultValue: 'mystring',
      },
      // {
      //   type: ActionFieldType.Collection,
      //   label: 'field2',
      //   collectionName: 'persons',
      // },
      // { label: 'field1', type: ActionFieldType.Boolean },
      // { label: 'field3', type: ActionFieldType.Date },
      // { label: 'field4', type: ActionFieldType.Dateonly },
      // { label: 'field5', type: ActionFieldType.Enum, enumValues: ['1', '2'] },
      // { label: 'field6', type: ActionFieldType.File },
      // { label: 'field7', type: ActionFieldType.Json },
      // { label: 'field8', type: ActionFieldType.Number },
      // { label: 'field10', type: ActionFieldType.EnumList, enumValues: ['1', '2'] },
      {
        label: 'field11',
        type: ActionFieldType.FileList,
        // if: context => !context.formValues.field10,
      },
      // { label: 'field12', type: ActionFieldType.NumberList },
      // { label: 'field13', type: ActionFieldType.StringList },
    ],

    execute: async (context, responseBuilder) => {
      const record = await context.getRecord();
      console.log(context.formValues);
      responseBuilder.success(`it worked on "${record.title}"`);
    },
  });

  return decorator;
};

export default prepareDataSource;
