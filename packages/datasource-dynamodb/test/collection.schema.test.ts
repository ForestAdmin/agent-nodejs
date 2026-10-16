import { buildCollection } from './collection-helpers';
import { buildModel, buildSimpleModel } from './helpers';

describe('DynamoDBCollection schema', () => {
  it('marks the partition key and the sort key as the composite primary key', () => {
    const { collection } = buildCollection(buildModel(), {});

    expect(collection.schema.fields.customerId).toMatchObject({
      type: 'Column',
      columnType: 'String',
      isPrimaryKey: true,
    });
    expect(collection.schema.fields.orderId).toMatchObject({ isPrimaryKey: true });
    expect(collection.schema.fields.status).toMatchObject({ isPrimaryKey: false });
  });

  it('marks a lone partition key as the primary key', () => {
    const { collection } = buildCollection(buildSimpleModel(), {});

    expect(collection.schema.fields.id).toMatchObject({ isPrimaryKey: true });
  });

  it('types a numeric key as a Number', () => {
    const { collection } = buildCollection(
      buildSimpleModel({
        partitionKey: { name: 'id', type: 'N' },
        schema: { id: { type: 'number' } },
      }),
      {},
    );

    expect(collection.schema.fields.id).toMatchObject({ columnType: 'Number', isPrimaryKey: true });
  });

  it('maps inferred types to column types', () => {
    const { collection } = buildCollection(buildModel(), {});

    expect(collection.schema.fields.total).toMatchObject({ columnType: 'Number' });
    expect(collection.schema.fields.createdAt).toMatchObject({ columnType: 'Date' });
  });

  it('exposes nested attributes as arrow-notation columns', () => {
    const { collection } = buildCollection(
      buildSimpleModel({
        schema: { id: { type: 'string' }, 'address->city': { type: 'string' } },
      }),
      {},
    );

    expect(collection.schema.fields['address->city']).toMatchObject({ columnType: 'String' });
  });

  it('does not allow sorting on Json columns', () => {
    const { collection } = buildCollection(
      buildSimpleModel({ schema: { id: { type: 'string' }, meta: { type: 'object' } } }),
      {},
    );

    expect(collection.schema.fields.meta).toMatchObject({ columnType: 'Json', isSortable: false });
  });

  it('is countable by default and not searchable natively', () => {
    const { collection } = buildCollection(buildModel(), {});

    expect(collection.schema.countable).toBe(true);
    expect(collection.schema.searchable).toBe(false);
  });

  it('can disable the count', () => {
    const { collection } = buildCollection(buildModel({ enableCount: false }), {});

    expect(collection.schema.countable).toBe(false);
  });

  it('lets the user override a generated column', () => {
    const { collection } = buildCollection(
      buildModel({
        overrideTypeConverter: ({ fieldName, generatedFieldSchema }) =>
          fieldName === 'status'
            ? ({
                ...generatedFieldSchema,
                columnType: 'Enum',
                enumValues: ['paid', 'open'],
              } as never)
            : undefined,
      }),
      {},
    );

    expect(collection.schema.fields.status).toMatchObject({
      columnType: 'Enum',
      enumValues: ['paid', 'open'],
    });
  });

  it('skips a column it cannot type and logs it', () => {
    const { collection, logger } = buildCollection(
      buildSimpleModel({ schema: { id: { type: 'string' }, weird: { type: 'nope' as never } } }),
      {},
    );

    expect(collection.schema.fields.weird).toBeUndefined();
    expect(logger).toHaveBeenCalledWith(
      'Warn',
      expect.stringContaining("Skipping column 'users.weird'"),
    );
  });
});
