import type { AgentTransport } from '../../src/agent/agent-transport';
import type { HttpRequester } from '@forestadmin/agent-client';

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
  createRequester: jest.Mock;
} {
  const query = async ({ path, query: agentQuery }: { path: string; query: AgentQuery }) => {
    const relation = RELATION_PATH.exec(path);

    if (relation) {
      const [, collection, parentId, name, isCount] = relation;
      const read = isCount ? reads.countRelationRaw : reads.listRelation;

      return read(collection, parentId, name, agentQuery);
    }

    const [, collection, isCount] = COLLECTION_PATH.exec(path);
    const read = isCount ? reads.countRaw : reads.list;

    return read(collection, agentQuery);
  };

  return {
    url: AGENT_URL,
    createRequester: jest.fn(() => ({ query } as unknown as HttpRequester)),
  };
}
