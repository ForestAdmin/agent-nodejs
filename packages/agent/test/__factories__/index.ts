import toolkitFactories from '@forestadmin/datasource-toolkit/test/__factories__';
import serializer from './serializer';
import forestAdminHttpDriverServices from './forest-admin-http-driver-services';
import forestAdminHttpDriverOptions from './forest-admin-http-driver-options';
import router from './router';
import superagent from './superagent';
import forestHttpApi from './forest-http-api';

export default {
  ...toolkitFactories,
  serializer,
  forestAdminHttpDriverServices,
  forestAdminHttpDriverOptions,
  router,
  superagent,
  forestHttpApi,
};
