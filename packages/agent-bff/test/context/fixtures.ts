import type {
  ForestSchemaAction,
  ForestSchemaCollection,
  ForestSchemaField,
} from '@forestadmin/forestadmin-client';

function field(name: string, type: unknown, extra: Partial<ForestSchemaField> = {}) {
  return {
    field: name,
    type,
    enum: null,
    reference: null,
    isReadOnly: false,
    isRequired: false,
    isPrimaryKey: name === 'id',
    ...extra,
  } as ForestSchemaField;
}

function action(
  name: string,
  type: ForestSchemaAction['type'],
  endpoint: string | undefined,
  fields: ForestSchemaAction['fields'] = [],
) {
  return {
    id: `${name}-id`,
    name,
    type,
    endpoint,
    download: false,
    fields,
    hooks: { load: false, change: [] },
  } as ForestSchemaAction;
}

export default function schemaCoveringEveryContractShape(): ForestSchemaCollection[] {
  return [
    {
      name: 'users',
      fields: [
        field('id', 'Uuid'),
        field('tagsWithArrayType', ['String']),
        field('addressWithCompositeType', { fields: [{ field: 'city', type: 'String' }] }),
        field('lockedReadOnly', 'Boolean', { isReadOnly: true }),
        field('emailRequired', 'String', { isRequired: true }),
        field('thumbnailWithPattern', 'String', {
          validations: [
            {
              type: 'is like',
              value: '/^data:.*;base64,.*/',
              message: 'Value must match /^data:.*;base64,.*/',
            },
          ],
        }),
        field('statusWithEnums', 'Enum', {
          enums: ['DRAFT', 'PUBLISHED'],
        } as unknown as Partial<ForestSchemaField>),
        field('statusWithFlaggedPattern', 'Enum', {
          validations: [{ type: 'is like', value: '/^a|b|c$/g', message: 'x' }],
        }),
        field('titleWithPresence', 'String', {
          validations: [{ type: 'is present', message: 'Field is required' }],
        }),
        field('fieldWithMalformedValidations', 'String', {
          validations: [
            null,
            { message: 'no type at all' },
            'garbage',
            { type: 'contains', value: 'ok' },
          ],
        } as unknown as Partial<ForestSchemaField>),
        field('fieldWithNullValidations', 'String', {
          validations: null,
        } as unknown as Partial<ForestSchemaField>),
        field('ordersHasManyWithInverseOf', 'String', {
          reference: 'orders.customerId',
          relationship: 'HasMany',
          inverseOf: 'customer',
        }),
        field('teamBelongsToWithoutInverseOf', 'String', {
          reference: 'teams.id',
          relationship: 'BelongsTo',
        }),
        field('ownerPolymorphic', 'String', {
          relationship: 'BelongsTo',
          polymorphicReferencedModels: ['users', 'teams'],
        }),
      ],
      actions: [
        action('Ban user', 'single', '/forest/users/actions/ban', [
          {
            field: 'reason',
            type: 'Enum',
            isRequired: true,
            defaultValue: 'spam',
            enums: ['spam', 'abuse'],
          },
        ]),
        action('Export all', 'global', '/forest/users/actions/export', [
          { field: 'includeArchived', type: 'Boolean', isRequired: false, defaultValue: false },
          { field: 'limit', type: 'Number', defaultValue: 0 },
          { field: 'since', type: 'Date', defaultValue: null },
          { field: 'format', type: 'Enum', enums: [] },
          {
            field: 'loading',
            type: 'String',
            enums: null,
          } as unknown as ForestSchemaAction['fields'][number],
        ]),
        action('Archive', 'bulk', '/forest/users/actions/archive'),
        action('Endpointless action', 'single', undefined),
      ],
    },
    { name: 'User.address', fields: [field('city', 'String')], actions: [] },
    { name: 'My Coll', fields: [field('id', 'Number')], actions: [] },
    { name: 'collectionWithoutFieldsNorActions' } as ForestSchemaCollection,
  ];
}
