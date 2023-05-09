import ReferenceCandidateFinder from './reference-candidates-finder';
import ReferenceCandidateVerifier from './reference-candidates-verifier';
import Structure from './structure';
import { ModelStudy, ModelStudyDef, MongoDb, NodeStudy, NodeStudyDef, PrimitiveDef } from './types';
import { IntrospectOptions } from '../type';

export default class Introspector {
  static async introspect(
    connection: MongoDb,
    options?: IntrospectOptions['introspectionOptions'],
  ): Promise<ModelStudyDef[]> {
    const collectionSampleSize = options?.collectionSampleSize ?? 100;
    const referenceSampleSize = options?.referenceSampleSize ?? 10;
    const maxProps = options?.maxPropertiesPerObject ?? 30;
    if (collectionSampleSize < 1) throw new Error('collectionSampleSize must be at least 1');
    if (referenceSampleSize < 0) throw new Error('referenceSampleSize must be at least 0');
    if (maxProps < 1) throw new Error('maxPropertiesPerObject must be at least 1');

    const structure = await Structure.introspect(
      connection,
      collectionSampleSize,
      referenceSampleSize,
    );

    const references = await this.findReferences(connection, structure);

    return structure
      .map(({ name, analysis }) => ({
        name,
        analysis: this.convert(analysis, references, maxProps),
      }))
      .sort(({ name: name1 }, { name: name2 }) => name1.localeCompare(name2));
  }

  private static async findReferences(
    connection: MongoDb,
    introspection: ModelStudy[],
  ): Promise<Map<NodeStudy, string>> {
    // Build a list of candidates by model.
    const candidatesByModel = ReferenceCandidateFinder.findCandidates(introspection);

    // Filter out all candidates where references can't be found
    const referencesByModel = await ReferenceCandidateVerifier.filterCandidates(
      connection,
      candidatesByModel,
    );

    // Build a map of references by node
    const referencesByNode = new Map<NodeStudy, string>();
    for (const [modelName, nodes] of Object.entries(referencesByModel))
      for (const node of nodes) referencesByNode.set(node, modelName);

    return referencesByNode;
  }

  private static convert(
    node: NodeStudy,
    references: Map<NodeStudy, string>,
    maxProps: number,
  ): NodeStudyDef {
    const type = this.getNodeType(node, maxProps);
    const nullable = 'null' in node.types;
    const referenceTo = references.get(node);
    const defNode: NodeStudyDef = { type, nullable, referenceTo };

    if (type === 'array')
      defNode.arrayElement = this.convert(node.arrayElement, references, maxProps);

    if (type === 'object')
      defNode.object = Object.fromEntries(
        Object.entries(node.object)
          .map(([k, v]) => [k, this.convert(v, references, maxProps)] as [string, NodeStudyDef])
          .sort(([k1], [k2]) => k1.localeCompare(k2)),
      );

    return defNode;
  }

  private static getNodeType(node: NodeStudy, maxProps: number): PrimitiveDef {
    let type: PrimitiveDef = 'Mixed';

    // If there is only one type, it's the type of the node
    const nonNullTypes = Object.keys(node.types).filter(t => t !== 'null') as PrimitiveDef[];
    if (nonNullTypes.length === 1) [type] = nonNullTypes;

    // If the node only contains empty objects, it's a Mixed, as it could be anything
    if (type === 'object' && Object.keys(node.object).length === 0) type = 'Mixed';

    // If the node contains more than maxProps keys, it's a Mixed, as it probably uses
    // dynamic keys
    if (type === 'object' && Object.keys(node.object).length > maxProps) type = 'Mixed';

    return type;
  }
}
