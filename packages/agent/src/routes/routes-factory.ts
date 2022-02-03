import { DataSource, FieldTypes } from '@forestadmin/datasource-toolkit';
import { ForestAdminHttpDriverServices } from '../services';
import { ForestAdminHttpDriverOptions } from '../types';
import BaseRoute from './base-route';

export type RouteCtor = {
  new (
    services: ForestAdminHttpDriverServices,
    options: ForestAdminHttpDriverOptions,
    dataSource?: DataSource,
    name?: string,
    relationName?: string,
  ): BaseRoute;
};

export interface RoutesOptions {
  dataSources: DataSource[];
  options: ForestAdminHttpDriverOptions;
  services: ForestAdminHttpDriverServices;
  rootRoutes: RouteCtor[];
  collectionRoutes: RouteCtor[];
  relatedRoutes: RouteCtor[];
}

export default class RoutesFactory {
  static makeRoutes(routeOptions: RoutesOptions): BaseRoute[] {
    const { dataSources, options, services, rootRoutes, collectionRoutes, relatedRoutes } =
      routeOptions;

    return [
      ...RoutesFactory.buildRootRoutes(options, rootRoutes, services),
      ...dataSources
        .map(dataSource =>
          RoutesFactory.buildCollectionRoutes(dataSource, options, collectionRoutes, services),
        )
        .flat(),
      ...dataSources
        .map(dataSource =>
          RoutesFactory.buildRelatedRoutes(dataSource, options, relatedRoutes, services),
        )
        .flat(),
    ];
  }

  private static buildRootRoutes(
    options: ForestAdminHttpDriverOptions,
    routes: RouteCtor[],
    services: ForestAdminHttpDriverServices,
  ): BaseRoute[] {
    return routes.map(Route => new Route(services, options));
  }

  private static buildCollectionRoutes(
    dataSource: DataSource,
    options: ForestAdminHttpDriverOptions,
    routes: RouteCtor[],
    services: ForestAdminHttpDriverServices,
  ): BaseRoute[] {
    const routesBuilt: BaseRoute[] = [];

    dataSource.collections.forEach(collection => {
      routesBuilt.push(
        ...routes.map(Route => new Route(services, options, dataSource, collection.name)),
      );
    });

    return routesBuilt;
  }

  private static buildRelatedRoutes(
    dataSource: DataSource,
    options: ForestAdminHttpDriverOptions,
    routes: RouteCtor[],
    services: ForestAdminHttpDriverServices,
  ): BaseRoute[] {
    const routesBuilt: BaseRoute[] = [];
    dataSource.collections.forEach(collection => {
      const relationNames = Object.entries(collection.schema.fields).filter(
        ([, schema]) =>
          schema.type === FieldTypes.ManyToMany || schema.type === FieldTypes.OneToMany,
      );

      relationNames.forEach(([relationName]) => {
        routesBuilt.push(
          ...routes.map(
            Route => new Route(services, options, dataSource, collection.name, relationName),
          ),
        );
      });
    });

    return routesBuilt;
  }
}
