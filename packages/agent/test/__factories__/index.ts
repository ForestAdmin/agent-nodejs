import toolkitFactories from '@forestadmin/datasource-toolkit/test/__factories__';
import serializer from './serializer';
import forestAdminHttpDriverServices from './forest-admin-http-driver-services';
import forestAdminHttpDriverOptions from './forest-admin-http-driver-options';
import router from './router';

export default {
  ...toolkitFactories,
  serializer,
  forestAdminHttpDriverServices,
  forestAdminHttpDriverOptions,
  router,
};
