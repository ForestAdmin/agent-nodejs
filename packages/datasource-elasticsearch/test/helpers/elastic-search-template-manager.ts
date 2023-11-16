import { Client } from '@elastic/elasticsearch';

import ELASTICSEARCH_URL from './connection-details';

type Data = Record<string, unknown> & { index: string };

export async function createElasticsearchTemplate(
  template: string,
  config: { indexPattern: string; mapping: unknown; alias: string },
  data?: Data[],
) {
  const client = new Client({ node: ELASTICSEARCH_URL });

  await client.indices.putTemplate({
    name: template,
    body: {
      index_patterns: [config.indexPattern],
      mappings: config.mapping,
      aliases: {
        [config.alias]: {},
      },
    },
  });

  if (data) {
    const body = data.flatMap(({ index, ...doc }) => [{ index: { _index: index } }, doc]);
    await client.bulk({ refresh: true, body });
  }

  return client;
}

export async function deleteElasticsearchTemplate(template: string, indexPattern: string) {
  const client = new Client({ node: ELASTICSEARCH_URL });

  // Delete Template
  await client.indices.deleteTemplate({
    name: template,
  });

  // Delete Indices
  const indicesResponse = await client.cat.indices({
    index: indexPattern,
    format: 'json',
  });

  const indicesToDelete = indicesResponse.body.map(indices => indices.index);

  await Promise.all(indicesToDelete.map(name => client.indices.delete({ index: name })));
}
