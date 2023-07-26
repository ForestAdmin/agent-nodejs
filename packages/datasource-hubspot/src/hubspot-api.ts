import { Logger, UnprocessableError } from '@forestadmin/datasource-toolkit';
import { Client } from '@hubspot/api-client';

import { CONTACTS, HUBSPOT_COLLECTIONS, HUBSPOT_MAX_PAGE_SIZE } from './constants';
import { getRelatedManyToManyNames } from './relationships';
import { FieldPropertiesByCollection, Records } from './types';
import { retryIfLimitReached } from './utils';

function handleErrors(error: Error & { code: number }) {
  if (error.code === 429) {
    throw new UnprocessableError(
      'You have reached the limit of allowed requests. ' +
        'If this message continues to appear, please consider adding ' +
        'or increasing your pull delta/dump scheduling.',
    );
  } else if (error.code === 502 || error.code === 504) {
    throw new UnprocessableError('The request to hubspot has timeout.');
  } else {
    throw error;
  }
}

function handleFieldPropertiesErrors(
  error: Error & { code: number },
  collectionName: string,
  logger?: Logger,
) {
  if (error.code === 403) {
    logger?.('Warn', `Unable to get properties for collection "${collectionName}".`);
  } else {
    handleErrors(error);
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

function isDefaultCollection(collectionName: string): boolean {
  return HUBSPOT_COLLECTIONS.includes(collectionName);
}

export async function fetchRecordsAndRelationships(
  client: Client,
  collectionName: string,
  properties: string[],
  relationNames?: string[],
  afterId?: string,
): Promise<{ [collectionName: string]: Records }> {
  const relations = relationNames?.length > 0 ? relationNames : undefined;
  let response;

  try {
    response = await retryIfLimitReached(
      async () => {
        if (isDefaultCollection(collectionName)) {
          return getDiscovery(client, collectionName).basicApi.getPage(
            HUBSPOT_MAX_PAGE_SIZE,
            afterId,
            properties,
            undefined,
            relations,
          );
        }

        return client.crm.objects.basicApi.getPage(
          collectionName,
          HUBSPOT_MAX_PAGE_SIZE,
          afterId,
          properties,
          undefined,
          relations,
        );
      },
      10,
      1000,
    );
  } catch (e) {
    handleErrors(e);
  }

  return response.results.reduce((records, collectionResult) => {
    // get the record
    records[collectionName] = records[collectionName] ?? [];
    records[collectionName].push({ id: collectionResult.id, ...collectionResult.properties });

    // get its relations
    relationNames?.forEach(relationName => {
      // the relation name is returned with an prefix id when it is a custom collection
      // that's why we search the relation using 'includes' instead of '==='
      // Ex: 'myCustomRelation' => 'p15165454_myCustomRelation'
      const relationNameWithPrefixId = Object.keys(collectionResult.associations ?? {}).find(
        relation => relation.includes(relationName),
      );
      if (!relationNameWithPrefixId) return;

      const pairsToSave = new Set();
      collectionResult.associations?.[relationNameWithPrefixId].results.forEach(relationResult => {
        // the relation are duplicated when there are a label
        // we need to save only one
        const pairToSave = `${collectionResult.id}-${relationResult.id}`;
        if (pairsToSave.has(pairToSave)) return;

        pairsToSave.add(pairToSave);
        const [manyToMany] = getRelatedManyToManyNames(collectionName, [
          collectionName,
          relationName,
        ]);
        if (!records[manyToMany]) records[manyToMany] = [];
        // build the relation as many to many
        records[manyToMany].push({
          [`${collectionName}_id`]: collectionResult.id,
          [`${relationName}_id`]: relationResult.id,
        });
      });
    });

    return records;
  }, []);
}

export async function fetchExistingRecordIds(
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

  try {
    if (isDefaultCollection(collectionName)) {
      response = await getDiscovery(client, collectionName).searchApi.doSearch(filter);
    } else {
      response = await client.crm.objects.searchApi.doSearch(collectionName, filter as any);
    }
  } catch (e) {
    handleErrors(e);
  }

  return response.results.map(r => r.id);
}

export async function getLastModifiedRecords(
  client: Client,
  collectionName: string,
  fields: string[],
  lastModifiedDate?: string,
): Promise<Records> {
  const propertyName = collectionName === CONTACTS ? 'lastmodifieddate' : 'hs_lastmodifieddate';
  const filter = {
    filterGroups: lastModifiedDate
      ? [
          {
            filters: [{ propertyName, operator: 'GT', value: lastModifiedDate }],
          },
        ]
      : [],
    sorts: [propertyName],
    properties: fields,
    limit: HUBSPOT_MAX_PAGE_SIZE,
    after: 0,
  };
  let response;

  try {
    if (isDefaultCollection(collectionName)) {
      response = await getDiscovery(client, collectionName).searchApi.doSearch(filter);
    } else {
      response = await client.crm.objects.searchApi.doSearch(collectionName, filter as any);
    }
  } catch (e) {
    handleErrors(e);
  }

  return response.results.map(r =>
    Object.fromEntries([
      ['id', r.id],
      ...fields.map(f => [f, r.properties[f]]),
      // this field is used to save the last modified date for the state
      [
        'temporaryLastModifiedDate',
        collectionName === CONTACTS
          ? r.properties.lastmodifieddate
          : r.properties.hs_lastmodifieddate ?? r.properties.lastmodifieddate,
      ],
    ]),
  );
}

export async function fetchRelationshipsOfRecord(
  client: Client,
  recordId: string,
  collectionName: string,
  relationNames: string[],
): Promise<{ [relationName: string]: string[] }> {
  let response;
  const relations = relationNames.length > 0 ? relationNames : undefined;

  try {
    response = await retryIfLimitReached(
      async () => {
        if (isDefaultCollection(collectionName)) {
          return getDiscovery(client, collectionName).basicApi.getById(
            recordId,
            undefined,
            undefined,
            relations,
          );
        }

        return client.crm.objects.basicApi.getById(
          collectionName,
          recordId,
          undefined,
          undefined,
          relations,
        );
      },
      10,
      1000,
    );
  } catch (e) {
    handleErrors(e);
  }

  return Object.entries(response.associations ?? {}).reduce((acc, [relationName, relation]) => {
    let computedRelationName = relationName;

    // if match p{portal_id}_{relation_name}
    // example: p15165454_relation_name
    if (computedRelationName.match(/^p\d+_/)) {
      // remove the p{portal_id}_ prefix
      computedRelationName = computedRelationName.replace(/^p\d+_/, '');
    }

    const ids = (relation as any).results.map(r => r.id);
    // using set to remove duplicated ids when the relation has a label
    acc[computedRelationName] = Array.from(new Set(ids));

    return acc;
  }, {});
}

export async function fetchFieldsPropertiesByCollection(
  client: Client,
  collections: string[],
  logger?: Logger,
): Promise<FieldPropertiesByCollection> {
  const fieldsByCollection = {};

  const promises = collections.map(async collectionName => {
    try {
      const { results } = await client.crm.properties.coreApi.getAll(collectionName, false);
      fieldsByCollection[collectionName] = results;
    } catch (e) {
      handleFieldPropertiesErrors(e, collectionName, logger);
    }
  });

  const fetchCustomCollections = async (): Promise<void> => {
    try {
      const customCollections = await client.crm.schemas.coreApi.getAll(false);
      customCollections.results.forEach(collection => {
        fieldsByCollection[collection.name] = collection.properties;
      });
    } catch (e) {
      handleFieldPropertiesErrors(e, 'custom collection', logger);
    }
  };

  await Promise.all([...promises, fetchCustomCollections()]);

  return fieldsByCollection;
}
