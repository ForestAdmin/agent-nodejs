import { getCollections } from "../src";
import { DummyDataSource } from "../src/datasource";

describe("getCollections", () => {
  it("should return DummyDataSource collections", () => {
    const dummyDataSource = new DummyDataSource();

    expect(getCollections()).toEqual(dummyDataSource.collections);
  });
});
