import collectionSchema from './schema/collection-schema';
import columnSchema from './schema/column-schema';
import oneToManySchema from './schema/one-to-many-schema';
import manyToOneSchema from './schema/many-to-one-schema';
import dataSource from './datasource';
import collection from './collection';
import recordData from './record-data';
import serializer from './serializer';
import forestAdminHttpDriverServices from './forest-admin-http-driver-services';
import forestAdminHttpDriverOptions from './forest-admin-http-driver-options';
import router from './router';
import superagent from './superagent';
import openidClient from './openid-client';

export default {
  collectionSchema,
  columnSchema,
  oneToManySchema,
  manyToOneSchema,
  dataSource,
  collection,
  recordData,
  serializer,
  forestAdminHttpDriverServices,
  forestAdminHttpDriverOptions,
  router,
  superagent,
  openidClient,
};
