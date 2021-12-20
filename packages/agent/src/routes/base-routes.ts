import { Collection, DataSource } from "@forestadmin/datasource-toolkit";
import Router from "@koa/router";
import { FrontendOptions, FrontendServices } from "../frontend";

export abstract class BaseRoute {
  protected readonly services: FrontendServices;
  protected readonly dataSource: DataSource;
  protected readonly options: FrontendOptions;

  constructor(services: FrontendServices, dataSource: DataSource, options: FrontendOptions) {
    this.services = services;
    this.dataSource = dataSource;
    this.options = options;
  }

  async bootstrap(): Promise<void> {
    // Do nothing by default
  }

  async tearDown(): Promise<void> {
    // Do nothing by default
  }

  setupPublicRoutes(router: Router): void {
    void router;
  }

  setupAuthentication(router: Router): void {
    void router;
  }

  setupPrivateRoutes(router: Router): void {
    void router;
  }
}

export abstract class CollectionRoute extends BaseRoute {
  private readonly collectionName: string;

  protected get collection(): Collection {
    return this.dataSource.getCollection(this.collectionName);
  }

  constructor(
    services: FrontendServices,
    dataSource: DataSource,
    options: FrontendOptions,
    collectionName: string
  ) {
    super(services, dataSource, options);
    this.collectionName = collectionName;
  }
}

export abstract class RelationRoute extends CollectionRoute {
  protected readonly relation: string;

  constructor(
    services: FrontendServices,
    dataSource: DataSource,
    options: FrontendOptions,
    collectionName: string,
    relation: string
  ) {
    super(services, dataSource, options, collectionName);
    this.relation = relation;
  }
}
