// eslint-disable-next-line max-classes-per-file
import { Client } from '@elastic/elasticsearch';
import { Logger } from '@forestadmin/datasource-toolkit';

import ModelElasticsearch from '../model-builder/model';

export default class Introspector {
  static async introspect(
    elasticsearchClient: Client,
    logger?: Logger,
  ): Promise<ModelElasticsearch[]> {
    logger('Info', 'Introspector - Introspect Elasticsearch');

    return Introspector.introspectAll(elasticsearchClient, logger);
  }

  private static async introspectAll(
    elasticsearchClient: Client,
    logger?: Logger,
  ): Promise<ModelElasticsearch[]> {
    const results = [];
    /**
     * Get all templates information
     */
    const allTemplates = await elasticsearchClient.cat.templates({
      name: '*',
      format: 'json',
    });

    /**
     * Remove elasticsearch templates - TODO make this optional
     */
    const userTemplates = allTemplates.body.filter(
      ({ name }) =>
        !/^(ilm-history|synthetics|metrics|logs|.+_audit_log|.+-index-template|\..+)$/.test(name),
    );

    /**
     * Get all templates information
     */
    for (const userTemplate of userTemplates) {
      // eslint-disable-next-line no-await-in-loop
      const template = await elasticsearchClient.indices.getTemplate({
        name: userTemplate.name,
      });
      const name = Object.keys(template.body)[0];

      const templateInformation = template.body[name];

      const indexPatterns = templateInformation.index_patterns;
      const aliases = Object.keys(templateInformation.aliases);
      const mapping = templateInformation.mappings;
      // settings refresh_interval?

      results.push(
        new ModelElasticsearch(elasticsearchClient, name, indexPatterns, aliases, mapping),
      );
    }

    logger?.('Info', 'Introspector - All templates loaded');

    return results;
  }
}
