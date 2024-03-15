import { AgentOptions, createAgent } from '@forestadmin/agent';
import mongoose, { Schema, createConnection, set } from 'mongoose';

import Introspector from '../../src/introspection/introspector';

let connection;
let Model;

const setup = async () => {
  Model = connection.model('Model', new Schema({ someKey: Schema.Types.Mixed }));
};

const openConnection = async (dbName: string) => {
  //  const { Schema } = mongoose;

  //  mongoose.set('bufferCommands', false);
  return createConnection('mongodb://forest:secret@localhost:27017', { dbName });
  //  await connection.dropDatabase();

  /*   const TypeList = await connection.model(
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
  ); */

  /*   const type = new TypeList({
    name: 'toto',
    binary: Buffer.from('buff', 'utf-8'),
    living: true,
    updated: Date.now(),
    age: 33,
    mixed: Date.now(),
    decimal: 6.28,
    array: [],
    ofString: ['Hello', 'Bye'],
    ofNumber: [123, 42, 3.14],
    ofDates: [new Date(), new Date(1, 1, 2000)],
    ofBuffer: [Buffer.from('buffer22', 'utf-8'), Buffer.from('buffer11', 'utf-8')],
    ofBoolean: [true, true, false, false, true, false, false],
    ofMixed: [new Date(), true, 'mixed bag', 123, { hello: 'world' }],
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
  }); */

  //  return connection;
};

describe('Introspector > Integration', () => {
  beforeAll(async () => {
    connection = await openConnection('test1');
    setup();
  });
  afterEach(async () => {
    await connection.dropDatabase();
  });
  afterAll(async () => {
    await connection.close();
  });

  describe('nullable', () => {
    describe('if 1 sample is null', () => {
      test('it should assume it is nullable', async () => {
        await Promise.all(
          ['aaa', 'bbb', 'ccc', null].map(val => new Model({ someKey: val }).save()),
        );
        expect(
          (await Introspector.introspect(connection.db)).models.find(
            model => model.name === 'models',
          )?.analysis.object,
        ).toMatchObject({
          someKey: {
            nullable: true,
            referenceTo: undefined,
            type: 'string',
          },
        });
      });
    });

    describe('if no samples are null', () => {
      test('it should assume it is not nullable', async () => {
        await Promise.all(
          ['aaa', 'bbb', 'ccc', 'ddd'].map(val => new Model({ someKey: val }).save()),
        );
        const introspection = await Introspector.introspect(connection.db);
        expect(introspection.models[0].analysis.object).toMatchObject({
          someKey: {
            nullable: false,
            referenceTo: undefined,
            type: 'string',
          },
        });
      });
    });
  });

  describe('reference', () => {});

  test('should work', async () => {
    const dbName = 'hella';
    const connection = await openConnection(dbName);
    const introspection = await Introspector.introspect(connection.db);
    connection.destroy();

    expect(introspection.models[0].analysis).toEqual({
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
        age: {
          type: 'number',
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
        binary: {
          type: 'Binary',
          nullable: false,
        },
        decimal: {
          type: 'Decimal128',
          nullable: false,
        },
        living: {
          type: 'boolean',
          nullable: false,
        },
        map: {
          type: 'object',
          nullable: false,
          object: {
            key1: {
              type: 'number',
              nullable: false,
            },
            key2: {
              type: 'number',
              nullable: false,
            },
          },
        },
        mapOfString: {
          type: 'object',
          nullable: false,
          object: {
            key1: {
              type: 'string',
              nullable: false,
            },
            key2: {
              type: 'string',
              nullable: false,
            },
          },
        },
        mixed: {
          type: 'number',
          nullable: false,
        },
        name: {
          type: 'string',
          nullable: false,
        },
        nested: {
          type: 'object',
          nullable: false,
          object: {
            stuff: {
              type: 'string',
              nullable: false,
            },
          },
        },
        ofArrayOfNumbers: {
          type: 'array',
          nullable: false,
          arrayElement: {
            type: 'array',
            nullable: false,
            arrayElement: {
              type: 'number',
              nullable: false,
            },
          },
        },
        ofArrays: {
          type: 'array',
          nullable: false,
          arrayElement: {
            type: 'array',
            nullable: false,
            arrayElement: {
              type: 'string',
              nullable: false,
            },
          },
        },
        ofBoolean: {
          type: 'array',
          nullable: false,
          arrayElement: {
            type: 'boolean',
            nullable: false,
          },
        },
        ofBuffer: {
          type: 'array',
          nullable: false,
          arrayElement: {
            type: 'Binary',
            nullable: false,
          },
        },
        ofDates: {
          type: 'array',
          nullable: false,
          arrayElement: {
            type: 'Date',
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
            type: 'number',
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
            type: 'string',
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
