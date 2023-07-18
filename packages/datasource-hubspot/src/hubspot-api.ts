import { Logger } from '@forestadmin/datasource-toolkit';
import { Client } from '@hubspot/api-client';

import { HUBSPOT_COLLECTIONS, HUBSPOT_MAX_PAGE_SIZE } from './constants';
import { FieldPropertiesByCollection, Records } from './types';

function handleErrors(error: Error & { code: number }, collectionName: string, logger?: Logger) {
  if (error.code === 429) {
    // to much requests
    logger?.(
      'Warn',
      `Unable to get properties for collection ${collectionName}` +
        ' because we have reached the limit of requests in one second. Please try again.',
    );
  } else if (error.code === 403) {
    logger?.('Warn', `Unable to get properties for collection "${collectionName}".`);
  } else {
    throw error;
  }
}

function getDiscovery(client: Client, collectionName: string) {
  if (collectionName === 'feedback_submissions') {
    return client.crm.objects.feedbackSubmissions;
  }

  if (collectionName === 'line_items') {
    return client.crm.lineItems;
  }

  return client.crm[collectionName];
}

function isDefaultCollection(collectionName: string) {
  return HUBSPOT_COLLECTIONS.includes(collectionName);
}

export async function getRecordsAndRelations(
  client: Client,
  collectionName: string,
  relationNames: string[],
  properties: string[],
  afterId?: string,
): Promise<{ [collectionName: string]: Records }> {
  let response;
  const relations = relationNames.length > 0 ? relationNames : undefined;

  if (isDefaultCollection(collectionName)) {
    response = await getDiscovery(client, collectionName).basicApi.getPage(
      HUBSPOT_MAX_PAGE_SIZE,
      afterId,
      properties,
      undefined,
      relations,
    );
  } else {
    response = await client.crm.objects.basicApi.getPage(
      collectionName,
      HUBSPOT_MAX_PAGE_SIZE,
      afterId,
      properties,
      undefined,
      relations,
    );
  }

  return response.results.reduce((records, collectionResult) => {
    // get the record
    records[collectionName] = records[collectionName] ?? [];
    records[collectionName].push({ id: collectionResult.id, ...collectionResult.properties });

    // get its relations
    relationNames.forEach(relationName => {
      if (!collectionResult.associations?.[relationName]) return;
      const pairsToSave = new Set();

      collectionResult.associations?.[relationName].results.forEach(relationResult => {
        const relationManyToMany = `${collectionName}_${relationName}`;
        // the relation are duplicated when there are a label
        // we need to save only one
        const pairToSave = `${collectionResult.id}-${relationResult.id}`;
        if (pairsToSave.has(pairToSave)) return;
        pairsToSave.add(pairToSave);

        records[relationManyToMany] = records[relationManyToMany] ?? [];
        // build the relation as many to many
        records[relationManyToMany].push({
          [`${collectionName}_id`]: collectionResult.id,
          [`${relationName}_id`]: relationResult.id,
        });
      });
    });

    return records;
  }, []);
}

export async function getExistingRecordIds(
  client: Client,
  collectionName: string,
  recordsIds: string[],
): Promise<string[]> {
  const filter = {
    filterGroups: [
      { filters: [{ propertyName: 'hs_object_id', operator: 'IN', values: recordsIds }] },
    ],
    properties: ['hs_object_id'],
    limit: HUBSPOT_MAX_PAGE_SIZE,
    after: 0,
  };
  let response;

  if (isDefaultCollection(collectionName)) {
    response = await getDiscovery(client, collectionName).searchApi.doSearch(filter);
  } else {
    response = await client.crm.objects.searchApi.doSearch(collectionName, filter as any);
  }

  return response.results.map(r => r.id);
}

export async function getLastModifiedRecords(
  client: Client,
  collectionName: string,
  fields: string[],
  lastModifiedDate?: string,
): Promise<Records> {
  const filter = {
    filterGroups: lastModifiedDate
      ? [
          {
            filters: [
              { propertyName: 'hs_lastmodifieddate', operator: 'GT', value: lastModifiedDate },
            ],
          },
        ]
      : [],
    sorts: ['hs_lastmodifieddate'],
    properties: fields,
    limit: HUBSPOT_MAX_PAGE_SIZE,
    after: 0,
  };
  let response;

  if (isDefaultCollection(collectionName)) {
    response = await getDiscovery(client, collectionName).searchApi.doSearch(filter);
  } else {
    response = await client.crm.objects.searchApi.doSearch(collectionName, filter as any);
  }

  return response.results.map(r =>
    Object.fromEntries([
      ['id', r.id],
      ...fields.map(f => [f, r.properties[f]]),
      // this field is used to save the last modified date for the state
      [
        'temporaryLastModifiedDate',
        r.properties.hs_lastmodifieddate ?? r.properties.lastmodifieddate,
      ],
    ]),
  );
}

export async function getAssociatedRelationIds(
  client: Client,
  recordId: string,
  collectionName: string,
  relationNames: string[],
): Promise<{ [relationName: string]: string[] }> {
  let response;
  const relations = relationNames.length > 0 ? relationNames : undefined;

  if (isDefaultCollection(collectionName)) {
    response = await getDiscovery(client, collectionName).basicApi.getById(
      recordId,
      undefined,
      undefined,
      relations,
    );
  } else {
    response = await client.crm.objects.basicApi.getById(
      collectionName,
      recordId,
      undefined,
      undefined,
      relations,
    );
  }

  if (!response.associations) return {};

  return Object.entries(response.associations).reduce((acc, [relationName, relation]) => {
    // using set to remove duplicated ids when the relation has a label
    acc[relationName] = Array.from(new Set((relation as any).results.map(r => r.id)));

    return acc;
  }, {});
}

export async function getFieldsProperties(
  client: Client,
  collections: string[],
  logger?: Logger,
): Promise<FieldPropertiesByCollection> {
  const fieldsByCollection = {};

  const promises = collections.map(async collectionName => {
    try {
      if (isDefaultCollection(collectionName)) {
        const { results: fields } = await client.crm.properties.coreApi.getAll(collectionName);
        fieldsByCollection[collectionName] = fields;
      } else {
        const customCollections = await client.crm.schemas.coreApi.getAll(false);
        customCollections.results.forEach(collection => {
          fieldsByCollection[collection.name] = collection.properties;
        });
      }
    } catch (e) {
      handleErrors(e, collectionName, logger);
    }
  });

  await Promise.all(promises);

  return fieldsByCollection;
}
