import type AgentWithLog from './agent-with-log';
import type { Id } from '../ports/agent-port';
import type SchemaResolver from '../schema-resolver';
import type {
  CollectionSchema,
  FieldSchema,
  RecordData,
  RecordRef,
} from '../types/validated/collection';

import {
  ActivityLogCreationError,
  AgentPortError,
  InvalidPreRecordedArgsError,
  RecordNotFoundError,
} from '../errors';

export type RelationPathHop = { relationDisplayName: string; collectionDisplayName: string };

export type RelationPathResolution =
  | { status: 'found'; record: RecordRef; values: Record<string, unknown> }
  | { status: 'empty'; hops: RelationPathHop[] }
  | { status: 'forbidden'; collectionDisplayName: string };

const FORBIDDEN_AGENT_STATUSES: ReadonlySet<number> = new Set([401, 403]);

function isAccessDenied(error: unknown): boolean {
  if (error instanceof AgentPortError) {
    return error.httpStatus !== undefined && FORBIDDEN_AGENT_STATUSES.has(error.httpStatus);
  }

  return (
    error instanceof ActivityLogCreationError &&
    (error.cause as { reason?: unknown } | undefined)?.reason === 'notAuthorized'
  );
}

function findToOneRelation(
  schema: CollectionSchema,
  relationName: string,
): FieldSchema & { relatedCollectionName: string } {
  const field = schema.fields.find(f => f.isRelationship && f.fieldName === relationName);
  const isToMany = field?.relationType === 'HasMany' || field?.relationType === 'BelongsToMany';

  if (!field?.relatedCollectionName || isToMany) {
    throw new InvalidPreRecordedArgsError(
      `"${relationName}" is not a to-one relation of "${schema.collectionName}"`,
    );
  }

  return field as FieldSchema & { relatedCollectionName: string };
}

// Each hop reads only the next link's id, and the target alone is read in full at the end, so a
// path of n relations costs n + 1 agent calls. Every read goes through the by-id route, which
// applies the caller's scope: a record on the path the caller cannot see answers 404.
export default async function followRelationPath(
  { agent, schemaResolver }: { agent: AgentWithLog; schemaResolver: SchemaResolver },
  root: RecordRef,
  relationPath: readonly string[],
  targetFields?: readonly string[],
): Promise<RelationPathResolution> {
  const hops: RelationPathHop[] = [];
  let current = root;
  let currentSchema = await schemaResolver.resolve(root.collectionName);

  for (const relationName of relationPath) {
    const relation = findToOneRelation(currentSchema, relationName);
    // eslint-disable-next-line no-await-in-loop
    const relatedSchema = await schemaResolver.resolve(relation.relatedCollectionName);
    hops.push({
      relationDisplayName: relation.displayName,
      collectionDisplayName: relatedSchema.collectionDisplayName,
    });

    let relatedId: Id[] | null;

    try {
      // eslint-disable-next-line no-await-in-loop
      relatedId = await agent.getRelatedRecordId({
        collection: current.collectionName,
        id: current.recordId,
        relation: relationName,
        relatedSchema,
      });
    } catch (error) {
      // The agent refuses a projection on the collection it ends on (`customer:id` needs read on
      // customers), and the hop's own collection was already read by the hop before it.
      if (isAccessDenied(error)) {
        return { status: 'forbidden', collectionDisplayName: relatedSchema.collectionDisplayName };
      }

      // The root is the step's own source, so losing it stays an error; a record further down the
      // path that the caller cannot read is the record the previous hop found missing.
      if (error instanceof RecordNotFoundError && current !== root) {
        return { status: 'empty', hops: hops.slice(0, -1) };
      }

      throw error;
    }

    if (relatedId === null) return { status: 'empty', hops };

    current = {
      collectionName: relatedSchema.collectionName,
      recordId: relatedId,
      stepIndex: root.stepIndex,
    };
    currentSchema = relatedSchema;
  }

  let target: RecordData;

  try {
    target = await agent.getRecord({
      collection: current.collectionName,
      id: current.recordId,
      fields: targetFields?.length ? [...targetFields] : [currentSchema.primaryKeyFields[0]],
    });
  } catch (error) {
    if (isAccessDenied(error)) {
      return { status: 'forbidden', collectionDisplayName: currentSchema.collectionDisplayName };
    }

    if (error instanceof RecordNotFoundError) return { status: 'empty', hops };

    throw error;
  }

  return { status: 'found', record: current, values: target.values };
}
