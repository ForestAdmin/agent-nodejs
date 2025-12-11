import { randomUUID } from 'crypto';
import mongoose from 'mongoose';

import Structure from '../../src/introspection/structure';
import { MongoDb } from '../../src/introspection/types';

const { Decimal128, Int32, Long, Timestamp, ObjectId, Binary } = mongoose.mongo;

describe('Introspection > Structure', () => {
  async function* asyncIterate<T>(array: Array<T>): AsyncIterable<T> {
    for (const item of array) {
      yield Promise.resolve(item);
    }
  }

  function setupConnectionMock(
    collectionDefinitions: Array<{
      collectionName: string;
      records: Array<Record<string, unknown>>;
    }>,
  ) {
    const findQueries: Array<{
      limit: jest.Mock;
    }> = [];
    const mongoRecords: Array<Record<string, unknown>[]> = [];

    const collections = collectionDefinitions.map(({ collectionName, records }) => {
      const collectionMongoRecords = records;
      const query = {
        limit: jest.fn().mockReturnValue(asyncIterate(collectionMongoRecords)),
      };
      const find = jest.fn().mockReturnValue(query);

      findQueries.push(query);
      mongoRecords.push(collectionMongoRecords);

      return {
        collectionName,
        find,
      };
    });

    const connection = {
      collections: jest.fn().mockResolvedValue(collections),
    };

    return { connection, collections, findQueries, mongoRecords };
  }

  describe('introspect', () => {
    it('should not return empty collections', async () => {
      const { connection } = setupConnectionMock([
        {
          collectionName: 'emptyCollection',
          records: [],
        },
      ]);

      const structure = await Structure.introspect(connection as unknown as MongoDb, {
        collectionSampleSize: 1,
        referenceSampleSize: 1,
      });

      expect(structure).toEqual([]);
    });

    it('should return collections sorted by name', async () => {
      const { connection } = setupConnectionMock([
        {
          collectionName: 'b',
          records: [{ name: 'Bob' }],
        },
        {
          collectionName: 'a',
          records: [{ name: 'Bob' }],
        },
      ]);

      const structure = await Structure.introspect(connection as unknown as MongoDb, {
        collectionSampleSize: 1,
        referenceSampleSize: 1,
      });

      expect(structure).toEqual([
        expect.objectContaining({ name: 'a' }),
        expect.objectContaining({ name: 'b' }),
      ]);
    });

    it('should limit to the collectionSampleSize', async () => {
      const { connection, findQueries } = setupConnectionMock([
        {
          collectionName: 'collection',
          records: [{ name: 'Alice' }, { name: 'Bob' }],
        },
      ]);

      await Structure.introspect(connection as unknown as MongoDb, {
        collectionSampleSize: 10,
        referenceSampleSize: 1,
      });

      expect(findQueries[0].limit).toHaveBeenCalledWith(10);
    });

    it('should limit the number of reference samples', async () => {
      const { connection } = setupConnectionMock([
        {
          collectionName: 'collection',
          records: [{ name: 'Alice' }, { name: 'Bob' }, { name: 'Charlie' }],
        },
      ]);

      const structure = await Structure.introspect(connection as unknown as MongoDb, {
        collectionSampleSize: 1,
        referenceSampleSize: 2,
      });

      const referenceSamples = structure[0].analysis.object?.name?.referenceSamples;

      expect(referenceSamples).toContain('Alice');
      expect(referenceSamples).toContain('Bob');
      expect(referenceSamples).not.toContain('Charlie');
    });

    describe('when the elements only have simple properties', () => {
      describe('with strings', () => {
        it('should generate the structure', async () => {
          const { connection } = setupConnectionMock([
            {
              collectionName: 'collection',
              records: [{ name: 'Alice' }],
            },
          ]);

          const structure = await Structure.introspect(connection as unknown as MongoDb, {
            collectionSampleSize: 1,
            referenceSampleSize: 1,
          });

          expect(structure).toEqual([
            {
              name: 'collection',
              analysis: {
                isReferenceCandidate: false,
                object: {
                  name: expect.objectContaining({
                    seen: 1,
                    types: { string: 1 },
                  }),
                },
                seen: 1,
                types: {
                  object: 1,
                },
              },
            },
          ]);
        });

        it('should consider the field as a reference candidate when containing a UUID', async () => {
          const uuid = randomUUID();
          const { connection } = setupConnectionMock([
            {
              collectionName: 'collection',
              records: [{ parent: uuid }],
            },
          ]);

          const structure = await Structure.introspect(connection as unknown as MongoDb, {
            collectionSampleSize: 1,
            referenceSampleSize: 1,
          });

          expect(structure).toEqual([
            {
              name: 'collection',
              analysis: expect.objectContaining({
                isReferenceCandidate: false,
                object: {
                  parent: expect.objectContaining({
                    isReferenceCandidate: true,
                    referenceSamples: new Set([uuid]),
                  }),
                },
              }),
            },
          ]);
        });

        it('should not consider the field as a reference candidate when containing a long value', async () => {
          const longValue = new Array(37).fill('a').join(''); // 37 characters
          const { connection } = setupConnectionMock([
            {
              collectionName: 'collection',
              records: [{ parent: longValue }],
            },
          ]);

          const structure = await Structure.introspect(connection as unknown as MongoDb, {
            collectionSampleSize: 1,
            referenceSampleSize: 1,
          });

          expect(structure).toEqual([
            {
              name: 'collection',
              analysis: expect.objectContaining({
                isReferenceCandidate: false,
                object: {
                  parent: expect.objectContaining({
                    isReferenceCandidate: false,
                  }),
                },
              }),
            },
          ]);

          expect(structure[0].analysis.object?.parent).not.toHaveProperty('referenceSamples');
        });
      });

      describe('with numbers', () => {
        it('should generate the structure for a number value', async () => {
          const { connection } = setupConnectionMock([
            {
              collectionName: 'collection',
              records: [{ age: 42 }],
            },
          ]);

          const structure = await Structure.introspect(connection as unknown as MongoDb, {
            collectionSampleSize: 1,
            referenceSampleSize: 1,
          });

          expect(structure).toEqual([
            {
              name: 'collection',
              analysis: {
                isReferenceCandidate: false,
                object: {
                  age: expect.objectContaining({
                    seen: 1,
                    types: { number: 1 },
                  }),
                },
                seen: 1,
                types: {
                  object: 1,
                },
              },
            },
          ]);
        });

        it('should not consider number as reference candidates', async () => {
          const { connection } = setupConnectionMock([
            {
              collectionName: 'collection',
              records: [{ age: 42 }],
            },
          ]);

          const structure = await Structure.introspect(connection as unknown as MongoDb, {
            collectionSampleSize: 1,
            referenceSampleSize: 1,
          });

          expect(structure).toEqual([
            {
              name: 'collection',
              analysis: expect.objectContaining({
                isReferenceCandidate: false,
                object: {
                  age: expect.objectContaining({
                    isReferenceCandidate: false,
                  }),
                },
              }),
            },
          ]);

          expect(structure[0].analysis.object?.age).not.toHaveProperty('referenceSamples');
        });
      });

      describe('with dates', () => {
        it('should generate the structure for a date value', async () => {
          const { connection } = setupConnectionMock([
            {
              collectionName: 'collection',
              records: [{ birthDate: new Date('1980-01-01') }],
            },
          ]);

          const structure = await Structure.introspect(connection as unknown as MongoDb, {
            collectionSampleSize: 1,
            referenceSampleSize: 1,
          });

          expect(structure).toEqual([
            {
              name: 'collection',
              analysis: {
                isReferenceCandidate: false,
                object: {
                  birthDate: expect.objectContaining({
                    seen: 1,
                    types: { Date: 1 },
                  }),
                },
                seen: 1,
                types: {
                  object: 1,
                },
              },
            },
          ]);
        });

        it('should not consider date as reference candidates', async () => {
          const { connection } = setupConnectionMock([
            {
              collectionName: 'collection',
              records: [{ birthDate: new Date('1980-01-01') }],
            },
          ]);

          const structure = await Structure.introspect(connection as unknown as MongoDb, {
            collectionSampleSize: 1,
            referenceSampleSize: 1,
          });

          expect(structure).toEqual([
            {
              name: 'collection',
              analysis: expect.objectContaining({
                isReferenceCandidate: false,
                object: {
                  birthDate: expect.objectContaining({
                    isReferenceCandidate: false,
                  }),
                },
              }),
            },
          ]);

          expect(structure[0].analysis.object?.birthDate).not.toHaveProperty('referenceSamples');
        });
      });

      describe('with booleans', () => {
        it('should generate the structure for a boolean value', async () => {
          const { connection } = setupConnectionMock([
            {
              collectionName: 'collection',
              records: [{ isAlive: true }],
            },
          ]);

          const structure = await Structure.introspect(connection as unknown as MongoDb, {
            collectionSampleSize: 1,
            referenceSampleSize: 1,
          });

          expect(structure).toEqual([
            {
              name: 'collection',
              analysis: {
                isReferenceCandidate: false,
                object: {
                  isAlive: expect.objectContaining({
                    seen: 1,
                    types: { boolean: 1 },
                  }),
                },
                seen: 1,
                types: {
                  object: 1,
                },
              },
            },
          ]);
        });

        it('should not consider boolean as reference candidates', async () => {
          const { connection } = setupConnectionMock([
            {
              collectionName: 'collection',
              records: [{ isAlive: true }],
            },
          ]);

          const structure = await Structure.introspect(connection as unknown as MongoDb, {
            collectionSampleSize: 1,
            referenceSampleSize: 1,
          });

          expect(structure).toEqual([
            {
              name: 'collection',
              analysis: expect.objectContaining({
                isReferenceCandidate: false,
                object: {
                  isAlive: expect.objectContaining({
                    isReferenceCandidate: false,
                  }),
                },
              }),
            },
          ]);

          expect(structure[0].analysis.object?.isAlive).not.toHaveProperty('referenceSamples');
        });
      });

      describe('BSON types', () => {
        describe.each([Int32, Long, Decimal128])('with %p', Type => {
          it('should generate the structure for a number value', async () => {
            const { connection } = setupConnectionMock([
              {
                collectionName: 'collection',
                records: [{ age: new Type('42') }],
              },
            ]);

            const structure = await Structure.introspect(connection as unknown as MongoDb, {
              collectionSampleSize: 1,
              referenceSampleSize: 1,
            });

            expect(structure).toEqual([
              {
                name: 'collection',
                analysis: {
                  isReferenceCandidate: false,
                  object: {
                    age: expect.objectContaining({
                      seen: 1,
                      types: { [Type.name]: 1 },
                    }),
                  },
                  seen: 1,
                  types: {
                    object: 1,
                  },
                },
              },
            ]);
          });
        });

        describe('with timestamps', () => {
          it('should generate the structure for a timestamp value', async () => {
            const { connection } = setupConnectionMock([
              {
                collectionName: 'collection',
                records: [{ createdAt: new Timestamp(new Long(10)) }],
              },
            ]);

            const structure = await Structure.introspect(connection as unknown as MongoDb, {
              collectionSampleSize: 1,
              referenceSampleSize: 1,
            });

            expect(structure).toEqual([
              {
                name: 'collection',
                analysis: {
                  isReferenceCandidate: false,
                  object: {
                    createdAt: expect.objectContaining({
                      seen: 1,
                      types: { Timestamp: 1 },
                    }),
                  },
                  seen: 1,
                  types: {
                    object: 1,
                  },
                },
              },
            ]);
          });

          it('should not consider timestamp as reference candidates', async () => {
            const { connection } = setupConnectionMock([
              {
                collectionName: 'collection',
                records: [{ createdAt: new Timestamp(new Long(10)) }],
              },
            ]);

            const structure = await Structure.introspect(connection as unknown as MongoDb, {
              collectionSampleSize: 1,
              referenceSampleSize: 1,
            });

            expect(structure).toEqual([
              {
                name: 'collection',
                analysis: expect.objectContaining({
                  isReferenceCandidate: false,
                  object: {
                    createdAt: expect.objectContaining({
                      isReferenceCandidate: false,
                    }),
                  },
                }),
              },
            ]);

            expect(structure[0].analysis.object?.createdAt).not.toHaveProperty('referenceSamples');
          });
        });

        describe('with ObjectId', () => {
          it('should generate the structure for an ObjectId value', async () => {
            const id = new ObjectId();
            const { connection } = setupConnectionMock([
              {
                collectionName: 'collection',
                records: [{ parent: id }],
              },
            ]);

            const structure = await Structure.introspect(connection as unknown as MongoDb, {
              collectionSampleSize: 1,
              referenceSampleSize: 1,
            });

            expect(structure).toEqual([
              {
                name: 'collection',
                analysis: {
                  isReferenceCandidate: false,
                  object: {
                    parent: expect.objectContaining({
                      seen: 1,
                      types: { ObjectId: 1 },
                    }),
                  },
                  seen: 1,
                  types: {
                    object: 1,
                  },
                },
              },
            ]);
          });

          it('should consider ObjectId as reference candidates', async () => {
            const id = new ObjectId();
            const { connection } = setupConnectionMock([
              {
                collectionName: 'collection',
                records: [{ parent: id }],
              },
            ]);

            const structure = await Structure.introspect(connection as unknown as MongoDb, {
              collectionSampleSize: 1,
              referenceSampleSize: 1,
            });

            expect(structure).toEqual([
              {
                name: 'collection',
                analysis: expect.objectContaining({
                  isReferenceCandidate: false,
                  object: {
                    parent: expect.objectContaining({
                      isReferenceCandidate: true,
                      referenceSamples: new Set([id]),
                    }),
                  },
                }),
              },
            ]);
          });
        });

        describe('with a binary value', () => {
          it('should generate the structure for a binary value', async () => {
            const value = new Binary(new Uint8Array(Buffer.from('ABCDEF', 'utf-8')));

            const { connection } = setupConnectionMock([
              {
                collectionName: 'collection',
                records: [{ data: value }],
              },
            ]);

            const structure = await Structure.introspect(connection as unknown as MongoDb, {
              collectionSampleSize: 1,
              referenceSampleSize: 1,
            });

            expect(structure).toEqual([
              {
                name: 'collection',
                analysis: {
                  isReferenceCandidate: false,
                  object: {
                    data: expect.objectContaining({
                      seen: 1,
                      types: { Binary: 1 },
                    }),
                  },
                  seen: 1,
                  types: {
                    object: 1,
                  },
                },
              },
            ]);
          });

          it('should consider binary as reference candidates if it contains a UUID', async () => {
            const uuid = new Binary(
              new Uint8Array(Buffer.from(randomUUID().replace(/-/g, ''), 'hex')),
            );
            const { connection } = setupConnectionMock([
              {
                collectionName: 'collection',
                records: [{ parent: uuid }],
              },
            ]);

            const structure = await Structure.introspect(connection as unknown as MongoDb, {
              collectionSampleSize: 1,
              referenceSampleSize: 1,
            });

            expect(structure).toEqual([
              {
                name: 'collection',
                analysis: expect.objectContaining({
                  isReferenceCandidate: false,
                  object: {
                    parent: expect.objectContaining({
                      isReferenceCandidate: true,
                      referenceSamples: new Set([uuid]),
                    }),
                  },
                }),
              },
            ]);
          });

          it('should not consider binary as reference candidates if too long', async () => {
            const value = new Binary(
              new Uint8Array(Buffer.from(new Array(17).fill('A').join(''), 'utf-8')),
            );

            const { connection } = setupConnectionMock([
              {
                collectionName: 'collection',
                records: [{ data: value }],
              },
            ]);

            const structure = await Structure.introspect(connection as unknown as MongoDb, {
              collectionSampleSize: 1,
              referenceSampleSize: 1,
            });

            expect(structure).toEqual([
              {
                name: 'collection',
                analysis: expect.objectContaining({
                  isReferenceCandidate: false,
                  object: {
                    data: expect.objectContaining({
                      isReferenceCandidate: false,
                    }),
                  },
                }),
              },
            ]);

            expect(structure[0].analysis.object?.data).not.toHaveProperty('referenceSamples');
          });
        });
      });

      describe('with null', () => {
        it('should generate the structure for a null value', async () => {
          const { connection } = setupConnectionMock([
            {
              collectionName: 'collection',
              records: [{ parent: null }],
            },
          ]);

          const structure = await Structure.introspect(connection as unknown as MongoDb, {
            collectionSampleSize: 1,
            referenceSampleSize: 1,
          });

          expect(structure).toEqual([
            {
              name: 'collection',
              analysis: {
                isReferenceCandidate: false,
                object: {
                  parent: expect.objectContaining({
                    seen: 1,
                    types: { null: 1 },
                  }),
                },
                seen: 1,
                types: {
                  object: 1,
                },
              },
            },
          ]);
        });

        it('should consider null as reference candidate', async () => {
          const { connection } = setupConnectionMock([
            {
              collectionName: 'collection',
              records: [{ parent: null }],
            },
          ]);

          const structure = await Structure.introspect(connection as unknown as MongoDb, {
            collectionSampleSize: 1,
            referenceSampleSize: 1,
          });

          expect(structure).toEqual([
            {
              name: 'collection',
              analysis: expect.objectContaining({
                isReferenceCandidate: false,
                object: {
                  parent: expect.objectContaining({
                    isReferenceCandidate: true,
                    referenceSamples: new Set([]),
                  }),
                },
              }),
            },
          ]);
        });
      });
    });

    describe('when the elements have object properties', () => {
      it('should generate the structure for an object value', async () => {
        const { connection } = setupConnectionMock([
          {
            collectionName: 'collection',
            records: [{ address: { city: 'Paris' } }],
          },
        ]);

        const structure = await Structure.introspect(connection as unknown as MongoDb, {
          collectionSampleSize: 1,
          referenceSampleSize: 1,
        });

        expect(structure).toEqual([
          {
            name: 'collection',
            analysis: {
              isReferenceCandidate: false,
              object: {
                address: expect.objectContaining({
                  seen: 1,
                  types: { object: 1 },
                  object: {
                    city: expect.objectContaining({
                      seen: 1,
                      types: { string: 1 },
                    }),
                  },
                }),
              },
              seen: 1,
              types: {
                object: 1,
              },
            },
          },
        ]);
      });

      it("should consider child objects's properties as reference candidates", async () => {
        const { connection } = setupConnectionMock([
          {
            collectionName: 'collection',
            records: [{ address: { city: 'Paris' } }],
          },
        ]);

        const structure = await Structure.introspect(connection as unknown as MongoDb, {
          collectionSampleSize: 1,
          referenceSampleSize: 1,
        });

        expect(structure).toEqual([
          {
            name: 'collection',
            analysis: expect.objectContaining({
              isReferenceCandidate: false,
              object: {
                address: expect.objectContaining({
                  isReferenceCandidate: false,
                  object: {
                    city: expect.objectContaining({
                      isReferenceCandidate: true,
                      referenceSamples: new Set(['Paris']),
                    }),
                  },
                }),
              },
            }),
          },
        ]);
      });
    });

    describe('when the elements have array properties', () => {
      it('should generate the structure for an array value', async () => {
        const { connection } = setupConnectionMock([
          {
            collectionName: 'collection',
            records: [{ tags: ['tag1', 'tag2'] }],
          },
        ]);

        const structure = await Structure.introspect(connection as unknown as MongoDb, {
          collectionSampleSize: 1,
          referenceSampleSize: 1,
        });

        expect(structure).toEqual([
          {
            name: 'collection',
            analysis: {
              isReferenceCandidate: false,
              object: {
                tags: expect.objectContaining({
                  seen: 1,
                  types: { array: 1 },
                  arrayElement: expect.objectContaining({
                    seen: 2,
                    types: { string: 2 },
                  }),
                }),
              },
              seen: 1,
              types: {
                object: 1,
              },
            },
          },
        ]);
      });

      it('should consider array elements as reference candidates', async () => {
        const { connection } = setupConnectionMock([
          {
            collectionName: 'collection',
            records: [{ tags: ['tag1', 'tag2'] }],
          },
        ]);

        const structure = await Structure.introspect(connection as unknown as MongoDb, {
          collectionSampleSize: 1,
          referenceSampleSize: 10,
        });

        expect(structure).toEqual([
          {
            name: 'collection',
            analysis: expect.objectContaining({
              isReferenceCandidate: false,
              object: {
                tags: expect.objectContaining({
                  isReferenceCandidate: false,
                  arrayElement: expect.objectContaining({
                    isReferenceCandidate: true,
                    referenceSamples: new Set(),
                  }),
                }),
              },
            }),
          },
        ]);

        const referenceSamples = structure[0].analysis.object?.tags?.arrayElement?.referenceSamples;

        expect(referenceSamples).toContain('tag1');
        expect(referenceSamples).toContain('tag2');
      });
    });

    describe('when elements are sometimes arrays and sometimes values', () => {
      it('should generate the appropriate structure', async () => {
        const { connection } = setupConnectionMock([
          {
            collectionName: 'collection',
            records: [{ tags: ['tag1', 'tag2'] }, { tags: 'tag3' }],
          },
        ]);

        const structure = await Structure.introspect(connection as unknown as MongoDb, {
          collectionSampleSize: 2,
          referenceSampleSize: 1,
        });

        expect(structure).toEqual([
          {
            name: 'collection',
            analysis: {
              isReferenceCandidate: false,
              object: {
                tags: expect.objectContaining({
                  seen: 2,
                  types: { array: 1, string: 1 },
                  arrayElement: expect.objectContaining({
                    seen: 2,
                    types: { string: 2 },
                  }),
                }),
              },
              seen: 2,
              types: {
                object: 2,
              },
            },
          },
        ]);
      });

      it('should consider array elements as reference candidates', async () => {
        const { connection } = setupConnectionMock([
          {
            collectionName: 'collection',
            records: [{ tags: ['tag1', 'tag2'] }, { tags: 'tag3' }],
          },
        ]);

        const structure = await Structure.introspect(connection as unknown as MongoDb, {
          collectionSampleSize: 2,
          referenceSampleSize: 10,
        });

        expect(structure).toEqual([
          {
            name: 'collection',
            analysis: expect.objectContaining({
              isReferenceCandidate: false,
              object: {
                tags: expect.objectContaining({
                  isReferenceCandidate: false,
                  arrayElement: expect.objectContaining({
                    isReferenceCandidate: true,
                    referenceSamples: new Set(),
                  }),
                }),
              },
            }),
          },
        ]);

        const referenceSamples = structure[0].analysis.object?.tags?.arrayElement?.referenceSamples;

        expect(referenceSamples).toContain('tag1');
        expect(referenceSamples).toContain('tag2');
        expect(referenceSamples?.size).toBe(2);
      });
    });
  });
});
