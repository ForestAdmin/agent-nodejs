import { DataSource } from '@forestadmin/datasource-toolkit';

import { AgentOptionsWithDefaults as Options } from '../types';
import { ForestAdminHttpDriverServices as Services } from '../services';
import ActionRoute from './modification/action';
import AssociateRelated from './modification/associate-related';
import Authentication from './security/authentication';
import BaseRoute from './base-route';
import Chart from './access/chart';
import Count from './access/count';
import CountRelated from './access/count-related';
import Create from './modification/create';
import Csv from './access/csv';
import CsvRelated from './access/csv-related';
import Delete from './modification/delete';
import DissociateDeleteRelated from './modification/dissociate-delete-related';
import ErrorHandling from './system/error-handling';
import Get from './access/get';
import HealthCheck from './system/healthcheck';
import IpWhitelist from './security/ip-whitelist';
import List from './access/list';
import ListRelated from './access/list-related';
import Logger from './system/logger';
import ScopeInvalidation from './security/scope-invalidation';
import Update from './modification/update';
import UpdateRelation from './modification/update-relation';

export const ROOT_ROUTES_CTOR = [
  Authentication,
  ErrorHandling,
  HealthCheck,
  IpWhitelist,
  Logger,
  ScopeInvalidation,
];
export const COLLECTION_ROUTES_CTOR = [Chart, Count, Create, Csv, Delete, Get, List, Update];
export const RELATED_ROUTES_CTOR = [
  AssociateRelated,
  CountRelated,
  CsvRelated,
  DissociateDeleteRelated,
  ListRelated,
];
export const RELATED_RELATION_ROUTES_CTOR = [UpdateRelation];

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

  const routesToBuild = [
    { list: RELATED_ROUTES_CTOR, relations: ['ManyToMany', 'OneToMany'] },
    { list: RELATED_RELATION_ROUTES_CTOR, relations: ['OneToOne', 'ManyToOne'] },
  ];
  dataSource.collections.forEach(collection => {
    routesToBuild.forEach(route => {
      const fields = Object.entries(collection.schema.fields);
      const relationFields = fields.filter(([, schema]) => route.relations.includes(schema.type));
      relationFields.forEach(([relationName]) => {
        routes.push(
          ...route.list.map(
            Route => new Route(services, options, dataSource, collection.name, relationName),
          ),
        );
      });
    });
  });

  return routes;
}

function getActionRoutes(
  dataSource: DataSource,
  options: Options,
  services: Services,
): BaseRoute[] {
  const routes: BaseRoute[] = [];

  for (const collection of dataSource.collections)
    for (const actionName of Object.keys(collection.schema.actions))
      routes.push(new ActionRoute(services, options, dataSource, collection.name, actionName));

  return routes;
}

export default function makeRoutes(
  dataSource: DataSource,
  options: Options,
  services: Services,
): BaseRoute[] {
  const routes = [
    ...getRootRoutes(options, services),
    ...getCrudRoutes(dataSource, options, services),
    ...getRelatedRoutes(dataSource, options, services),
    ...getActionRoutes(dataSource, options, services),
  ];

  // Ensure routes and middlewares are loaded in the right order.
  return routes.sort((a, b) => a.type - b.type);
}
