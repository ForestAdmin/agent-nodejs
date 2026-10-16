import type { ManualSchemaConfig } from '../../src/types';

import { convertManualSchema, validateManualSchema } from '../../src/schema/manual-schema';

const config = (overrides: Record<string, unknown> = {}): ManualSchemaConfig => ({
  collections: [
    {
      name: 'orders',
      tableName: 'Orders',
      partitionKey: { name: 'customerId', type: 'string' },
      sortKey: { name: 'orderId', type: 'string' },
      fields: [
        { name: 'total', type: 'number' },
        { name: 'status', type: 'string', nullable: true },
        {
          name: 'address',
          type: 'object',
          fields: [
            { name: 'city', type: 'string' },
            { name: 'geo', type: 'object', fields: [{ name: 'lat', type: 'number' }] },
          ],
        },
        { name: 'tags', type: 'array', subType: 'string' },
      ],
      ...overrides,
    },
  ],
});

describe('convertManualSchema', () => {
  it('builds a table model from the definition', () => {
    const [model] = convertManualSchema(config());

    expect(model).toMatchObject({
      name: 'orders',
      tableName: 'Orders',
      partitionKey: { name: 'customerId', type: 'S' },
      sortKey: { name: 'orderId', type: 'S' },
      indexes: [],
    });
  });

  it('declares the keys even when they are not listed as fields', () => {
    const [model] = convertManualSchema(config());

    expect(model.schema.customerId).toEqual({ type: 'string', nullable: false });
    expect(model.schema.orderId).toEqual({ type: 'string', nullable: false });
  });

  it('flattens nested objects into arrow-notation fields', () => {
    const [model] = convertManualSchema(config());

    expect(model.schema['address->city']).toEqual({ type: 'string', nullable: false });
    expect(model.schema['address->geo->lat']).toEqual({ type: 'number', nullable: false });
    expect(model.schema.address).toBeUndefined();
  });

  it('keeps arrays as a single field and remembers their item schema', () => {
    const [model] = convertManualSchema(
      config({
        fields: [
          {
            name: 'lines',
            type: 'array',
            subType: 'object',
            fields: [{ name: 'sku', type: 'string' }],
          },
        ],
      }),
    );

    expect(model.schema.lines).toEqual({
      type: 'array',
      nullable: false,
      items: { sku: { type: 'string', nullable: false } },
    });
  });

  it('types numeric keys as N', () => {
    const [model] = convertManualSchema(
      config({ partitionKey: { name: 'id', type: 'number' }, sortKey: undefined }),
    );

    expect(model.partitionKey).toEqual({ name: 'id', type: 'N' });
    expect(model.schema.id).toEqual({ type: 'number', nullable: false });
  });

  it('carries indexes, entity, count and scan settings', () => {
    const [model] = convertManualSchema(
      config({
        indexes: [
          {
            name: 'by-status',
            type: 'GSI',
            partitionKey: { name: 'status', type: 'string' },
            sortKey: { name: 'createdAt', type: 'string' },
          },
        ],
        entity: { sortKeyPrefix: 'ORDER#' },
        enableCount: false,
        scanPolicy: 'deny',
        maxScannedItems: 50,
      }),
    );

    expect(model.indexes).toEqual([
      {
        name: 'by-status',
        type: 'GSI',
        partitionKey: { name: 'status', type: 'S' },
        sortKey: { name: 'createdAt', type: 'S' },
        projectsAllAttributes: true,
        coversAllItems: false,
      },
    ]);
    expect(model).toMatchObject({
      entity: { sortKeyPrefix: 'ORDER#' },
      enableCount: false,
      scanPolicy: 'deny',
      maxScannedItems: 50,
    });
  });
});

describe('keys and fields of the same name', () => {
  it('keeps the type configured for the key', () => {
    const [model] = convertManualSchema(
      config({
        partitionKey: { name: 'id', type: 'number' },
        sortKey: undefined,
        fields: [{ name: 'id', type: 'string' }],
      }),
    );

    expect(model.schema.id).toEqual({ type: 'number', nullable: false });
  });
});

describe('validateManualSchema', () => {
  it('accepts a valid schema', () => {
    expect(() => validateManualSchema(config())).not.toThrow();
  });

  it.each([
    [{ collections: [] }, 'Manual schema must have at least one collection'],
    [undefined, 'Manual schema must have a collections array'],
  ])('rejects %p', (schema, message) => {
    expect(() => validateManualSchema(schema as never)).toThrow(message);
  });

  it('rejects a collection without table name', () => {
    expect(() => validateManualSchema(config({ tableName: undefined }))).toThrow(
      "Collection 'orders' must have a tableName",
    );
  });

  it('rejects a collection without partition key', () => {
    expect(() => validateManualSchema(config({ partitionKey: undefined }))).toThrow(
      "Collection 'orders' must have a partitionKey",
    );
  });

  it('rejects a sort key named like the partition key', () => {
    expect(() =>
      validateManualSchema(config({ sortKey: { name: 'customerId', type: 'string' } })),
    ).toThrow("Collection 'orders' uses 'customerId' as both partition key and sort key");
  });

  it('rejects a key type other than string or number', () => {
    expect(() =>
      validateManualSchema(config({ partitionKey: { name: 'customerId', type: 'object' } })),
    ).toThrow("Key 'customerId' of collection 'orders' must be a string or a number");
  });

  it('rejects duplicate collection names', () => {
    const duplicated = config();
    duplicated.collections.push({ ...duplicated.collections[0] });

    expect(() => validateManualSchema(duplicated)).toThrow("Duplicate collection name: 'orders'");
  });

  it('rejects duplicate field names at the same level', () => {
    expect(() =>
      validateManualSchema(
        config({
          fields: [
            { name: 'a', type: 'string' },
            { name: 'a', type: 'number' },
          ],
        }),
      ),
    ).toThrow("Duplicate field name: 'a' in collection 'orders'");
  });

  it('rejects an unknown field type', () => {
    expect(() => validateManualSchema(config({ fields: [{ name: 'a', type: 'uuid' }] }))).toThrow(
      "Field 'a' in collection 'orders' has invalid type 'uuid'",
    );
  });

  it('rejects an array without sub type', () => {
    expect(() => validateManualSchema(config({ fields: [{ name: 'a', type: 'array' }] }))).toThrow(
      "Array field 'a' in collection 'orders' must have a subType",
    );
  });

  it('rejects an object without nested fields', () => {
    expect(() => validateManualSchema(config({ fields: [{ name: 'a', type: 'object' }] }))).toThrow(
      "Object field 'a' in collection 'orders' must have nested field definitions",
    );
  });

  it('rejects a sort key prefix on a table without sort key', () => {
    expect(() =>
      validateManualSchema(config({ sortKey: undefined, entity: { sortKeyPrefix: 'X#' } })),
    ).toThrow("Collection 'orders' has no sortKey, so 'entity.sortKeyPrefix' cannot be used");
  });

  it('rejects an entity naming both a discriminator and a prefix', () => {
    expect(() =>
      validateManualSchema(
        config({ entity: { attribute: 'type', value: 'O', sortKeyPrefix: 'ORDER#' } }),
      ),
    ).toThrow("Collection 'orders' entity must use either 'attribute'/'value' or 'sortKeyPrefix'");
  });

  it('rejects an unknown scan policy', () => {
    expect(() => validateManualSchema(config({ scanPolicy: 'sometimes' }))).toThrow(
      "Collection 'orders' has an invalid scanPolicy 'sometimes'",
    );
  });
});
