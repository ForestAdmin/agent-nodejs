import { DummyDataSource } from "@forestadmin/datasource-dummy";
import { Context } from "koa";
import HealthCheck from "../../src/routes/healthcheck";
import RouterMock, { routerMockGet } from "../__mocks__/router";

describe("Healthcheck", () => {
  const services = {};
  const dataSource = new DummyDataSource();
  const options = {};
  const router = new RouterMock();

  beforeEach(() => {
    routerMockGet.mockClear();
  });

  test("should register '/' and '/healthcheck' public routes", () => {
    const healthCheck = new HealthCheck(services, dataSource, options);
    healthCheck.setupPublicRoutes(router);

    expect(routerMockGet).toHaveBeenCalledWith("/", expect.any(Function));
    expect(routerMockGet).toHaveBeenCalledWith("/healthcheck", expect.any(Function));
  });

  test("return a 200 response", async () => {
    const healthCheck = new HealthCheck(services, dataSource, options);
    const context = { response: {} } as Context;
    await healthCheck.handleRequest(context);

    expect(context.response.status).toEqual(200);
  });
});
