import type { ForestSchemaCollection } from '@forestadmin/forestadmin-client';

import { mapListResponse } from '../../src/data/response-mappers';
import ReadModel from '../../src/read-model/read-model';

const COLLECTION = 'EdgeCompositePk';

function schemaWithKeys(keys: string[]): ForestSchemaCollection[] {
  return [
    {
      name: COLLECTION,
      fields: [
        { field: 'created_at', type: 'Date', isPrimaryKey: false },
        { field: 'payload', type: 'String', isPrimaryKey: false },
        { field: 'seq', type: 'Number', isPrimaryKey: keys.includes('seq') },
        { field: 'tenant_id', type: 'String', isPrimaryKey: keys.includes('tenant_id') },
      ],
    },
  ] as unknown as ForestSchemaCollection[];
}

const ROWS = [
  { tenantId: 'acme', seq: 1 },
  { tenantId: 'acme', seq: 2 },
  { tenantId: 'globex', seq: 1 },
];

function listKeys(keys: string[], idOf: (row: (typeof ROWS)[number]) => string) {
  const primaryKeys = new ReadModel(schemaWithKeys(keys)).getPrimaryKeys(COLLECTION);
  const records = ROWS.map(row => ({ id: idOf(row), ...row, payload: 'p' }));

  return mapListResponse(COLLECTION, records, primaryKeys).data.map(
    ({ __forest: { primaryKey } }) => primaryKey,
  );
}

describe('a (tenant_id, seq) composite primary key, per agent stack', () => {
  it('should unfold both columns on forest-express-sequelize, which packs in declaration order', () => {
    expect(listKeys(['seq', 'tenant_id'], row => `${row.tenantId}|${row.seq}`)).toEqual([
      { seq: 1, tenant_id: 'acme' },
      { seq: 2, tenant_id: 'acme' },
      { seq: 1, tenant_id: 'globex' },
    ]);
  });

  it('should unfold both columns on a v2 agent, which packs in schema order', () => {
    expect(listKeys(['seq', 'tenant_id'], row => `${row.seq}|${row.tenantId}`)).toEqual([
      { seq: 1, tenant_id: 'acme' },
      { seq: 2, tenant_id: 'acme' },
      { seq: 1, tenant_id: 'globex' },
    ]);
  });

  it('should report the single key forest_liana declares when its model narrows the key to one column', () => {
    expect(listKeys(['tenant_id'], row => row.tenantId)).toEqual([
      { tenant_id: 'acme' },
      { tenant_id: 'acme' },
      { tenant_id: 'globex' },
    ]);
  });

  it('should unfold both columns on forest_liana, which serializes a composite key as a JSON array', () => {
    expect(listKeys(['seq', 'tenant_id'], row => JSON.stringify([row.tenantId, row.seq]))).toEqual([
      { seq: 1, tenant_id: 'acme' },
      { seq: 2, tenant_id: 'acme' },
      { seq: 1, tenant_id: 'globex' },
    ]);
  });
});
