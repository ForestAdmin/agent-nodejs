import Frontend from "../src/frontend";
import { DummyDataSource } from "@forestadmin/datasource-dummy";
import HealthCheck from "../../src/routes/healthcheck";

describe("Healthcheck", () => {
  const services = {};
  const dataSource = new DummyDataSource();
  const options = {};

  it("should register both / and /healthcheck routes", () => {
    const healthCheck = new HealthCheck(services, dataSource, options);
    const router = route.setupPrivateRoutes(router);
  });

  it("");
});
