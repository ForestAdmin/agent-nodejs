import { DummyDataSource } from "../src/datasource";

describe("DummyDataSource", () => {
  it("should instanciate properly", () => {
    expect(new DummyDataSource()).toBeDefined();
  });
});
