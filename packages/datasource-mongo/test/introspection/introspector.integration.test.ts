import type { Connection } from 'mongoose';

import crypto from 'crypto';
import { Schema, Types, createConnection } from 'mongoose';

import Introspector from '../../src/introspection/introspector';

let connection: Connection;

const newModel = (schemaDefinition: Parameters<Connection['model']>[1], name = 'SomeModel') => {
  try {
    connection.deleteModel(name);
  } catch (e) {
    /* empty */
  }

  return connection.model(name, schemaDefinition);
};

describe('Introspector > Integration', () => {
  beforeAll(async () => {
    connection = await createConnection('mongodb://forest:secret@localhost:27017', {
      dbName: 'test1',
    });
  });
  afterEach(async () => {
    await connection.dropDatabase();
  });
  afterAll(async () => {
    await connection.close();
  });

  describe('Introspection', () => {
    describe('meta', () => {
      test('it should provide metadata about the introspection (source and version)', async () => {
        const AnyModel = newModel(new Schema({ name: Schema.Types.Mixed }));
        await new AnyModel({ name: 'Hello' }).save();
        expect(await Introspector.introspect(connection.db)).toMatchObject({
          models: expect.any(Array),
          source: Introspector.SOURCE,
          version: Introspector.FORMAT_VERSION,
        });
      });
    });

    describe('types', () => {
      describe('with primitive types', () => {
        test('it should map the types found to the correct Forest type', async () => {
          const ManyTypesModel = newModel(
            new Schema({
              typeString: Schema.Types.Mixed,
              typeBinary: Schema.Types.Mixed,
              typeBoolean: Schema.Types.Mixed,
              typeDate: Schema.Types.Mixed,
              typeNumber: Schema.Types.Mixed,
              typeDecimal: Schema.Types.Mixed,
            }),
          );
          await new ManyTypesModel({
            typeString: 'Hello',
            typeBinary: Buffer.from('hello', 'utf-8'),
            typeBoolean: true,
            typeDate: Date.now(),
            typeNumber: 42,
            typeDecimal: 3.14,
          }).save();

          const introspection = await Introspector.introspect(connection.db);
          expect(introspection.models[0].analysis.object).toMatchObject({
            __v: { type: 'number' },
            _id: { type: 'ObjectId' },
            typeBinary: { type: 'Binary' },
            typeBoolean: { type: 'boolean' },
            typeDate: { type: 'number' },
            typeDecimal: { type: 'number' },
            typeNumber: { type: 'number' },
            typeString: { type: 'string' },
          });
        });
      });

      describe('with mixed primitive types', () => {
        test('it should map the types found to the correct Forest type', async () => {
          const ManyTypesModel = newModel(
            new Schema({
              typeString: Schema.Types.Mixed,
              typeBinary: Schema.Types.Mixed,
              typeBoolean: Schema.Types.Mixed,
              typeDate: Schema.Types.Mixed,
              typeNumber: Schema.Types.Mixed,
              typeDecimal: Schema.Types.Mixed,
            }),
          );
          await new ManyTypesModel({
            typeString: 'Hello',
            typeBinary: Buffer.from('hello', 'utf-8'),
            typeBoolean: true,
            typeDate: Date.now(),
            typeNumber: 'Hello',
            typeDecimal: 'Hello',
          }).save();

          await new ManyTypesModel({
            typeString: 3.15,
            typeBinary: 'Hello',
            typeBoolean: Buffer.from('hello', 'utf-8'),
            typeDate: true,
            typeNumber: Date.now(),
            typeDecimal: 42,
          }).save();

          const introspection = await Introspector.introspect(connection.db);
          expect(introspection.models[0].analysis.object).toMatchObject({
            __v: { type: 'number' },
            _id: { type: 'ObjectId' },
            typeBinary: { type: 'Mixed' },
            typeBoolean: { type: 'Mixed' },
            typeDate: { type: 'Mixed' },
            typeDecimal: { type: 'Mixed' },
            typeNumber: { type: 'Mixed' },
            typeString: { type: 'Mixed' },
          });
        });
      });

      describe('with non-mixed array types', () => {
        test('it should map the types found to the correct Forest type', async () => {
          const ManyTypesModel = newModel(
            new Schema({
              typeString: Schema.Types.Mixed,
              typeBinary: Schema.Types.Mixed,
              typeBoolean: Schema.Types.Mixed,
              typeDate: Schema.Types.Mixed,
              typeNumber: Schema.Types.Mixed,
              typeDecimal: Schema.Types.Mixed,
            }),
          );
          await new ManyTypesModel({
            typeString: ['Hello'],
            typeBinary: [Buffer.from('hello', 'utf-8')],
            typeBoolean: [true],
            typeDate: [Date.now()],
            typeNumber: [42],
            typeDecimal: [3.14],
          }).save();

          const introspection = await Introspector.introspect(connection.db);
          expect(introspection.models[0].analysis.object).toMatchObject({
            __v: { type: 'number' },
            _id: { type: 'ObjectId' },
            typeBinary: { type: 'array', arrayElement: { type: 'Binary' } },
            typeBoolean: { type: 'array', arrayElement: { type: 'boolean' } },
            typeDate: { type: 'array', arrayElement: { type: 'number' } },
            typeDecimal: { type: 'array', arrayElement: { type: 'number' } },
            typeNumber: { type: 'array', arrayElement: { type: 'number' } },
            typeString: { type: 'array', arrayElement: { type: 'string' } },
          });
        });
      });

      describe('with mixed array types', () => {
        test('it should map the types found to the correct Forest type', async () => {
          const ManyTypesModel = newModel(
            new Schema({
              typeString: Schema.Types.Mixed,
              typeBinary: Schema.Types.Mixed,
              typeBoolean: Schema.Types.Mixed,
              typeDate: Schema.Types.Mixed,
              typeNumber: Schema.Types.Mixed,
              typeDecimal: Schema.Types.Mixed,
            }),
          );
          await new ManyTypesModel({
            typeString: ['Hello', 123],
            typeBinary: [Buffer.from('hello', 'utf-8'), 'Hello'],
            typeBoolean: [true, 123],
            typeDate: [Date.now(), 'Hello'],
            typeNumber: [42, 'test'],
            typeDecimal: [3.14, 'Hello'],
          }).save();

          const introspection = await Introspector.introspect(connection.db);
          expect(introspection.models[0].analysis.object).toMatchObject({
            __v: { type: 'number' },
            _id: { type: 'ObjectId' },
            typeBinary: { type: 'array', arrayElement: { type: 'Mixed' } },
            typeBoolean: { type: 'array', arrayElement: { type: 'Mixed' } },
            typeDate: { type: 'array', arrayElement: { type: 'Mixed' } },
            typeDecimal: { type: 'array', arrayElement: { type: 'Mixed' } },
            typeNumber: { type: 'array', arrayElement: { type: 'Mixed' } },
            typeString: { type: 'array', arrayElement: { type: 'Mixed' } },
          });
        });
      });
    });

    describe('reference', () => {
      describe('ObjectId reference', () => {
        describe('a simple with a one to many relationship between 2 models', () => {
          test('it should detect the relation', async () => {
            const Product = newModel(new Schema({ name: String }), 'Product');
            const Order = newModel(
              new Schema({ count: Number, product: { type: Types.ObjectId, ref: 'Product' } }),
              'Order',
            );

            const pencil = new Product({ name: 'Pencil' });
            const order2 = new Order({ count: 10, product: pencil });

            await Promise.all([pencil.save(), order2.save()]);

            const introspection = await Introspector.introspect(connection.db);
            expect(introspection.models).toMatchObject([
              {
                name: 'orders',
                analysis: {
                  type: 'object',
                  object: {
                    count: { type: 'number' },
                    product: { type: 'ObjectId', referenceTo: 'products' },
                  },
                },
              },
              {
                name: 'products',
                analysis: {
                  type: 'object',
                  object: { name: { type: 'string' } },
                },
              },
            ]);
          });
        });

        describe('with reflective one to one relationship', () => {
          test('it should detect the relation', async () => {
            const Person = newModel(
              new Schema({ name: String, spouse: { type: Types.ObjectId, ref: 'Person' } }),
              'Person',
            );
            const husband = new Person({ name: 'husband' });
            const wife = new Person({ name: 'wife', spouse: husband });
            husband.set({
              spouse: wife,
            });

            await Promise.all([husband.save(), wife.save()]);

            const introspection = await Introspector.introspect(connection.db);
            expect(introspection.models[0]).toMatchObject({
              name: 'people',
              analysis: {
                type: 'object',
                object: {
                  name: { type: 'string' },
                  spouse: { type: 'ObjectId', referenceTo: 'people' },
                },
              },
            });
          });
        });
      });

      describe('UUID string reference', () => {
        describe('a simple with a one to many relationship between 2 models', () => {
          test('it should detect the relation', async () => {
            const Page = newModel(new Schema({ number: Number, book: String }), 'Page');
            const Book = newModel(new Schema({ title: String, _id: String }), 'Book');

            const bookUuid = crypto.randomBytes(16).toString('hex');
            await new Book({ title: 'The Hobbit', _id: bookUuid }).save();
            await Promise.all(
              Array.from(Array(10).keys()).map(number =>
                new Page({ number, book: bookUuid }).save(),
              ),
            );

            const introspection = await Introspector.introspect(connection.db);
            expect(introspection.models).toMatchObject([
              {
                name: 'books',
                analysis: { type: 'object', object: { title: { type: 'string' } } },
              },
              {
                name: 'pages',
                analysis: {
                  type: 'object',
                  object: {
                    book: { type: 'string', referenceTo: 'books' },
                    number: { type: 'number' },
                  },
                },
              },
            ]);
          });
        });

        describe('with reflective one to one relationship', () => {
          test('it should detect the relation', async () => {
            const Person = newModel(
              new Schema({ name: String, spouse: String, _id: String }),
              'Person',
            );
            const husbandUuid = crypto.randomBytes(16).toString('hex');
            const wifeUuid = crypto.randomBytes(16).toString('hex');
            const husband = new Person({ name: 'husband', spouse: wifeUuid, _id: husbandUuid });
            const wife = new Person({ name: 'wife', spouse: husbandUuid, _id: wifeUuid });
            await Promise.all([husband.save(), wife.save()]);

            const introspection = await Introspector.introspect(connection.db);
            expect(introspection.models[0]).toMatchObject({
              name: 'people',
              analysis: {
                type: 'object',
                object: {
                  name: { type: 'string' },
                  spouse: { type: 'string', referenceTo: 'people' },
                },
              },
            });
          });
        });
      });
    });

    describe('nullable', () => {
      describe('if 1 sample is null', () => {
        test('it should assume it is nullable', async () => {
          const Model = newModel(new Schema({ someKey: Schema.Types.Mixed }));
          await Promise.all(
            ['aaa', 'bbb', 'ccc', null].map(val => new Model({ someKey: val }).save()),
          );
          const introspection = await Introspector.introspect(connection.db);
          expect(introspection.models[0].analysis.object).toMatchObject({
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
          const Model = newModel(new Schema({ someKey: Schema.Types.Mixed }));
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
  });
});
