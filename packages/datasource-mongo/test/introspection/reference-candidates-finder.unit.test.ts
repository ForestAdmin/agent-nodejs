import type { ModelStudy } from '../../src/introspection/types';

import mongoose from 'mongoose';

import ReferenceCandidateFinder from '../../src/introspection/reference-candidates-finder';

const { ObjectId } = mongoose.mongo;

describe('Unit > Introspection > ReferenceCandidatesFinder', () => {
  describe('findCandidates', () => {
    it('should return the candidates for each model', () => {
      const bookAnalysis: ModelStudy = {
        name: 'book',
        analysis: {
          seen: 4,
          isReferenceCandidate: false,
          types: { object: 4 },
          object: {
            _id: {
              isReferenceCandidate: true,
              seen: 4,
              types: { string: 4 },
              referenceSamples: new Set(['1', '2', '3', '4']),
            },
            publisher: {
              isReferenceCandidate: true,
              seen: 4,
              types: { string: 4 },
              referenceSamples: new Set(['pub-1', 'pub-2']),
            },
          },
        },
      };

      const publisherAnalysis: ModelStudy = {
        name: 'publisher',
        analysis: {
          isReferenceCandidate: false,
          seen: 2,
          types: { object: 2 },
          object: {
            _id: {
              isReferenceCandidate: true,
              seen: 2,
              types: { string: 2 },
              referenceSamples: new Set(['pub-1', 'pub-2']),
            },
            name: {
              isReferenceCandidate: true,
              seen: 2,
              types: { string: 2 },
              referenceSamples: new Set(['Chilton Books', 'Gollancz']),
            },
          },
        },
      };

      const candidates = ReferenceCandidateFinder.findCandidates([bookAnalysis, publisherAnalysis]);
      expect(candidates).toEqual({
        book: [bookAnalysis.analysis.object?.publisher, publisherAnalysis.analysis.object?.name],
        publisher: [
          bookAnalysis.analysis.object?.publisher,
          publisherAnalysis.analysis.object?.name,
        ],
      });
    });

    it('should not return candidates if type do not match', () => {
      const bookAnalysis: ModelStudy = {
        name: 'book',
        analysis: {
          seen: 4,
          isReferenceCandidate: false,
          types: { object: 4 },
          object: {
            _id: {
              isReferenceCandidate: true,
              seen: 2,
              types: { ObjectId: 2 },
              referenceSamples: new Set([new ObjectId(), new ObjectId()]),
            },
            title: {
              isReferenceCandidate: true,
              seen: 4,
              types: { string: 4 },
              referenceSamples: new Set([
                'Dune',
                'Foundation',
                'The Hobbit',
                'The Lord of the Rings',
              ]),
            },
          },
        },
      };

      const publisherAnalysis: ModelStudy = {
        name: 'publisher',
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
              isReferenceCandidate: true,
              seen: 2,
              types: { string: 2 },
              referenceSamples: new Set(['Chilton Books', 'Gollancz']),
            },
          },
        },
      };

      const candidates = ReferenceCandidateFinder.findCandidates([bookAnalysis, publisherAnalysis]);
      expect(candidates).toEqual({});
    });

    it('should return candidates by ignoring null values', () => {
      const bookAnalysis: ModelStudy = {
        name: 'book',
        analysis: {
          seen: 4,
          isReferenceCandidate: false,
          types: { object: 4 },
          object: {
            _id: {
              isReferenceCandidate: true,
              seen: 4,
              types: { string: 4 },
              referenceSamples: new Set(['1', '2', '3', '4']),
            },
            publisher: {
              isReferenceCandidate: true,
              seen: 4,
              types: { string: 2, null: 2 },
              referenceSamples: new Set(['pub-1', 'pub-2']),
            },
          },
        },
      };

      const publisherAnalysis: ModelStudy = {
        name: 'publisher',
        analysis: {
          isReferenceCandidate: false,
          seen: 2,
          types: { object: 2 },
          object: {
            _id: {
              isReferenceCandidate: true,
              seen: 2,
              types: { string: 2 },
              referenceSamples: new Set(['pub-1', 'pub-2']),
            },
            name: {
              isReferenceCandidate: true,
              seen: 2,
              types: { string: 2, null: 2 },
              referenceSamples: new Set(['Chilton Books', 'Gollancz']),
            },
          },
        },
      };

      const candidates = ReferenceCandidateFinder.findCandidates([bookAnalysis, publisherAnalysis]);
      expect(candidates).toEqual({
        book: [bookAnalysis.analysis.object?.publisher, publisherAnalysis.analysis.object?.name],
        publisher: [
          bookAnalysis.analysis.object?.publisher,
          publisherAnalysis.analysis.object?.name,
        ],
      });
    });

    it('should ignore properties with multiple types', () => {
      const bookAnalysis: ModelStudy = {
        name: 'book',
        analysis: {
          seen: 4,
          isReferenceCandidate: false,
          types: { object: 4 },
          object: {
            _id: {
              isReferenceCandidate: true,
              seen: 4,
              types: { string: 4 },
              referenceSamples: new Set(['1', '2', '3', '4']),
            },
            publisher: {
              isReferenceCandidate: true,
              seen: 4,
              types: { string: 2, ObjectId: 2 },
              referenceSamples: new Set(['pub-1', 'pub-2', new ObjectId(), new ObjectId()]),
            },
          },
        },
      };

      const publisherAnalysis: ModelStudy = {
        name: 'publisher',
        analysis: {
          isReferenceCandidate: false,
          seen: 2,
          types: { object: 2 },
          object: {
            _id: {
              isReferenceCandidate: true,
              seen: 2,
              types: { string: 2 },
              referenceSamples: new Set(['pub-1', 'pub-2']),
            },
          },
        },
      };

      const candidates = ReferenceCandidateFinder.findCandidates([bookAnalysis, publisherAnalysis]);
      expect(candidates).toEqual({});
    });

    describe('with nested objects', () => {
      it('should return candidates in nested objects', () => {
        const bookAnalysis: ModelStudy = {
          name: 'book',
          analysis: {
            seen: 4,
            isReferenceCandidate: false,
            types: { object: 4 },
            object: {
              _id: {
                isReferenceCandidate: true,
                seen: 1,
                types: { ObjectId: 1 },
                referenceSamples: new Set([new ObjectId()]),
              },
              translations: {
                isReferenceCandidate: false,
                seen: 4,
                types: { object: 4 },
                object: {
                  french: {
                    isReferenceCandidate: true,
                    seen: 1,
                    types: { ObjectId: 1 },
                    referenceSamples: new Set([new ObjectId()]),
                  },
                },
              },
            },
          },
        };

        const candidates = ReferenceCandidateFinder.findCandidates([bookAnalysis]);

        expect(candidates).toEqual({
          book: [bookAnalysis.analysis.object?.translations?.object?.french],
        });
      });
    });

    describe('with arrays', () => {
      it('should return candidates in arrays', () => {
        const bookAnalysis: ModelStudy = {
          name: 'book',
          analysis: {
            seen: 4,
            isReferenceCandidate: false,
            types: { object: 4 },
            object: {
              _id: {
                isReferenceCandidate: true,
                seen: 1,
                types: { ObjectId: 1 },
                referenceSamples: new Set([new ObjectId()]),
              },
              publishers: {
                isReferenceCandidate: false,
                seen: 1,
                types: { array: 1 },
                arrayElement: {
                  isReferenceCandidate: true,
                  seen: 1,
                  types: { ObjectId: 1 },
                  referenceSamples: new Set([new ObjectId()]),
                },
              },
            },
          },
        };

        const publisherAnalysis: ModelStudy = {
          name: 'publisher',
          analysis: {
            isReferenceCandidate: false,
            seen: 1,
            types: { object: 1 },
            object: {
              _id: {
                isReferenceCandidate: true,
                seen: 1,
                types: { ObjectId: 1 },
                referenceSamples: new Set([new ObjectId()]),
              },
            },
          },
        };

        const candidates = ReferenceCandidateFinder.findCandidates([
          bookAnalysis,
          publisherAnalysis,
        ]);

        expect(candidates).toEqual({
          book: [bookAnalysis.analysis.object?.publishers?.arrayElement],
          publisher: [bookAnalysis.analysis.object?.publishers?.arrayElement],
        });
      });
    });
  });
});
