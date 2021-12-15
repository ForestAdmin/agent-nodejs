import { Collection, DataSource } from "@forestadmin/datasource-toolkit";
import { BookCollection } from "./collections/books";

export class DummyDataSource implements DataSource {
  readonly collections = [new BookCollection(this)];

  getCollection(name: string): Collection {
    return name === "book" ? this.collections[0] : null;
  }
}
