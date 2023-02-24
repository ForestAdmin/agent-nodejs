import { Collection } from '@forestadmin/datasource-toolkit';

export default {
  schema: {
    actions: {},
    charts: [],
    countable: true,
    fields: {
      id: {
        isPrimaryKey: true,
        type: 'Column',
        columnType: 'Number',
        filterOperators: {},
      },
      postId: {
        type: 'Column',
        columnType: 'Number',
        filterOperators: {},
      },
      name: {
        type: 'Column',
        columnType: 'String',
        filterOperators: {},
      },
      email: {
        type: 'Column',
        columnType: 'String',
        filterOperators: {},
      },
      body: {
        type: 'Column',
        columnType: 'String',
        filterOperators: {},
      },
      post: {
        type: 'ManyToOne',
        foreignCollection: 'post',
        foreignKey: 'postId',
        foreignKeyTarget: 'id',
      },
    },
    searchable: true,
    segments: ['pending'],
  },
} as unknown as Collection;
