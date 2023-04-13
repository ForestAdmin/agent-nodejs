import type {
  CollectionCustomizer,
  DataSourceCustomizer,
} from '@forestadmin/datasource-customizer';

export default (
  dataSourceCustomizer: DataSourceCustomizer,
  collectionCustomizer: CollectionCustomizer,
  options,
) => {
  const liveDemoUserEmail = options.userEmail || 'erlich.bachman@forestadmin.com';
  const liveDemoErrorMessage = options.errorMessage || 'You can only read data on this live demo.';

  function blockCallIfLiveDemoUser(context) {
    if (liveDemoUserEmail === context.caller.email) {
      context.throwForbiddenError(liveDemoErrorMessage);
    }
  }

  dataSourceCustomizer.collections.forEach(collection => {
    collection.addHook('Before', 'Update', blockCallIfLiveDemoUser);
    collection.addHook('Before', 'Delete', blockCallIfLiveDemoUser);
    collection.addHook('Before', 'Create', blockCallIfLiveDemoUser);
  });
};
