import { DataSource } from '@forestadmin/datasource-toolkit';

import { ForestAdminHttpDriverServices as Services } from '../services';
import { AgentOptionsWithDefaults as Options } from '../types';
import CollectionApiChartRoute from './access/api-chart-collection';
import DataSourceApiChartRoute from './access/api-chart-datasource';
import Chart from './access/chart';
import Count from './access/count';
import CountRelated from './access/count-related';
import Csv from './access/csv';
import CsvRelated from './access/csv-related';
import Get from './access/get';
import List from './access/list';
import ListRelated from './access/list-related';
import BaseRoute from './base-route';
import ActionRoute from './modification/action';
import AssociateRelated from './modification/associate-related';
import Create from './modification/create';
import Delete from './modification/delete';
import DissociateDeleteRelated from './modification/dissociate-delete-related';
import Update from './modification/update';
import UpdateField from './modification/update-field';
import UpdateRelation from './modification/update-relation';
import Authentication from './security/authentication';
import IpWhitelist from './security/ip-whitelist';
import ScopeInvalidation from './security/scope-invalidation';
import ErrorHandling from './system/error-handling';
import HealthCheck from './system/healthcheck';
import Logger from './system/logger';

export const ROOT_ROUTES_CTOR = [
  Authentication,
  ErrorHandling,
  HealthCheck,
  IpWhitelist,
  Logger,
  ScopeInvalidation,
];
export const COLLECTION_ROUTES_CTOR = [
  Chart,
  Count,
  Create,
  Csv,
  Delete,
  Get,
  List,
  Update,
  UpdateField,
];
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

function getApiChartRoutes(
  dataSource: DataSource,
  options: Options,
  services: Services,
): BaseRoute[] {
  return [
    ...dataSource.schema.charts.map(
      chartName => new DataSourceApiChartRoute(services, options, dataSource, chartName),
    ),
    ...dataSource.collections.flatMap(collection =>
      collection.schema.charts.map(
        chartName =>
          new CollectionApiChartRoute(services, options, dataSource, collection.name, chartName),
      ),
    ),
  ];
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
    ...getApiChartRoutes(dataSource, options, services),
    ...getRelatedRoutes(dataSource, options, services),
    ...getActionRoutes(dataSource, options, services),
  ];

  // Ensure routes and middlewares are loaded in the right order.
  return routes.sort((a, b) => a.type - b.type);
}
