import { DataSource, FieldTypes } from '@forestadmin/datasource-toolkit';

import { ForestAdminHttpDriverOptionsWithDefaults as Options } from '../types';
import { ForestAdminHttpDriverServices as Services } from '../services';
import Authentication from './security/authentication';
import BaseRoute from './base-route';
import Count from './access/count';
import CountRelatedRoute from './access/count-related';
import Create from './modification/create';
import Delete from './modification/delete';
import ErrorHandling from './system/error-handling';
import Get from './access/get';
import HealthCheck from './system/healthcheck';
import IpWhitelist from './security/ip-whitelist';
import List from './access/list';
import ListRelatedRoute from './access/list-related';
import Logger from './system/logger';
import ScopeInvalidation from './security/scope-invalidation';
import Update from './modification/update';

export const RootRoutesCtor = [
  Authentication,
  ErrorHandling,
  HealthCheck,
  IpWhitelist,
  Logger,
  ScopeInvalidation,
];

export const CollectionRoutesCtor = [Count, Create, Delete, Get, List, Update];
export const RelatedRoutesCtor = [CountRelatedRoute, ListRelatedRoute];

function getRootRoutes(options: Options, services: Services): BaseRoute[] {
  return RootRoutesCtor.map(Route => new Route(services, options));
}

function getCrudRoutes(dataSource: DataSource, options: Options, services: Services): BaseRoute[] {
  const routes: BaseRoute[] = [];

  dataSource.collections.forEach(collection => {
    routes.push(
      ...CollectionRoutesCtor.map(
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
        ...RelatedRoutesCtor.map(
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
  return [
    ...getRootRoutes(options, services),
    ...dataSources.map(dataSource => getCrudRoutes(dataSource, options, services)).flat(),
    ...dataSources.map(dataSource => getRelatedRoutes(dataSource, options, services)).flat(),
  ].sort((a, b) => a.type - b.type);
}
