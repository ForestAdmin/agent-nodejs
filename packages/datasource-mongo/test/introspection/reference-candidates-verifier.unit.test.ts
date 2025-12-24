import type { MongoDb, NodeStudy } from '../../src/introspection/types';

import mongoose from 'mongoose';

import ReferenceCandidatesVerifier from '../../src/introspection/reference-candidates-verifier';

const { ObjectId, Binary } = mongoose.mongo;

describe('Unit > Introspection > ReferenceCandidatesVerifier', () => {
  function setupCollectionMock<T>(resultsByCollection: Record<string, T[]>) {
    const collections: Record<string, { find: jest.Mock }> = {};

    const collectionConnection = jest.fn().mockImplementation((name: string) => {
      if (!resultsByCollection[name]) throw new Error(`Collection ${name} not found`);

      const request = {
        map: jest.fn().mockImplementation((callback: (T) => unknown) => ({
          toArray: jest.fn().mockResolvedValue(resultsByCollection[name].map(callback)),
        })),
      };

      const collection = {
        find: jest.fn().mockReturnValue(request),
      };
      collections[name] = collection;

      return collection;
    });

    const connection = {
      collection: collectionConnection,
    };

    return { connection, collections };
  }

  it('should return the matching references', async () => {
    const { connection } = setupCollectionMock({
      publisher: [{ _id: 'p-1' }, { _id: 'p-2' }],
    });

    const candidatesByModel: Record<string, NodeStudy[]> = {
      publisher: [
        {
          referenceSamples: new Set(['p-1', 'p-2']),
          isReferenceCandidate: true,
          seen: 2,
          types: { string: 2 },
        },
      ],
    };

    const result = await ReferenceCandidatesVerifier.filterCandidates(
      connection as unknown as MongoDb,
      candidatesByModel,
    );

    expect(result).toEqual({
      publisher: [
        {
          referenceSamples: new Set(['p-1', 'p-2']),
          isReferenceCandidate: true,
          seen: 2,
          types: { string: 2 },
        },
      ],
    });
  });

  it('should not return references that are not matching', async () => {
    const { connection } = setupCollectionMock({
      publisher: [{ _id: 'p-1' }, { _id: 'p-2' }],
    });

    const candidatesByModel: Record<string, NodeStudy[]> = {
      publisher: [
        {
          referenceSamples: new Set(['Dune', 'Foundation']),
          isReferenceCandidate: true,
          seen: 2,
          types: { string: 2 },
        },
      ],
    };

    const result = await ReferenceCandidatesVerifier.filterCandidates(
      connection as unknown as MongoDb,
      candidatesByModel,
    );

    expect(result).toEqual({
      publisher: [],
    });
  });

  it('should call find with the correct parameters', async () => {
    const { connection, collections } = setupCollectionMock({
      publisher: [{ _id: 'p-1' }, { _id: 'p-2' }],
    });

    const candidatesByModel: Record<string, NodeStudy[]> = {
      publisher: [
        {
          referenceSamples: new Set(['p-1', 'p-2']),
          isReferenceCandidate: true,
          seen: 2,
          types: { string: 2 },
        },
      ],
    };

    await ReferenceCandidatesVerifier.filterCandidates(
      connection as unknown as MongoDb,
      candidatesByModel,
    );

    expect(collections.publisher.find).toHaveBeenCalledWith(
      { _id: { $in: ['p-1', 'p-2'] } },
      { projection: { _id: 1 } },
    );
  });

  describe('matching ids detection with bson types', () => {
    it('should work when ids are ObjectIds', async () => {
      const publisherId1 = new ObjectId();
      const publisherId2 = new ObjectId();
      const { connection } = setupCollectionMock({
        publisher: [{ _id: publisherId1 }, { _id: publisherId2 }],
      });

      const candidatesByModel: Record<string, NodeStudy[]> = {
        publisher: [
          {
            referenceSamples: new Set([
              new ObjectId(publisherId1.toHexString()),
              new ObjectId(publisherId2.toHexString()),
            ]),
            isReferenceCandidate: true,
            seen: 2,
            types: { number: 2 },
          },
        ],
      };

      const result = await ReferenceCandidatesVerifier.filterCandidates(
        connection as unknown as MongoDb,
        candidatesByModel,
      );

      expect(result).toEqual({
        publisher: [
          {
            referenceSamples: new Set([publisherId1, publisherId2]),
            isReferenceCandidate: true,
            seen: 2,
            types: { number: 2 },
          },
        ],
      });
    });

    it('should detect matching ids when using binary type', async () => {
      const publisherId1 = new Binary(mongoose.mongo.UUID.generate());
      const publisherId2 = new Binary(mongoose.mongo.UUID.generate());
      const { connection } = setupCollectionMock({
        publisher: [{ _id: publisherId1 }, { _id: publisherId2 }],
      });

      const candidatesByModel: Record<string, NodeStudy[]> = {
        publisher: [
          {
            referenceSamples: new Set([publisherId1, publisherId2]),
            isReferenceCandidate: true,
            seen: 2,
            types: { Binary: 2 },
          },
        ],
      };

      const result = await ReferenceCandidatesVerifier.filterCandidates(
        connection as unknown as MongoDb,
        candidatesByModel,
      );

      expect(result).toEqual({
        publisher: [
          {
            referenceSamples: new Set([
              new Binary(publisherId1.value()),
              new Binary(publisherId2.value()),
            ]),
            isReferenceCandidate: true,
            seen: 2,
            types: { Binary: 2 },
          },
        ],
      });
    });
  });

  describe('when all ids cannot be found', () => {
    it('should not return the reference', async () => {
      const { connection } = setupCollectionMock({
        publisher: [{ _id: 'p-1' }],
      });

      const candidatesByModel: Record<string, NodeStudy[]> = {
        publisher: [
          {
            referenceSamples: new Set(['p-1', 'p-2']),
            isReferenceCandidate: true,
            seen: 2,
            types: { string: 2 },
          },
        ],
      };

      const result = await ReferenceCandidatesVerifier.filterCandidates(
        connection as unknown as MongoDb,
        candidatesByModel,
      );

      expect(result).toEqual({
        publisher: [],
      });
    });
  });
});
