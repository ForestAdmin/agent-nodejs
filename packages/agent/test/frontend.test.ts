import { DummyDataSource } from "@forestadmin/datasource-dummy";
import Frontend from "../src/frontend";

describe("Frontend", () => {
  const dataSource = new DummyDataSource();
  const options = {};

  test("should start and stop", async () => {
    const frontend = new Frontend(dataSource, options);
    expect(frontend.status).toStrictEqual("waiting");

    await frontend.start();
    expect(frontend.status).toStrictEqual("running");

    await frontend.stop();
    expect(frontend.status).toStrictEqual("done");
  });

  test("should not allow to start multiple times", async () => {
    const frontend = new Frontend(dataSource, options);
    await frontend.start();
    await expect(frontend.start()).rejects.toEqual(new Error("Frontend cannot be restarted."));
  });

  test("should not allow to stop multiple times", async () => {
    const frontend = new Frontend(dataSource, options);
    await frontend.start();
    await frontend.stop();
    await expect(frontend.stop()).rejects.toEqual(new Error("Frontend is not running."));
  });

  test("should not allow to stop without starting", async () => {
    const frontend = new Frontend(dataSource, options);
    await expect(frontend.stop()).rejects.toEqual(new Error("Frontend is not running."));
  });

  test("should allow access to the request handler before being started", () => {
    // This is a requirement for forestadmin of forestadmin.
    // Otherwise forestadmin-server's in app integration can't be started.
    const frontend = new Frontend(dataSource, options);
    expect(frontend.handler).toBeTruthy();
  });
});
