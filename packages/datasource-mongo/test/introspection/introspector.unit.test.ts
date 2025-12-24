import type { Introspection, ModelStudy, MongoDb } from '../../src/introspection/types';

import mongoose from 'mongoose';

import Introspector from '../../src/introspection/introspector';
import ReferenceCandidateFinder from '../../src/introspection/reference-candidates-finder';
import ReferenceCandidateVerifier from '../../src/introspection/reference-candidates-verifier';
import Structure from '../../src/introspection/structure';

const { ObjectId } = mongoose.mongo;

jest.mock('../../src/introspection/structure');
jest.mock('../../src/introspection/reference-candidates-finder');
jest.mock('../../src/introspection/reference-candidates-verifier');

describe('Introspection > index', () => {
  describe('introspect', () => {
    describe('invalid options', () => {
      it('should throw an error if collectionSampleSize < 1', async () => {
        const db = Symbol('db') as unknown as MongoDb;
        await expect(Introspector.introspect(db, { collectionSampleSize: 0 })).rejects.toThrow(
          'collectionSampleSize must be at least 1',
        );
      });

      it('should throw an error if referenceSampleSize < 0', async () => {
        const db = Symbol('db') as unknown as MongoDb;
        await expect(Introspector.introspect(db, { referenceSampleSize: -1 })).rejects.toThrow(
          'referenceSampleSize must be at least 0',
        );
      });

      it('should throw an error if maxPropertiesPerObject < 1', async () => {
        const db = Symbol('db') as unknown as MongoDb;
        await expect(Introspector.introspect(db, { maxPropertiesPerObject: 0 })).rejects.toThrow(
          'maxPropertiesPerObject must be at least 1',
        );
      });
    });

    describe('with valid options', () => {
      describe('with a simple collection', () => {
        it('should return the expected introspection', async () => {
          const db = Symbol('db');

          const structure: ModelStudy[] = [
            {
              name: 'books',
              analysis: {
                isReferenceCandidate: false,
                seen: 2,
                types: { object: 2 },
                object: {
                  _id: {
                    isReferenceCandidate: true,
                    seen: 2,
                    types: { ObjectId: 2 },
                    referenceSamples: new Set([new ObjectId(), new ObjectId()]),
                  },
                  title: {
                    isReferenceCandidate: false,
                    seen: 2,
                    types: { string: 2 },
                  },
                },
              },
            },
          ];

          jest.mocked(Structure.introspect).mockResolvedValue(structure);
          jest.mocked(ReferenceCandidateFinder.findCandidates).mockReturnValue({});
          jest.mocked(ReferenceCandidateVerifier.filterCandidates).mockResolvedValue({});

          const introspection = await Introspector.introspect(db as unknown as MongoDb);

          expect(introspection).toEqual({
            source: '@forestadmin/datasource-mongo',
            version: 1,
            models: [
              {
                name: 'books',
                analysis: {
                  nullable: false,
                  referenceTo: undefined,
                  type: 'object',
                  object: {
                    _id: { type: 'ObjectId', nullable: false, referenceTo: undefined },
                    title: { type: 'string', nullable: false, referenceTo: undefined },
                  },
                },
              },
            ],
          });
        });
      });

      describe('with nullable fields', () => {
        it('should return nullable: true', async () => {
          const db = Symbol('db');

          const structure: ModelStudy[] = [
            {
              name: 'books',
              analysis: {
                isReferenceCandidate: false,
                seen: 2,
                types: { object: 2 },
                object: {
                  _id: {
                    isReferenceCandidate: true,
                    seen: 2,
                    types: { ObjectId: 2 },
                    referenceSamples: new Set([new ObjectId(), new ObjectId()]),
                  },
                  title: {
                    isReferenceCandidate: false,
                    seen: 1,
                    types: { string: 1, null: 1 },
                  },
                },
              },
            },
          ];

          jest.mocked(Structure.introspect).mockResolvedValue(structure);
          jest.mocked(ReferenceCandidateFinder.findCandidates).mockReturnValue({});
          jest.mocked(ReferenceCandidateVerifier.filterCandidates).mockResolvedValue({});

          const introspection = await Introspector.introspect(db as unknown as MongoDb);

          expect(introspection).toEqual({
            source: '@forestadmin/datasource-mongo',
            version: 1,
            models: [
              {
                name: 'books',
                analysis: {
                  nullable: false,
                  referenceTo: undefined,
                  type: 'object',
                  object: {
                    _id: { type: 'ObjectId', nullable: false, referenceTo: undefined },
                    title: { type: 'string', nullable: true, referenceTo: undefined },
                  },
                },
              },
            ],
          });
        });
      });

      describe('with references to other models', () => {
        it('should return the expected introspection', async () => {
          const db = Symbol('db');

          const books: ModelStudy = {
            name: 'books',
            analysis: {
              isReferenceCandidate: false,
              seen: 2,
              types: { object: 2 },
              object: {
                _id: {
                  isReferenceCandidate: true,
                  seen: 2,
                  types: { ObjectId: 2 },
                  referenceSamples: new Set([new ObjectId(), new ObjectId()]),
                },
                title: {
                  isReferenceCandidate: false,
                  seen: 2,
                  types: { string: 2 },
                },
                authorId: {
                  isReferenceCandidate: true,
                  seen: 2,
                  types: { ObjectId: 2 },
                  referenceSamples: new Set([new ObjectId(), new ObjectId()]),
                },
              },
            },
          };

          const authors: ModelStudy = {
            name: 'authors',
            analysis: {
              isReferenceCandidate: false,
              seen: 2,
              types: { object: 2 },
              object: {
                _id: {
                  isReferenceCandidate: true,
                  seen: 2,
                  types: { ObjectId: 2 },
                  referenceSamples: new Set([new ObjectId(), new ObjectId()]),
                },
                name: {
                  isReferenceCandidate: false,
                  seen: 2,
                  types: { string: 2 },
                },
              },
            },
          };

          const structure: ModelStudy[] = [books, authors];

          jest.mocked(Structure.introspect).mockResolvedValue(structure);
          jest.mocked(ReferenceCandidateFinder.findCandidates).mockReturnValue({
            books: [books.analysis.object!.authorId],
          });
          jest.mocked(ReferenceCandidateVerifier.filterCandidates).mockResolvedValue({
            authors: [books.analysis.object!.authorId],
          });

          const introspection = await Introspector.introspect(db as unknown as MongoDb);

          expect(introspection).toEqual({
            source: '@forestadmin/datasource-mongo',
            version: 1,
            models: [
              {
                name: 'authors',
                analysis: {
                  nullable: false,
                  referenceTo: undefined,
                  type: 'object',
                  object: {
                    _id: { type: 'ObjectId', nullable: false, referenceTo: undefined },
                    name: { type: 'string', nullable: false, referenceTo: undefined },
                  },
                },
              },
              {
                name: 'books',
                analysis: {
                  nullable: false,
                  referenceTo: undefined,
                  type: 'object',
                  object: {
                    _id: { type: 'ObjectId', nullable: false, referenceTo: undefined },
                    title: { type: 'string', nullable: false, referenceTo: undefined },
                    authorId: { type: 'ObjectId', nullable: false, referenceTo: 'authors' },
                  },
                },
              },
            ],
          });
        });
      });

      describe('with arrays', () => {
        it('should return the expected introspection', async () => {
          const db = Symbol('db');

          const books: ModelStudy = {
            name: 'books',
            analysis: {
              isReferenceCandidate: false,
              seen: 2,
              types: { object: 2 },
              object: {
                _id: {
                  isReferenceCandidate: true,
                  seen: 2,
                  types: { ObjectId: 2 },
                  referenceSamples: new Set([new ObjectId(), new ObjectId()]),
                },
                titles: {
                  isReferenceCandidate: false,
                  seen: 2,
                  types: { array: 2 },
                  arrayElement: {
                    isReferenceCandidate: false,
                    seen: 2,
                    types: { string: 2 },
                  },
                },
              },
            },
          };

          const structure: ModelStudy[] = [books];

          jest.mocked(Structure.introspect).mockResolvedValue(structure);
          jest.mocked(ReferenceCandidateFinder.findCandidates).mockReturnValue({});
          jest.mocked(ReferenceCandidateVerifier.filterCandidates).mockResolvedValue({});

          const introspection = await Introspector.introspect(db as unknown as MongoDb);

          expect(introspection).toEqual({
            source: '@forestadmin/datasource-mongo',
            version: 1,
            models: [
              {
                name: 'books',
                analysis: {
                  nullable: false,
                  referenceTo: undefined,
                  type: 'object',
                  object: {
                    _id: { type: 'ObjectId', nullable: false, referenceTo: undefined },
                    titles: {
                      type: 'array',
                      nullable: false,
                      referenceTo: undefined,
                      arrayElement: { type: 'string', nullable: false, referenceTo: undefined },
                    },
                  },
                },
              },
            ],
          });
        });
      });

      describe('with mixed types', () => {
        it('should return the expected introspection', async () => {
          const db = Symbol('db');

          const books: ModelStudy = {
            name: 'books',
            analysis: {
              isReferenceCandidate: false,
              seen: 2,
              types: { object: 2 },
              object: {
                _id: {
                  isReferenceCandidate: true,
                  seen: 2,
                  types: { ObjectId: 2 },
                  referenceSamples: new Set([new ObjectId(), new ObjectId()]),
                },
                title: {
                  isReferenceCandidate: false,
                  seen: 2,
                  types: { string: 2 },
                },
                isbn: {
                  isReferenceCandidate: false,
                  seen: 2,
                  types: { string: 1, number: 1 },
                },
              },
            },
          };

          const structure: ModelStudy[] = [books];

          jest.mocked(Structure.introspect).mockResolvedValue(structure);
          jest.mocked(ReferenceCandidateFinder.findCandidates).mockReturnValue({});
          jest.mocked(ReferenceCandidateVerifier.filterCandidates).mockResolvedValue({});

          const introspection = await Introspector.introspect(db as unknown as MongoDb);

          expect(introspection).toEqual({
            source: '@forestadmin/datasource-mongo',
            version: 1,
            models: [
              {
                name: 'books',
                analysis: {
                  nullable: false,
                  referenceTo: undefined,
                  type: 'object',
                  object: {
                    _id: { type: 'ObjectId', nullable: false, referenceTo: undefined },
                    title: { type: 'string', nullable: false, referenceTo: undefined },
                    isbn: {
                      nullable: false,
                      referenceTo: undefined,
                      type: 'Mixed',
                    },
                  },
                },
              },
            ],
          });
        });
      });

      describe('maxProps', () => {
        describe('when a sub property has more than maxProps properties', () => {
          it('should return the type "Mixed"', async () => {
            const db = Symbol('db');

            const structure: ModelStudy[] = [
              {
                name: 'books',
                analysis: {
                  isReferenceCandidate: false,
                  seen: 2,
                  types: { object: 2 },
                  object: {
                    _id: {
                      isReferenceCandidate: true,
                      seen: 2,
                      types: { ObjectId: 2 },
                      referenceSamples: new Set([new ObjectId(), new ObjectId()]),
                    },
                    title: {
                      isReferenceCandidate: false,
                      seen: 2,
                      types: { string: 2 },
                    },
                    tags: {
                      isReferenceCandidate: false,
                      seen: 2,
                      types: { object: 2 },
                      object: {
                        tag1: { isReferenceCandidate: false, seen: 1, types: { boolean: 1 } },
                        tag2: { isReferenceCandidate: false, seen: 1, types: { boolean: 1 } },
                        tag3: { isReferenceCandidate: false, seen: 1, types: { boolean: 1 } },
                        tag4: { isReferenceCandidate: false, seen: 1, types: { boolean: 1 } },
                        tag5: { isReferenceCandidate: false, seen: 1, types: { boolean: 1 } },
                      },
                    },
                  },
                },
              },
            ];

            jest.mocked(Structure.introspect).mockResolvedValue(structure);
            jest.mocked(ReferenceCandidateFinder.findCandidates).mockReturnValue({});
            jest.mocked(ReferenceCandidateVerifier.filterCandidates).mockResolvedValue({});

            const introspection = await Introspector.introspect(db as unknown as MongoDb, {
              maxPropertiesPerObject: 4,
            });

            expect(introspection).toEqual({
              source: '@forestadmin/datasource-mongo',
              version: 1,
              models: [
                {
                  name: 'books',
                  analysis: {
                    nullable: false,
                    referenceTo: undefined,
                    type: 'object',
                    object: {
                      _id: { type: 'ObjectId', nullable: false, referenceTo: undefined },
                      title: { type: 'string', nullable: false, referenceTo: undefined },
                      tags: { type: 'Mixed', nullable: false, referenceTo: undefined },
                    },
                  },
                },
              ],
            });
          });
        });

        describe('when a model has more than maxProps properties', () => {
          it('should return all the properties', async () => {
            const db = Symbol('db');

            const structure: ModelStudy[] = [
              {
                name: 'books',
                analysis: {
                  isReferenceCandidate: false,
                  seen: 2,
                  types: { object: 2 },
                  object: {
                    _id: {
                      isReferenceCandidate: true,
                      seen: 2,
                      types: { ObjectId: 2 },
                      referenceSamples: new Set([new ObjectId(), new ObjectId()]),
                    },
                    title: {
                      isReferenceCandidate: false,
                      seen: 2,
                      types: { string: 2 },
                    },
                    tag1: { isReferenceCandidate: false, seen: 1, types: { boolean: 1 } },
                    tag2: { isReferenceCandidate: false, seen: 1, types: { boolean: 1 } },
                    tag3: { isReferenceCandidate: false, seen: 1, types: { boolean: 1 } },
                    tag4: { isReferenceCandidate: false, seen: 1, types: { boolean: 1 } },
                    tag5: { isReferenceCandidate: false, seen: 1, types: { boolean: 1 } },
                  },
                },
              },
            ];

            jest.mocked(Structure.introspect).mockResolvedValue(structure);
            jest.mocked(ReferenceCandidateFinder.findCandidates).mockReturnValue({});
            jest.mocked(ReferenceCandidateVerifier.filterCandidates).mockResolvedValue({});

            const introspection = await Introspector.introspect(db as unknown as MongoDb, {
              maxPropertiesPerObject: 4,
            });

            expect(introspection).toEqual({
              source: '@forestadmin/datasource-mongo',
              version: 1,
              models: [
                {
                  name: 'books',
                  analysis: {
                    nullable: false,
                    referenceTo: undefined,
                    type: 'object',
                    object: {
                      _id: { type: 'ObjectId', nullable: false, referenceTo: undefined },
                      title: { type: 'string', nullable: false, referenceTo: undefined },
                      tag1: { type: 'boolean', nullable: false, referenceTo: undefined },
                      tag2: { type: 'boolean', nullable: false, referenceTo: undefined },
                      tag3: { type: 'boolean', nullable: false, referenceTo: undefined },
                      tag4: { type: 'boolean', nullable: false, referenceTo: undefined },
                      tag5: { type: 'boolean', nullable: false, referenceTo: undefined },
                    },
                  },
                },
              ],
            });
          });
        });
      });
    });
  });

  describe('assertGivenIntrospectionInLatestFormat', () => {
    it('should not throw if the version and source are correct', () => {
      expect(() => {
        Introspector.assertGivenIntrospectionInLatestFormat({
          source: '@forestadmin/datasource-mongo',
          version: 1,
        } as unknown as Introspection);
      }).not.toThrow();
    });

    it('should not throw when the introspection is missing', () => {
      expect(() => {
        Introspector.assertGivenIntrospectionInLatestFormat();
      }).not.toThrow();
    });

    it('should throw an error when the source is not the expected one', () => {
      expect(() => {
        Introspector.assertGivenIntrospectionInLatestFormat({
          source: 'another-source',
        } as unknown as Introspection);
      }).toThrow(
        'This introspection has not been generated by the package @forestadmin/datasource-mongo.',
      );
    });

    it('should throw an error when the version is greater than the expected one', () => {
      expect(() => {
        Introspector.assertGivenIntrospectionInLatestFormat({
          source: '@forestadmin/datasource-mongo',
          version: 2,
        } as unknown as Introspection);
      }).toThrow('Please update @forestadmin/datasource-mongo');
    });
  });
});
