import { DataSourceSchema } from '@forestadmin/datasource-toolkit';

export const dataSourceWithDummyCollectionSchema: DataSourceSchema = {
  name: 'Live DataSource with Dummy Collection',
  collections: {
    dummy: {
      actions: {},
      fields: {},
      searchable: true,
      segments: [],
    },
  },
};

export const emptyDataSourceSchema: DataSourceSchema = {
  name: 'Empty Live DataSource',
  collections: {},
};
