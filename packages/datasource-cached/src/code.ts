/* eslint-disable no-await-in-loop */
import { RecordData, RecordUtils } from '@forestadmin/datasource-toolkit';

import { RecordDataWithCollection } from './types';

type AsModels = { [path: string]: AsModels };


function getValue(record: RecordData, path: string) {
  if (!path) 
return record;

  const [prefix, suffix] = path.split(/\.(.*)/);
  const value = getValue(record[prefix], suffix);
  if (!suffix || !Object.keys(record[prefix]).length)
    delete record[prefix];
  

  
  return value;
}

function* extractValuesInPlace(record: RecordData, path: string): Generator<RecordData> {
  if (path) {
    const [prefix, suffix] = path.split(/\.(.*)/);

    if (record[prefix] !== undefined) {
      if (Array.isArray(record[prefix])) {
        for (const r of record[prefix]) yield* extractValuesInPlace(r, suffix);
      } else {
        yield* extractValuesInPlace(record[prefix], suffix);
      }
    }

    // we should check if the record is empty
    if (!suffix) delete record[prefix];
  } else {
    yield record;
  }
}

function nest(asModels: string[]) {
  asModels.sort();

  const entries = {};

  for (let i = 0; i < asModels.length; i += 1) {
    const path = asModels[i];
    let j = i + 1;

    for (; j < asModels.length && asModels[j].startsWith(`${path}.`); j += 1) {
      // count items
    }

    entries[path] = nest(asModels.slice(i + 1, j).map(p => p.substring(path.length + 1)));
    i = j - 1;
  }

  return entries;
}

function* split(
  recordWithCollection: RecordDataWithCollection,
  asModels: AsModels,
): Generator<RecordDataWithCollection> {
  const { record, collection } = recordWithCollection;

  for (const [prefix, subAsModels] of Object.entries(asModels)) {
    for (const subRecord of extractValuesInPlace(record, prefix)) {
      if (Object.keys(subAsModels).length > 0) {
        yield* split({ collection: `${collection}.${prefix}`, record: subRecord }, subAsModels);
      } else {
        yield { collection: `${collection}.${prefix}`, record: subRecord };
      }
    }
  }

  yield { collection, record };
}

function flatten(
  recordWithCollection: RecordDataWithCollection,
  asFields: string[],
  asModels: string[],
): RecordDataWithCollection[] {
  const nestedAsModels = nest(asModels);
  const newRecords = [...split(recordWithCollection, nestedAsModels)];

  for (const { collection, record } of newRecords) {
    const prefix = collection.substring(recordWithCollection.collection.length + 1);
    const fields = asFields
      .filter(f => f.startsWith(prefix))
      .map(f => f.substring(prefix.length + 1));

      for (const field of fields) {
        const value = getFieldValue(record, field.)

      }
    
  }

  return newRecords;
}

const record = { id: 1, name: 'toto', friends: [{ id: 2, name: 'titi', entries: { a: 1 } }] };

// console.log([...extractValuesInPlace(record, 'friends')]);
// console.log(record);

const generator = split({ collection: 'users', record }, { friends: { entries: {} } });

console.log([...generator]);
