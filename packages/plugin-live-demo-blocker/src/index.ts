import type { DataSourceCustomizer } from '@forestadmin/datasource-customizer';

export default (dataSourceCustomizer: DataSourceCustomizer) => {
  dataSourceCustomizer.collections.forEach(collection => {
    collection.addHook('Before', 'Update', context => {
      context.throwForbiddenError('You can only read data on this live demo');
    });
    collection.addHook('Before', 'Delete', context => {
      context.throwForbiddenError('You can only read data on this live demo');
    });
    collection.addHook('Before', 'Create', context => {
      context.throwForbiddenError('You can only read data on this live demo');
    });
  });
};
