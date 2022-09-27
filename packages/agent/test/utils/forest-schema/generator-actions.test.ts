import { Collection } from '@forestadmin/datasource-toolkit';

import * as factories from '../../__factories__';
import SchemaGeneratorActions from '../../../src/utils/forest-schema/generator-actions';

describe('SchemaGeneratorActions', () => {
  describe('Without form', () => {
    const collection = factories.collection.buildWithAction('Send email', {
      scope: 'Single',
      generateFile: false,
      staticForm: true,
    });

    test('should generate schema correctly', async () => {
      const schema = await SchemaGeneratorActions.buildSchema(collection, 'Send email');

      expect(schema).toStrictEqual({
        id: 'books-0-send-email',
        name: 'Send email',
        baseUrl: null,
        download: false,
        endpoint: '/forest/_actions/books/0/send-email',
        fields: [],
        httpMethod: 'POST',
        redirect: null,
        type: 'single',
        hooks: {
          // No form => hooks are disabled
          load: false,
          change: ['changeHook'],
        },
      });
    });
  });

  describe('With no hooks', () => {
    const collection: Collection = factories.collection.buildWithAction(
      'Send {} email',
      {
        scope: 'Single',
        generateFile: false,
        staticForm: false,
      },
      [
        {
          label: 'label',
          description: 'email',
          type: 'String',
          enumValues: [],
          isRequired: true,
          isReadOnly: false,
          value: '',
          watchChanges: false,
        },
      ],
    );

    test('should generate schema correctly', async () => {
      const schema = await SchemaGeneratorActions.buildSchema(collection, 'Send {} email');

      // Invariants should be correctly set
      expect(schema).toMatchObject({
        baseUrl: null,
        httpMethod: 'POST',
        redirect: null,
        hooks: {
          change: ['changeHook'],
        },
      });

      // Load hook should be enabled
      expect(schema.hooks.load).toBeTruthy();

      // Slug should be generated from the name to yield an unique URL
      expect(schema).toHaveProperty('name', 'Send {} email');
      expect(schema).toHaveProperty('endpoint', '/forest/_actions/books/0/send-email');
    });
  });

  describe('with change hooks', () => {
    const collection: Collection = factories.collection.buildWithAction(
      'Send email',
      {
        scope: 'Single',
        generateFile: false,
        staticForm: true,
      },
      [
        {
          label: 'label',
          description: 'email',
          type: 'String',
          enumValues: [],
          isRequired: true,
          isReadOnly: false,
          value: '',
          watchChanges: true,
        },
      ],
    );

    test('should include a reference to the change hook', async () => {
      const schema = await SchemaGeneratorActions.buildSchema(collection, 'Send email');
      expect(schema.fields[0].hook).toEqual('changeHook');
    });
  });

  describe('with special fields', () => {
    const dataSource = factories.dataSource.buildWithCollections([
      factories.collection.buildWithAction(
        'Send email',
        {
          scope: 'Single',
          generateFile: false,
          staticForm: true,
        },
        [
          {
            label: 'author',
            description: 'choose an author',
            type: 'Collection',
            enumValues: [],
            isRequired: true,
            isReadOnly: false,
            value: null,
            watchChanges: false,
            collectionName: 'authors',
          },
          {
            label: 'avatar',
            description: 'choose an avatar',
            type: 'File',
            enumValues: [],
            isRequired: true,
            isReadOnly: false,
            value: null,
            watchChanges: false,
          },
          {
            label: 'inclusive gender',
            description: 'Choose None, Male, Female or Both',
            type: 'EnumList',
            enumValues: ['Male', 'Female'],
            isRequired: true,
            isReadOnly: false,
            value: null,
            watchChanges: false,
          },
        ],
      ),
      factories.collection.build({
        name: 'authors',
        schema: factories.collectionSchema.build({
          fields: {
            primaryId: factories.columnSchema.isPrimaryKey().build(),
          },
        }),
      }),
    ]);

    test('special fields should work', async () => {
      const collection = dataSource.getCollection('books');
      const schema = await SchemaGeneratorActions.buildSchema(collection, 'Send email');

      // Relation to other collection
      expect(schema.fields[0]).toMatchObject({
        field: 'author',
        reference: 'authors.primaryId',
        type: 'Uuid', // type of the pk
      });

      // File
      expect(schema.fields[1]).toMatchObject({
        field: 'avatar',
        type: 'File',
      });

      // List
      expect(schema.fields[2]).toMatchObject({
        field: 'inclusive gender',
        type: ['Enum'],
        enums: ['Male', 'Female'],
      });
    });
  });
});
