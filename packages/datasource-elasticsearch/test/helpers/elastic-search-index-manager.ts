import { Client } from '@elastic/elasticsearch';

import ELASTICSEARCH_URL from './connection-details';

export async function createElasticsearchIndex(index: string, data?: object[]) {
  const client = new Client({ node: ELASTICSEARCH_URL });

  const exists = await client.indices.exists({ index });

  if (!exists.body) {
    await client.indices.create({ index });
  }

  if (data) {
    const body = data.flatMap(doc => [{ index: { _index: index } }, doc]);
    await client.bulk({ refresh: true, body });
  }

  return client;
}

export async function deleteElasticsearchIndex(index: string) {
  const client = new Client({ node: ELASTICSEARCH_URL });
  await client.indices.delete({ index });
}
