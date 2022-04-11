import { LiveDataSourceOptions } from '@forestadmin/datasource-live';

const dataSourceSchema: LiveDataSourceOptions['dataSourceSchema'] = {
  collections: {
    address: {
      actions: {},
      fields: {
        id: { columnType: 'Number', isPrimaryKey: true, type: 'Column' },
        zipCode: { columnType: 'String', type: 'Column' },
        address: { columnType: 'String', type: 'Column' },
        storeId: { columnType: 'Number', type: 'Column' },
      },
      searchable: false,
      segments: [] as string[],
    },
  },
};

export default dataSourceSchema;
