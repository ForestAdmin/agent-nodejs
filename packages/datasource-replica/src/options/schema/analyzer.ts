/* eslint-disable @typescript-eslint/no-use-before-define */
import { PrimitiveTypes } from '@forestadmin/datasource-toolkit/src/interfaces/schema';

export type Primitive = 'Null' | 'Object' | 'Array' | 'Integer' | PrimitiveTypes;

export type NodeStudy = {
  types: Partial<Record<Primitive, number>>;
  seen: number;
  object?: Record<string, NodeStudy>;
  arrayElement?: NodeStudy;
};

export function createNode(): NodeStudy {
  return { types: {}, seen: 0 };
}

export function walkNode(node: NodeStudy, sample: unknown): void {
  if (Array.isArray(sample)) walkArrayNode(node, sample);
  if (sample?.constructor === Object) walkObjectNode(node, sample as Record<string, unknown>);

  annotateNode(node, sample);
}

function walkArrayNode(node: NodeStudy, sample: unknown[]): void {
  if (!node.arrayElement) node.arrayElement = createNode();
  for (const subSample of sample) walkNode(node.arrayElement, subSample);
}

function walkObjectNode(node: NodeStudy, sample: Record<string, unknown>): void {
  if (!node.object) node.object = {};

  for (const [key, subSample] of Object.entries(sample)) {
    if (!node.object[key]) node.object[key] = createNode();
    walkNode(node.object[key], subSample);
  }
}

function annotateNode(node: NodeStudy, sample: unknown): void {
  const type = getSampleType(sample);

  // Increment counters
  node.seen += 1;
  node.types[type] = (node.types[type] || 0) + 1;
}

function getSampleType(sample: unknown): Primitive {
  if (sample === null) return 'Null';
  if (sample instanceof Buffer) return 'Binary';
  if (sample instanceof Date) return 'Date';
  if (Array.isArray(sample)) return 'Array';
  if (sample?.constructor === Object) return 'Object';
  if (Number.isInteger(sample)) return 'Integer';

  const type = typeof sample;

  return (type[0].toUpperCase() + type.slice(1)) as Primitive;
}
