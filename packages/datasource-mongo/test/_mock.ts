/* eslint-disable no-underscore-dangle */
import { MongoDb } from '../src/introspection/types';

type Doc = Record<string, unknown>;

function createCursor(docs: Doc[]) {
  return {
    [Symbol.asyncIterator]() {
      let index = 0;

      return {
        next: () => {
          const res = Promise.resolve({ value: docs[index], done: !(index < docs.length) });
          index += 1;

          return res;
        },
      };
    },
    map: (cb: (v: Doc) => Doc) => createCursor(docs.map(cb)),
    limit: (end: number) => createCursor(docs.slice(0, end)),
    toArray: () => Promise.resolve(docs),
  };
}

function createCollection(name: string, docs: Doc[]) {
  return {
    collectionName: name,
    find: filter => {
      let filtered = docs;
      if (filter?._id?.$in) filtered = filtered.filter(d => filter?._id?.$in.includes(d._id));

      return createCursor(filtered);
    },
  };
}

export default function createDb(docsPerCollection: Record<string, Doc[]>): MongoDb {
  return {
    collection: (name: string) => createCollection(name, docsPerCollection[name]),
    collections: () =>
      Object.entries(docsPerCollection).map(([name, docs]) => createCollection(name, docs)),
  } as unknown as MongoDb;
}
