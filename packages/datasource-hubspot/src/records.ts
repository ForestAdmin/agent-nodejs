import { Client } from '@hubspot/api-client';

import { HUBSPOT_MAX_PAGE_SIZE } from './constants';
import { Records } from './types';

function getDiscovery(client: Client, collectionName: string) {
  if (collectionName === 'feedback_submissions') {
    return client.crm.objects.feedbackSubmissions;
  }

  if (collectionName === 'line_items') {
    return client.crm.lineItems;
  }

  return client.crm[collectionName];
}

export async function getAllManyToManyRecords(
  client: Client,
  collectionName: string,
  after?: string,
): Promise<Records> {
  const [from, to] = collectionName.split('_');
  const response = await getDiscovery(client, from).basicApi.getPage(
    HUBSPOT_MAX_PAGE_SIZE,
    after,
    undefined,
    undefined,
    [to],
  );

  // TODO: CHECK IF THERE IS NO ERROR IN THE RESPONSE
  return response.results.reduce((records, fromResult) => {
    fromResult.associations?.[to].results.forEach(toResult => {
      records.push({ [`${from}_id`]: fromResult.id, [`${to}_id`]: toResult.id });
    });

    return records;
  }, []);
}

export async function getRecordsAndRelations(
  client: Client,
  collectionName: string,
  relationNames: string[],
  properties: string[],
  afterId?: string,
): Promise<{ [collectionName: string]: Records }> {
  const response = await getDiscovery(client, collectionName).basicApi.getPage(
    HUBSPOT_MAX_PAGE_SIZE,
    afterId,
    properties,
    undefined,
    relationNames,
  );

  return response.results.reduce((records, collectionResult) => {
    // get the record
    records[collectionName] = records[collectionName] ?? [];
    records[collectionName].push({ id: collectionResult.id, ...collectionResult.properties });

    // get its relations
    relationNames.forEach(relationName => {
      // the is no relation
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

export async function getRecordsByIds(
  client: Client,
  collectionName: string,
  recordsIds: string[],
): Promise<Records> {
  const response = await getDiscovery(client, collectionName).searchApi.doSearch({
    filterGroups: [
      { filters: [{ propertyName: 'hs_object_id', operator: 'IN', values: recordsIds }] },
    ],
    properties: ['hs_object_id'],
    limit: HUBSPOT_MAX_PAGE_SIZE,
  });

  // TODO: CHECK IF THERE IS NO ERROR IN THE RESPONSE
  return response.results.map(r => Object.fromEntries([['id', r.id]]));
}

export async function getLastModifiedRecords(
  client: Client,
  collectionName: string,
  fields: string[],
  lastModifiedDate?: string,
): Promise<Records> {
  const discovery = getDiscovery(client, collectionName);
  const response = await discovery.searchApi.doSearch({
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
  });

  // TODO: CHECK IF THERE IS NO ERROR IN THE RESPONSE
  return response.results.map(r =>
    Object.fromEntries([
      ['id', r.id],
      ...fields.map(f => [f, r.properties[f]]),
      [
        'temporaryLastModifiedDate',
        r.properties.hs_lastmodifieddate ?? r.properties.lastmodifieddate,
      ],
    ]),
  );
}

export async function getRelations(
  client: Client,
  recordId: string,
  collectionName: string,
  relationName: string,
): Promise<string[]> {
  const record = await getDiscovery(client, collectionName).basicApi.getById(
    recordId,
    undefined,
    undefined,
    [relationName],
  );
  if (!record.associations?.[relationName]) return [];

  // using set to remove duplicated ids
  return [...new Set(record.associations?.[relationName].results.map(r => r.id) as string[])];
}
