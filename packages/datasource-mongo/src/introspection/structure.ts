import type { Binary } from 'bson';

import { ModelStudy, MongoCollection, MongoDb, NodeStudy, Primitive } from './types';

export default class Structure {
  static async introspect(
    connection: MongoDb,
    {
      collectionSampleSize,
      referenceSampleSize,
    }: { collectionSampleSize: number; referenceSampleSize: number },
  ): Promise<ModelStudy[]> {
    const collections = await connection.collections();
    const promises = collections.map(collection =>
      this.analyzeCollection(collection, collectionSampleSize, referenceSampleSize),
    );
    const structure = await Promise.all(promises);

    return structure
      .filter(collectionAnalysis => collectionAnalysis.analysis.seen > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  private static async analyzeCollection(
    collection: MongoCollection,
    collectionSampleSize: number,
    referenceSampleSize: number,
  ): Promise<ModelStudy> {
    const node = this.createNode();

    for await (const sample of collection.find().limit(collectionSampleSize)) {
      this.walkNode(node, sample, referenceSampleSize);
    }

    return { name: collection.collectionName, analysis: node };
  }

  private static createNode(): NodeStudy {
    return { types: {}, seen: 0, isReferenceCandidate: true, referenceSamples: new Set() };
  }

  private static walkNode(
    node: NodeStudy,
    sample: Record<string, unknown> | Array<unknown>,
    referenceSampleSize: number,
  ): void {
    if (Array.isArray(sample)) this.walkArrayNode(node, sample, referenceSampleSize);

    if (sample?.constructor === Object) {
      this.walkObjectNode(node, sample as Record<string, unknown>, referenceSampleSize);
    }

    this.annotateNode(node, sample, referenceSampleSize);
  }

  private static walkArrayNode(
    node: NodeStudy,
    sample: unknown[],
    referenceSampleSize: number,
  ): void {
    if (!node.arrayElement) node.arrayElement = this.createNode();

    for (const subSample of sample) {
      this.walkNode(
        node.arrayElement,
        subSample as unknown[] | Record<string, unknown>,
        referenceSampleSize,
      );
    }
  }

  private static walkObjectNode(
    node: NodeStudy,
    sample: Record<string, unknown>,
    referenceSampleSize: number,
  ): void {
    if (!node.object) node.object = {};

    for (const [key, subSample] of Object.entries(sample)) {
      if (!node.object[key]) node.object[key] = this.createNode();
      this.walkNode(
        node.object[key],
        subSample as unknown[] | Record<string, unknown>,
        referenceSampleSize,
      );
    }
  }

  private static annotateNode(node: NodeStudy, sample: unknown, referenceSampleSize: number): void {
    const type = this.getSampleType(sample);

    // Increment counters
    node.seen += 1;
    node.types[type] = (node.types[type] || 0) + 1;

    // Check if node is a reference candidate
    if (node.isReferenceCandidate) {
      const isSingleType = Object.keys(node.types).every(t => t === type || t === 'null');

      if (isSingleType && this.isCandidateForReference(type, sample)) {
        if (sample && node.referenceSamples.size < referenceSampleSize) {
          node.referenceSamples.add(sample);
        }
      } else {
        node.isReferenceCandidate = false;
        delete node.referenceSamples;
      }
    }
  }

  private static getSampleType(sample: unknown): Primitive {
    if (sample === null) return 'null';
    // eslint-disable-next-line no-underscore-dangle
    if (typeof sample === 'object' && '_bsontype' in sample) return sample._bsontype as Primitive;
    if (sample instanceof Date) return 'Date';
    if (Array.isArray(sample)) return 'array';
    if (sample?.constructor === Object) return 'object';

    return typeof sample as Primitive;
  }

  private static isCandidateForReference(type: Primitive, sample: unknown): boolean {
    // Long strings and buffers are not good candidates for references as those are probably
    // either text or binary data.
    // We use a length of 16 for buffers and 36 for text as it's the length of a UUID (respectively
    // in binary and string format).
    return (
      type === 'null' ||
      type === 'ObjectId' ||
      (type === 'Binary' && (sample as Binary).length() <= 16) ||
      (type === 'string' && (sample as string).length <= 36)
    );
  }
}
