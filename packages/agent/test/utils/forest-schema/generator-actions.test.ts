import { ActionFieldType, ActionSchemaScope, Collection } from '@forestadmin/datasource-toolkit';
import SchemaGeneratorActions from '../../../dist/utils/forest-schema/generator-actions';
import * as factories from '../../__factories__';

describe('SchemaGeneratorActions', () => {
  describe('Without form', () => {
    const collection = factories.collection.buildWithAction('Send email', {
      scope: ActionSchemaScope.Single,
      forceDownload: false,
    });

    test('should generate schema correctly', async () => {
      const schema = await SchemaGeneratorActions.buildSchema('/forest', collection, 'Send email');

      expect(schema).toStrictEqual({
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
        scope: ActionSchemaScope.Single,
        forceDownload: false,
        generateFormOnUsage: true,
      },
      {
        fields: [
          {
            label: 'label',
            description: 'email',
            type: ActionFieldType.String,
            enumValues: [],
            isRequired: true,
            isReadOnly: false,
            defaultValue: '',
            reloadOnChange: false,
          },
        ],
      },
    );

    test('should generate schema correctly', async () => {
      const schema = await SchemaGeneratorActions.buildSchema(
        '/forest',
        collection,
        'Send {} email',
      );

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
        scope: ActionSchemaScope.Single,
        forceDownload: false,
        generateFormOnUsage: false,
      },
      {
        fields: [
          {
            label: 'label',
            description: 'email',
            type: ActionFieldType.String,
            enumValues: [],
            isRequired: true,
            isReadOnly: false,
            defaultValue: '',
            reloadOnChange: true,
          },
        ],
      },
    );

    test('should include a reference to the change hook', async () => {
      const schema = await SchemaGeneratorActions.buildSchema('/forest', collection, 'Send email');
      expect(schema.fields[0].hook).toEqual('changeHook');
    });
  });

  describe('with special fields', () => {
    const dataSource = factories.dataSource.buildWithCollections([
      factories.collection.buildWithAction(
        'Send email',
        {
          scope: ActionSchemaScope.Single,
          forceDownload: false,
          generateFormOnUsage: false,
        },
        {
          fields: [
            {
              label: 'author',
              description: 'choose an author',
              type: ActionFieldType.Collection,
              enumValues: [],
              isRequired: true,
              isReadOnly: false,
              defaultValue: '',
              reloadOnChange: false,
              collectionName: 'authors',
            },
            {
              label: 'avatar',
              description: 'choose an avatar',
              type: ActionFieldType.File,
              enumValues: [],
              isRequired: true,
              isReadOnly: false,
              defaultValue: '',
              reloadOnChange: false,
            },
            {
              label: 'inclusive gender',
              description: 'Choose None, Male, Female or Both',
              type: ActionFieldType.EnumList,
              enumValues: ['Male', 'Female'],
              isRequired: true,
              isReadOnly: false,
              defaultValue: '',
              reloadOnChange: false,
            },
          ],
        },
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
      const schema = await SchemaGeneratorActions.buildSchema('/forest', collection, 'Send email');

      // Relation to other collection
      expect(schema.fields[0]).toMatchObject({
        field: 'author',
        position: 0,
        reference: 'authors.primaryId',
        widget: 'belongsto select', // only for relations
        type: 'Uuid', // type of the pk
      });

      // File
      expect(schema.fields[1]).toMatchObject({
        field: 'avatar',
        position: 1,
        reference: null,
        type: 'String',
        widget: 'file picker',
      });

      // List
      expect(schema.fields[2]).toMatchObject({
        field: 'inclusive gender',
        position: 2,
        reference: null,
        type: ['Enum'],
        enums: ['Male', 'Female'],
        widget: null,
      });
    });
  });
});
