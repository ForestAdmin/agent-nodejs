import { DataSource } from "@forestadmin/datasource-toolkit";
import cors from "@koa/cors";
import Router from "@koa/router";
import { IncomingMessage, ServerResponse } from "http";
import Koa from "koa";
import bodyParser from "koa-bodyparser";
import { BaseRoute } from "./routes/base-routes";
import HealthCheck from "./routes/healthcheck";

/** Logger */
export type Logger = (level: "info" | "warn" | "error", message: string) => void;

/** Options to configure behavior of an agent's frontend */
export interface FrontendOptions {
  logger?: Logger;
}

/** Native NodeJS callback that can be passed to an HTTP Server */
export type HttpCallback = (req: IncomingMessage, res: ServerResponse) => void;

/** Frontend status */
export type FrontendStatus = "waiting" | "running" | "done";

/**
 * Services container
 * This is empty for now, but should grow as we implement all features
 * (at least to contain roles and scopes).
 */
export type FrontendServices = Record<string, never>;

/**
 * List of routes constructors. One instance = One exposed route.
 */
const ROOT_CTOR = [HealthCheck];

export default class Frontend {
  public readonly dataSource: DataSource;
  public readonly options: FrontendOptions;
  public readonly routes: BaseRoute[] = [];
  public readonly services: Record<string, never>;

  private readonly _app = new Koa();
  private _status: FrontendStatus = "waiting";

  /**
   * Native request handler.
   * Can be used directly with express.js or the NodeJS http module.
   * Other frameworks will require adapters.
   */
  get handler(): HttpCallback {
    return this._app.callback();
  }

  get status(): FrontendStatus {
    return this._status;
  }

  constructor(dataSource: DataSource, options: FrontendOptions) {
    this.dataSource = dataSource;
    this.options = options;
    this.services = {};
  }

  /**
   * Builds the underlying application from the datasource.
   * This method can only be called once.
   */
  async start(): Promise<void> {
    if (this._status !== "waiting") {
      throw new Error("This application was already started.");
    }

    const router = new Router();
    this.buildRoutes();
    this.routes.forEach(f => f.setupPublicRoutes(router));
    this.routes.forEach(f => f.setupAuthentication(router));
    this.routes.forEach(f => f.setupPrivateRoutes(router));

    this._app.use(cors({ credentials: true, maxAge: 24 * 3600 }));
    this._app.use(bodyParser());
    this._app.use(router.routes());

    this._status = "running";
    await Promise.all(this.routes.map(f => f.bootstrap()));
  }

  /**
   * Tear down all routes (close open sockets, ...)
   */
  async stop(): Promise<void> {
    if (this._status !== "running") {
      throw new Error("Frontend app is already started.");
    }

    this._status = "done";
    await Promise.all(this.routes.map(f => f.tearDown()));
  }

  private buildRoutes(): void {
    const { dataSource, options } = this;

    this.routes.push(...ROOT_CTOR.map(c => new c(this.services, dataSource, options)));
  }
}
