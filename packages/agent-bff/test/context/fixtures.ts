import type {
  ForestSchemaAction,
  ForestSchemaCollection,
  ForestSchemaField,
} from '@forestadmin/forestadmin-client';

type WireField = Partial<Omit<ForestSchemaField, 'validations'>> & {
  enums?: string[] | null;
  validations?: unknown;
};

type WireActionField = ForestSchemaAction['fields'][number] | null;

function field(name: string, type: unknown, extra: WireField = {}) {
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
  fields: WireActionField[] = [],
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
        field('matrixWithNestedArrayType', [['String']]),
        field('addressesWithArrayOfComposite', [{ fields: [{ field: 'label', type: 'String' }] }]),
        field('addressWithCompositeType', {
          fields: [
            { field: 'city', type: 'String' },
            { field: 'country', type: 'Enum', enums: ['FR', 'BE'] },
            { field: 'tags', type: ['String'] },
          ],
        }),
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
        }),
        field('statusWithEmptyEnums', 'Enum', {
          enums: [],
        }),
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
        }),
        field('fieldWithNullValidations', 'String', {
          validations: null,
        }),
        field('ordersHasManyWithInverseOf', 'String', {
          reference: 'orders.customerId',
          relationship: 'HasMany',
          inverseOf: 'customer',
        }),
        field('teamBelongsToWithoutInverseOf', 'String', {
          reference: 'teams.id',
          relationship: 'BelongsTo',
        }),
        field('addressBelongsToDottedCollection', 'String', {
          reference: 'User.address.city',
          relationship: 'BelongsTo',
        }),
        field('ownerPolymorphic', 'String', {
          relationship: 'BelongsTo',
          polymorphicReferencedModels: ['users', 'teams'],
        }),
        'garbage' as unknown as ForestSchemaField,
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
          },
        ]),
        action('Archive', 'bulk', '/forest/users/actions/archive', [
          null,
          { field: 'confirm', type: 'Boolean' },
        ]),
        action('Endpointless action', 'single', undefined),
        { ...action('Duplicated', 'single', '/forest/users/actions/dup'), id: 'Duplicated-kept' },
        { ...action('Duplicated', 'single', undefined), id: 'Duplicated-dropped' },
        { ...action('TwiceEndpointed', 'bulk', '/forest/users/actions/twice-a'), id: 'Twice-kept' },
        { ...action('TwiceEndpointed', 'bulk', '/forest/users/actions/twice-b'), id: 'Twice-late' },
      ],
    },
    { name: 'User.address', fields: [field('city', 'String')], actions: [] },
    { name: 'My Coll', fields: [field('id', 'Number')], actions: [] },
    { name: 'collectionWithoutFieldsNorActions' } as ForestSchemaCollection,
  ];
}
