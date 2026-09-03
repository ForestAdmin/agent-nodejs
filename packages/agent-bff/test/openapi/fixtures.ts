import type { Unfolding } from '../../src/openapi/unfolding';

/**
 * One snapshot exercising every shape the unfolding has to survive: a name carrying a space, a
 * dotted name, an action name carrying a slash, two action names that collapse to the same
 * identifier, a ManyToOne that is projectable but not filterable, two fields of DIFFERENT types
 * sharing one operator set, a snake_case field the response returns camelCased, a composite key, a
 * parent with no key metadata, and a collection whose capabilities could not be read.
 */
export default function unfoldingFixture(): Unfolding {
  return {
    collections: [
      {
        name: 'My Coll',
        fields: {
          projectable: [
            { name: 'id', type: 'Number' },
            { name: 'email', type: 'String' },
            { name: 'tags', type: ['String'] },
            { name: 'author', type: 'ManyToOne' },
            { name: 'created_at', type: 'Date' },
          ],
          filterable: [
            { name: 'id', operators: ['Equal', 'NotEqual', 'In'] },
            { name: 'email', operators: ['Equal', 'NotEqual', 'In', 'Contains'] },
            { name: 'tags', operators: ['Equal', 'NotEqual', 'In'] },
          ],
          degraded: null,
        },
        primaryKeys: [{ name: 'id', type: 'Number' }],
        relations: [{ name: 'orders', foreignCollection: 'orders' }],
        actions: [
          {
            name: 'Mark as paid/done',
            fields: [
              { name: 'reason', type: 'String', isRequired: true, enums: null, reference: null },
              {
                name: 'kind',
                type: 'Enum',
                isRequired: false,
                enums: ['refund', 'gift'],
                reference: null,
              },
              { name: 'files', type: ['File'], isRequired: false, enums: null, reference: null },
              { name: 'payload', type: 'Json', isRequired: false, enums: null, reference: null },
              {
                name: 'tiers',
                type: ['Enum'],
                isRequired: false,
                enums: ['gold', 'silver'],
                reference: null,
              },
              { name: 'flags', type: 'Enum', isRequired: false, enums: [], reference: null },
              {
                name: 'assignee',
                type: 'Number',
                isRequired: false,
                enums: null,
                reference: 'users.id',
              },
              { name: 'levels', type: ['Number'], isRequired: false, enums: null, reference: null },
              {
                name: 'owner',
                type: 'Number',
                isRequired: true,
                enums: null,
                reference: 'users.id',
              },
            ],
          },
          { name: 'Mark-as-paid/done', fields: [] },
        ],
      },
      {
        name: 'orders',
        fields: { projectable: [], filterable: [], degraded: 'capabilities_unavailable' },
        primaryKeys: [
          { name: 'shop', type: 'String' },
          { name: 'number', type: 'Number' },
        ],
        relations: [{ name: 'buyers', foreignCollection: 'My Coll' }],
        actions: [],
      },
      {
        name: 'users.address',
        fields: {
          projectable: [{ name: 'street', type: 'String' }],
          filterable: [{ name: 'street', operators: ['Equal'] }],
          degraded: null,
        },
        primaryKeys: [],
        relations: [{ name: 'orders', foreignCollection: 'orders' }],
        actions: [],
      },
    ],
  };
}
