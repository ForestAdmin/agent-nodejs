/* eslint-disable no-underscore-dangle */

import type { MongoCollection, MongoDb, NodeStudy } from './types';

export default class ReferenceCandidateVerifier {
  /** Filter out all candidates where references can't be found */
  static async filterCandidates(
    connection: MongoDb,
    candidatesByModel: Record<string, NodeStudy[]>,
  ): Promise<Record<string, NodeStudy[]>> {
    const entries = Object.entries(candidatesByModel).map(
      async ([modelName, candidates]): Promise<[string, NodeStudy[]]> => {
        const collection = connection.collection(modelName);
        const refs = await this.filterCandidatesForModel(collection, candidates);

        return [modelName, refs];
      },
    );

    return Object.fromEntries(await Promise.all(entries));
  }

  /**
   * For a given model, query the database for samples of the reference candidates and check if
   * they are indeed references.
   */
  private static async filterCandidatesForModel(
    collection: MongoCollection,
    nodes: NodeStudy[],
  ): Promise<NodeStudy[]> {
    const samples = nodes.reduce((memo, node) => [...memo, ...node.referenceSamples], []);
    const found = new Set(
      await collection
        .find({ _id: { $in: samples } }, { projection: { _id: 1 } })
        .map(d => this.toString(d._id))
        .toArray(),
    );

    return nodes.filter(node => {
      return [...node.referenceSamples].every(sample => found.has(this.toString(sample)));
    });
  }

  /** Cast samples to string so that we can compare their values */
  private static toString(sample: unknown): string {
    return typeof sample === 'object' &&
      'toHexString' in sample &&
      typeof sample.toHexString === 'function'
      ? sample.toHexString()
      : String(sample);
  }
}
