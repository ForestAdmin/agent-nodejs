import { PrimitiveTypes } from './interfaces/schema';

export type Primitive = 'Null' | 'Object' | 'Array' | PrimitiveTypes;

export type NodeStudy = {
  types: Partial<Record<Primitive, number>>;
  seen: number;
  object?: Record<string, NodeStudy>;
  arrayElement?: NodeStudy;
  isReferenceCandidate: boolean;
  referenceSamples?: Set<unknown>;
};

export class RecordAnalyzer {
  static createNode(): NodeStudy {
    return { types: {}, seen: 0, isReferenceCandidate: true, referenceSamples: new Set() };
  }

  static walkNode(node: NodeStudy, sample: unknown, referenceSampleSize: number): void {
    if (Array.isArray(sample)) this.walkArrayNode(node, sample, referenceSampleSize);
    if (sample?.constructor === Object)
      this.walkObjectNode(node, sample as Record<string, unknown>, referenceSampleSize);

    this.annotateNode(node, sample, referenceSampleSize);
  }

  private static walkArrayNode(
    node: NodeStudy,
    sample: unknown[],
    referenceSampleSize: number,
  ): void {
    if (!node.arrayElement) node.arrayElement = this.createNode();
    for (const subSample of sample)
      this.walkNode(node.arrayElement, subSample, referenceSampleSize);
  }

  private static walkObjectNode(
    node: NodeStudy,
    sample: Record<string, unknown>,
    referenceSampleSize: number,
  ): void {
    if (!node.object) node.object = {};

    for (const [key, subSample] of Object.entries(sample)) {
      if (!node.object[key]) node.object[key] = this.createNode();
      this.walkNode(node.object[key], subSample, referenceSampleSize);
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
        if (sample && node.referenceSamples.size < referenceSampleSize)
          node.referenceSamples.add(sample);
      } else {
        node.isReferenceCandidate = false;
        delete node.referenceSamples;
      }
    }
  }

  private static getSampleType(sample: unknown): Primitive {
    if (sample === null) return 'Null';
    if (sample instanceof Buffer) return 'Binary';
    if (sample instanceof Date) return 'Date';
    if (Array.isArray(sample)) return 'Array';
    if (sample?.constructor === Object) return 'Object';

    const type = typeof sample;

    return (type[0].toUpperCase() + type.slice(1)) as Primitive;
  }

  private static isCandidateForReference(type: Primitive, sample: unknown): boolean {
    // Long strings and buffers are not good candidates for references as those are probably
    // either text or binary data.
    // We use a length of 16 for buffers and 36 for text as it's the length of a UUID (respectively
    // in binary and string format).
    return (
      type === 'Null' ||
      type === 'Number' ||
      (type === 'Binary' && (sample as Buffer).length <= 16) ||
      (type === 'String' && (sample as string).length <= 36)
    );
  }
}
