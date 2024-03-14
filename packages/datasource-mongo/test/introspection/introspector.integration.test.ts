import { AgentOptions, createAgent } from '@forestadmin/agent';
import { createMongoDataSource } from '@forestadmin/datasource-mongo';
import mongoose, { createConnection } from 'mongoose';

import Introspector from '../../src/introspection/introspector';

const createSchema = async (dbName: string) => {
  const { Schema } = mongoose;
  //  mongoose.set('bufferCommands', false);
  const connection = await createConnection('mongodb://forest:secret@localhost:27017', { dbName });
  await connection.dropDatabase();

  const TypeList = await connection.model(
    'typeList',
    new Schema({
      name: String,
      binary: { type: Buffer, required: false },
      living: Boolean,
      updated: { type: Date, default: Date.now },
      age: { type: Number, min: 18, max: 65 },
      mixed: Schema.Types.Mixed,
      _someId: Schema.Types.ObjectId,
      decimal: Schema.Types.Decimal128,
      array: [],
      ofString: [String],
      ofNumber: [Number],
      ofDates: [Date],
      ofBuffer: [Buffer],
      ofBoolean: [Boolean],
      ofMixed: [Schema.Types.Mixed],
      ofObjectId: [Schema.Types.ObjectId],
      ofArrays: [[]],
      ofArrayOfNumbers: [[Number]],
      nested: {
        stuff: { type: String, lowercase: true, trim: true },
      },
      map: Map,
      mapOfString: {
        type: Map,
        of: String,
      },
    }),
  );

  const Companies = await connection.model(
    'companies',
    new Schema({
      name: String,
      address: {
        street: String,
        city: String,
        zipCode: String,
        number: String,
      },
    }),
  );

  const type = new TypeList({
    name: 'toto',
    binary: Buffer.from('buff', 'utf-8'),
    living: true,
    updated: Date.now,
    age: 33,
    mixed: Date.now,
    _someId: 123,
    decimal: 6.28,
    array: [],
    ofString: ['Hello', 'Bye'],
    ofNumber: [123, 42, 3.14],
    ofDates: [new Date(), new Date(1, 1, 2000)],
    ofBuffer: [Buffer.from('buffer22', 'utf-8'), Buffer.from('buffer11', 'utf-8')],
    ofBoolean: [true, true, false, false, true, false, false],
    ofMixed: [new Date(), true, 'mixed bag', 123, { hello: 'world' }],
    ofObjectId: [123, 456],
    ofArrays: [
      ['hello', 'world'],
      ['bye', 'world'],
    ],
    ofArrayOfNumbers: [
      [1, 2],
      [3, 4],
      [5, 6],
    ],
    nested: {
      stuff: 'nested stuff content',
    },
    map: new Map([
      ['key1', 123],
      ['key2', 12],
    ]),
    mapOfString: new Map([
      ['key1', 'string_val1'],
      ['key2', 'string_val2'],
    ]),
  });
  await type.save();

  return connection;
};

describe('Introspector > Integration', () => {
  test('should work', async () => {
    const dbName = 'hella';
    const connection = await createSchema(dbName);
    const introspection = await Introspector.introspect(connection.db);
    console.log(
      `🚀  \x1b[45m%s\x1b[0m`,
      ` - test - introspection:`,
      JSON.stringify(introspection.models[0].analysis, null, 2),
    );
    connection.destroy();

    expect(introspection.models[0].analysis).toMatchObject({
      type: 'object',
      nullable: false,
      object: {
        __v: {
          type: 'number',
          nullable: false,
        },
        _id: {
          type: 'ObjectId',
          nullable: false,
        },
        binary: {
          type: 'Binary',
          nullable: false,
        },
        name: {
          type: 'string',
          nullable: false,
        },
        array: {
          type: 'array',
          nullable: false,
          arrayElement: {
            type: 'Mixed',
            nullable: false,
          },
        },
        ofArrayOfNumbers: {
          type: 'array',
          nullable: false,
          arrayElement: {
            type: 'Mixed',
            nullable: false,
          },
        },
        ofArrays: {
          type: 'array',
          nullable: false,
          arrayElement: {
            type: 'Mixed',
            nullable: false,
          },
        },
        ofBoolean: {
          type: 'array',
          nullable: false,
          arrayElement: {
            type: 'Mixed',
            nullable: false,
          },
        },
        ofBuffer: {
          type: 'array',
          nullable: false,
          arrayElement: {
            type: 'Mixed',
            nullable: false,
          },
        },
        ofDates: {
          type: 'array',
          nullable: false,
          arrayElement: {
            type: 'Mixed',
            nullable: false,
          },
        },
        ofMixed: {
          type: 'array',
          nullable: false,
          arrayElement: {
            type: 'Mixed',
            nullable: false,
          },
        },
        ofNumber: {
          type: 'array',
          nullable: false,
          arrayElement: {
            type: 'Mixed',
            nullable: false,
          },
        },
        ofObjectId: {
          type: 'array',
          nullable: false,
          arrayElement: {
            type: 'Mixed',
            nullable: false,
          },
        },
        ofString: {
          type: 'array',
          nullable: false,
          arrayElement: {
            type: 'Mixed',
            nullable: false,
          },
        },
        updated: {
          type: 'Date',
          nullable: false,
        },
      },
    });
  });
});
