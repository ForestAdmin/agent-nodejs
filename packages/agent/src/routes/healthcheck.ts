import Router from "@koa/router";
import { Context } from "koa";
import { BaseRoute } from "./base-routes";

export default class HealthCheck extends BaseRoute {
  override setupPublicRoutes(router: Router): void {
    router.get("/", this.handleRequest.bind(this));
    router.get("/healthcheck", this.handleRequest.bind(this));
  }

  private async handleRequest(ctx: Context) {
    ctx.response.body = {};
    ctx.response.status = 200;
  }
}
