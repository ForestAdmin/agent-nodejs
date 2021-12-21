import { BaseRoute } from "../../src/routes/base-routes";
import DataSourceMock from "../__mocks__/datasource";
import RouterMock, {
  routerMockDelete,
  routerMockGet,
  routerMockPost,
  routerMockPut,
  routerMockUse,
} from "../__mocks__/koa-router";

describe("Base routes", () => {
  const services = {};
  const dataSource = new DataSourceMock();
  const options = {};
  const router = new RouterMock();

  test("should not register any route", async () => {
    const baseRoute = new (class extends BaseRoute {})(services, dataSource, options);
    await baseRoute.bootstrap();
    baseRoute.setupPublicRoutes(router);
    baseRoute.setupAuthentication(router);
    baseRoute.setupPrivateRoutes(router);

    expect(routerMockGet).not.toHaveBeenCalled();
    expect(routerMockPost).not.toHaveBeenCalled();
    expect(routerMockPut).not.toHaveBeenCalled();
    expect(routerMockDelete).not.toHaveBeenCalled();
    expect(routerMockUse).not.toHaveBeenCalled();
  });
});
