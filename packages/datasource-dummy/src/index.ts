import { Collection } from "@forestadmin/datasource-toolkit";
import { DummyDataSource } from "./datasource";

export function getCollections(): Collection[] {
  return new DummyDataSource().collections;
}
