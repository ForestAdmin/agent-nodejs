import { DataSource, FieldTypes } from '@forestadmin/datasource-toolkit';

import { ForestAdminHttpDriverOptionsWithDefaults as Options } from '../types';
import { ForestAdminHttpDriverServices as Services } from '../services';
import Authentication from './security/authentication';
import BaseRoute from './base-route';
import Chart from './access/chart';
import Count from './access/count';
import CountRelatedRoute from './access/count-related';
import Create from './modification/create';
import Delete from './modification/delete';
<<<<<<< HEAD
import ErrorHandling from './system/error-handling';
=======
import DissociateDeleteRelatedRoute from './modification/dissociate-delete-related';
>>>>>>> b80283b (feat(route): dissociate route)
import Get from './access/get';
import HealthCheck from './system/healthcheck';
import IpWhitelist from './security/ip-whitelist';
import List from './access/list';
import ListRelatedRoute from './access/list-related';
import Logger from './system/logger';
import ScopeInvalidation from './security/scope-invalidation';
import Update from './modification/update';

<<<<<<< HEAD
export const RootRoutesCtor = [
  Authentication,
  ErrorHandling,
  HealthCheck,
  IpWhitelist,
  Logger,
  ScopeInvalidation,
];
export const CollectionRoutesCtor = [Chart, Count, Create, Delete, Get, List, Update];
export const RelatedRoutesCtor = [CountRelatedRoute, ListRelatedRoute];
=======
export const ROOT_ROUTES_CTOR = [Authentication, HealthCheck, ScopeInvalidation];
export const COLLECTION_ROUTES_CTOR = [Count, Create, Delete, Get, List, Update];
export const RELATED_ROUTES_CTOR = [
  CountRelatedRoute,
  ListRelatedRoute,
  DissociateDeleteRelatedRoute,
];
>>>>>>> b80283b (feat(route): dissociate route)

function getRootRoutes(options: Options, services: Services): BaseRoute[] {
  return ROOT_ROUTES_CTOR.map(Route => new Route(services, options));
}

function getCrudRoutes(dataSource: DataSource, options: Options, services: Services): BaseRoute[] {
  const routes: BaseRoute[] = [];

  dataSource.collections.forEach(collection => {
    routes.push(
      ...COLLECTION_ROUTES_CTOR.map(
        Route => new Route(services, options, dataSource, collection.name),
      ),
    );
  });

  return routes;
}

function getRelatedRoutes(
  dataSource: DataSource,
  options: Options,
  services: Services,
): BaseRoute[] {
  const routes: BaseRoute[] = [];

  dataSource.collections.forEach(collection => {
    const relationNames = Object.entries(collection.schema.fields).filter(
      ([, schema]) => schema.type === FieldTypes.ManyToMany || schema.type === FieldTypes.OneToMany,
    );

    relationNames.forEach(([relationName]) => {
      routes.push(
        ...RELATED_ROUTES_CTOR.map(
          Route => new Route(services, options, dataSource, collection.name, relationName),
        ),
      );
    });
  });

  return routes;
}

export default function makeRoutes(
  dataSources: DataSource[],
  options: Options,
  services: Services,
): BaseRoute[] {
  const routes = [
    ...getRootRoutes(options, services),
    ...dataSources.map(dataSource => getCrudRoutes(dataSource, options, services)).flat(),
    ...dataSources.map(dataSource => getRelatedRoutes(dataSource, options, services)).flat(),
  ];

  // Ensure routes and middlewares are loaded in the right order.
  return routes.sort((a, b) => a.type - b.type);
}
