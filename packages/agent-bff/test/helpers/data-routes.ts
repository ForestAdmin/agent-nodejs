import type { AgentTransport } from '../../src/agent/agent-transport';
import type { AgentDispatchRequest } from '@forestadmin/agent-client';

import { AgentHttpError } from '@forestadmin/agent-client';

type AgentQuery = Record<string, unknown>;

export interface AgentReads {
  list(collection: string, query: AgentQuery): Promise<Record<string, unknown>[]>;
  countRaw(collection: string, query: AgentQuery): Promise<unknown>;
  listRelation(
    collection: string,
    parentId: string,
    relation: string,
    query: AgentQuery,
  ): Promise<Record<string, unknown>[]>;
  countRelationRaw(
    collection: string,
    parentId: string,
    relation: string,
    query: AgentQuery,
  ): Promise<unknown>;
}

const RELATION_PATH = /^\/forest\/([^/]+)\/(.+)\/relationships\/([^/]+?)(\/count)?$/;
const COLLECTION_PATH = /^\/forest\/([^/]+?)(\/count)?$/;

export const AGENT_URL = 'https://agent.example.com';

export function transportOf(reads: Partial<AgentReads>): AgentTransport & {
  dispatcher: { request: jest.Mock };
} {
  const read = async (path: string, agentQuery: AgentQuery) => {
    const relation = RELATION_PATH.exec(path);

    if (relation) {
      const [, collection, parentId, name, isCount] = relation;
      const readRelation = isCount ? reads.countRelationRaw : reads.listRelation;

      return readRelation(collection, decodeURIComponent(parentId), name, agentQuery);
    }

    const [, collection, isCount] = COLLECTION_PATH.exec(path);
    const readCollection = isCount ? reads.countRaw : reads.list;

    return readCollection(collection, agentQuery);
  };

  const request = jest.fn(async ({ path, query }: AgentDispatchRequest) => {
    try {
      return { status: 200, body: await read(path, query) };
    } catch (error) {
      if (!(error instanceof AgentHttpError)) throw error;

      return { status: error.status, body: error.body, text: error.responseText };
    }
  });

  return { url: AGENT_URL, dispatcher: { request } };
}
