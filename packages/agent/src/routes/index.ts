import { Collection, DataSource, FieldTypes } from '@forestadmin/datasource-toolkit';

import { ForestAdminHttpDriverOptionsWithDefaults as Options } from '../types';
import { ForestAdminHttpDriverServices as Services } from '../services';
import Authentication from './security/authentication';
import BaseRoute from './base-route';
import Chart from './access/chart';
import Count from './access/count';
import CountRelated from './access/count-related';
import Create from './modification/create';
import Delete from './modification/delete';
import DissociateDeleteRelated from './modification/dissociate-delete-related';
import ErrorHandling from './system/error-handling';
import Get from './access/get';
import HealthCheck from './system/healthcheck';
import IpWhitelist from './security/ip-whitelist';
import List from './access/list';
import ListRelatedRoute from './access/list-related';
import Logger from './system/logger';
import ScopeInvalidation from './security/scope-invalidation';
import Update from './modification/update';
import UpdateEmbedded from './modification/update-embedded';

export const ROOT_ROUTES_CTOR = [
  Authentication,
  ErrorHandling,
  HealthCheck,
  IpWhitelist,
  Logger,
  ScopeInvalidation,
];
export const COLLECTION_ROUTES_CTOR = [Chart, Count, Create, Delete, Get, List, Update];
export const RELATED_ROUTES_CTOR = [CountRelated, DissociateDeleteRelated, ListRelatedRoute];
export const EMBEDDED_ROUTES_CTOR = [UpdateEmbedded];

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

  function addRoutes(collection: Collection, routesCtr, supportedRelations: FieldTypes[]): void {
    const relationNames = Object.entries(collection.schema.fields).filter(([, schema]) =>
      supportedRelations.includes(schema.type),
    );
    relationNames.forEach(([relationName]) => {
      routes.push(
        ...routesCtr.map(
          Route => new Route(services, options, dataSource, collection.name, relationName),
        ),
      );
    });
  }

  dataSource.collections.forEach(collection => {
    addRoutes(collection, RELATED_ROUTES_CTOR, [FieldTypes.ManyToMany, FieldTypes.OneToMany]);
    addRoutes(collection, EMBEDDED_ROUTES_CTOR, [FieldTypes.OneToOne, FieldTypes.ManyToOne]);
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
