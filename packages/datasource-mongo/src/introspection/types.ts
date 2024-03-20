import { Connection } from 'mongoose';

export type MongoDb = Connection['db'];
export type MongoCollection = ReturnType<MongoDb['collection']>;

export type ModelStudy = { name: string; analysis: NodeStudy };

export type NodeStudy = {
  types: Partial<Record<Primitive, number>>;
  seen: number;
  object?: Record<string, NodeStudy>;
  arrayElement?: NodeStudy;
  isReferenceCandidate: boolean;
  referenceSamples?: Set<unknown>;
};

export type Primitive =
  | 'null'
  | 'boolean'
  | 'number'
  | 'string'
  | 'array'
  | 'object'
  | 'Binary'
  | 'Date'
  | 'ObjectId';

export type PrimitiveDefinition = Exclude<Primitive, 'null'> | 'Mixed';

export type ModelDefinition = {
  name: string;
  analysis: ModelAnalysis;
};

export type ModelAnalysis = {
  type: PrimitiveDefinition;
  nullable: boolean;
  referenceTo?: string;
  arrayElement?: ModelAnalysis;
  object?: Record<string, ModelAnalysis>;
};

export type Introspection = {
  models: ModelDefinition[];
  version: number;
  source: '@forestadmin/datasource-mongo';
};
