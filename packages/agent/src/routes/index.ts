import { DataSource, FieldTypes } from '@forestadmin/datasource-toolkit';
import { ForestAdminHttpDriverServices as Services } from '../services';
import { ForestAdminHttpDriverOptionsWithDefaults as Options } from '../types';

import Authentication from './security/authentication';
import BaseRoute from './base-route';
import Count from './access/count';
import CountRelatedRoute from './access/count-related';
import Create from './modification/create';
import Delete from './modification/delete';
import Get from './access/get';
import HealthCheck from './healthcheck';
import List from './access/list';
import Update from './modification/update';
import ListRelatedRoute from './access/list-related';

export const RootRoutesCtor = [Authentication, HealthCheck];
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
  ];
}
