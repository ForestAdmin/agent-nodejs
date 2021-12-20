import { DummyDataSource } from "@forestadmin/datasource-dummy";
import { BaseRoute } from "../../src/routes/base-routes";
import Router, {
  routerMockDelete,
  routerMockGet,
  routerMockPost,
  routerMockPut,
  routerMockUse,
} from "../__mocks__/router";

describe("Base routes", () => {
  const services = {};
  const dataSource = new DummyDataSource();
  const options = {};
  const router = new Router();

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
