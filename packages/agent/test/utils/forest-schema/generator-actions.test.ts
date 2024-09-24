import { Collection } from '@forestadmin/datasource-toolkit';

import SchemaGeneratorActions from '../../../src/utils/forest-schema/generator-actions';
import * as factories from '../../__factories__';

describe('SchemaGeneratorActions', () => {
  describe('Without form', () => {
    const collection = factories.collection.buildWithAction('Send email', {
      scope: 'Single',
      generateFile: false,
      staticForm: true,
      description: 'hello',
      submitButtonLabel: 'here we go',
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
        description: 'hello',
        submitButtonLabel: 'here we go',
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
          id: 'label',
          label: 'label',
          description: 'email',
          type: 'String',
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
          id: 'label',
          label: 'label',
          description: 'email',
          type: 'String',
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
      expect(schema.layout).toEqual(undefined);
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
            id: 'author',
            label: 'author',
            description: 'choose an author',
            type: 'Collection',
            isRequired: true,
            isReadOnly: false,
            value: null,
            watchChanges: false,
            collectionName: 'authors',
          },
          {
            id: 'avatar',
            label: 'avatar',
            description: 'choose an avatar',
            type: 'File',
            isRequired: true,
            isReadOnly: false,
            value: null,
            watchChanges: false,
          },
          {
            id: 'inclusive gender',
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
            primaryId: factories.columnSchema.uuidPrimaryKey().build(),
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
        label: 'author',
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

      // no layout in schema, only in hooks response
      expect(schema.layout).toEqual(undefined);
    });
  });

  describe('with widget', () => {
    it('should set the value null to widgetEdit if no widget is specified', async () => {
      const dataSource = factories.dataSource.buildWithCollections([
        factories.collection.buildWithAction(
          'Update title',
          {
            scope: 'Single',
            generateFile: false,
            staticForm: true,
          },
          [
            {
              id: 'title',
              label: 'title',
              description: 'updated title',
              type: 'String',
              isRequired: true,
              isReadOnly: false,
              value: null,
              watchChanges: false,
            },
          ],
        ),
      ]);

      const collection = dataSource.getCollection('books');

      const schema = await SchemaGeneratorActions.buildSchema(collection, 'Update title');

      expect(schema.fields[0]).toEqual({
        field: 'title',
        label: 'title',
        defaultValue: null,
        description: 'updated title',
        isReadOnly: false,
        isRequired: true,
        type: 'String',
      });
    });

    it('should generate the right configuration for dropdowns', async () => {
      const dataSource = factories.dataSource.buildWithCollections([
        factories.collection.buildWithAction(
          'Update format',
          {
            scope: 'Single',
            generateFile: false,
            staticForm: true,
          },
          [
            {
              id: 'format',
              label: 'format',
              description: 'new format',
              type: 'String',
              isRequired: true,
              isReadOnly: false,
              value: null,
              watchChanges: false,
              widget: 'Dropdown',
              options: [
                { label: 'Paperback', value: '1' },
                { label: 'Hardcover', value: '2' },
              ],
              search: 'static',
            },
          ],
        ),
      ]);

      const collection = dataSource.getCollection('books');

      const schema = await SchemaGeneratorActions.buildSchema(collection, 'Update format');

      expect(schema.fields[0]).toMatchObject({
        field: 'format',
        widgetEdit: {
          name: 'dropdown',
          parameters: {
            isSearchable: true,
            placeholder: null,
            static: {
              options: [
                { label: 'Paperback', value: '1' },
                { label: 'Hardcover', value: '2' },
              ],
            },
          },
        },
      });
    });
  });

  describe('buildFieldsAndLayout', () => {
    it('should compute the schema of layout elements', async () => {
      const dataSource = factories.dataSource.buildWithCollections([
        factories.collection.buildWithAction(
          'Update title',
          {
            scope: 'Single',
            generateFile: false,
            staticForm: true,
          },
          [
            {
              id: 'title',
              label: 'title',
              description: 'updated title',
              type: 'String',
              isRequired: true,
              isReadOnly: false,
              value: null,
              watchChanges: false,
            },
            {
              type: 'Layout',
              component: 'Separator',
            },
            {
              type: 'Layout',
              component: 'HtmlBlock',
              content: 'some text content',
            },
            {
              type: 'Layout',
              component: 'Row',
              fields: [
                {
                  id: 'description',
                  label: 'description',
                  type: 'String',
                  watchChanges: false,
                },
                {
                  id: 'address',
                  label: 'address',
                  type: 'String',
                  watchChanges: false,
                },
              ],
            },
          ],
        ),
      ]);

      const collection = dataSource.getCollection('books');

      const form = await collection.getForm(null, 'Update title');

      const schema = SchemaGeneratorActions.buildFieldsAndLayout(collection.dataSource, form);

      expect(schema.fields.length).toEqual(3);
      expect(schema.layout).toEqual([
        {
          component: 'input',
          fieldId: 'title',
        },
        { component: 'separator' },
        { component: 'htmlBlock', content: 'some text content' },
        {
          component: 'row',
          fields: [
            {
              component: 'input',
              fieldId: 'description',
            },
            {
              component: 'input',
              fieldId: 'address',
            },
          ],
        },
      ]);
    });
  });
});
