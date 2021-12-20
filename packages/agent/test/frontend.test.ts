import Frontend from "../src/frontend";
import { DummyDataSource } from "@forestadmin/datasource-dummy";

describe("Frontend", () => {
  it("should start and stop", async () => {
    const dataSource = new DummyDataSource();
    const frontend = new Frontend(dataSource, {});
    expect(frontend.status).toStrictEqual("waiting");

    await frontend.start();
    expect(frontend.status).toStrictEqual("running");

    await frontend.stop();
    expect(frontend.status).toStrictEqual("done");
  });

  it("should allow access to the request handler before being started", () => {
    // This is a requirement for forestadmin of forestadmin.
    // Otherwise forestadmin-server's in app integration can't be started.
    const dataSource = new DummyDataSource();
    const frontend = new Frontend(dataSource, {});
    expect(frontend.handler).toBeTruthy();
  });
});
