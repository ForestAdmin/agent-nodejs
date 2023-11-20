/* eslint-disable @typescript-eslint/no-explicit-any */
import { Client } from '@elastic/elasticsearch';
import { MappingProperty } from '@elastic/elasticsearch/api/types';
import MockClient from '@elastic/elasticsearch-mock';
import { CollectionSchema } from '@forestadmin/datasource-toolkit';

import ModelElasticsearch from '../../src/model-builder/model';
import ModelToCollectionSchemaConverter from '../../src/utils/model-to-collection-schema-converter';
import TypeConverter from '../../src/utils/type-converter';

describe('Utils > ModelToCollectionSchemaConverter', () => {
  describe('convert', () => {
    const logger = () => {};

    const setup = (properties: Record<string, MappingProperty> = {}) => {
      const mockClient = new MockClient();
      const client = new Client({
        node: 'http://localhost:9200',
        Connection: mockClient.getConnection(),
      });

      const modelElasticsearch = new ModelElasticsearch(
        client,
        'test-collection',
        ['indexPattern'],
        ['alias'],
        {
          properties,
        },
      );

      return {
        modelElasticsearch,
      };
    };

    it('should fail with a null model', () => {
      expect(() =>
        ModelToCollectionSchemaConverter.convert(null as unknown as ModelElasticsearch, logger),
      ).toThrow('Invalid (null) model.');
    });

    it('should return an "empty" schema with an equally empty model', () => {
      const { modelElasticsearch } = setup();

      // "ID" column is added by Sequelize when no primary key is explicitely defined.
      const schema: CollectionSchema = {
        actions: {},
        charts: [],
        countable: true,
        fields: {
          _id: {
            columnType: 'String',
            filterOperators: TypeConverter.operatorsForId(),
            isPrimaryKey: true,
            isReadOnly: true,
            isSortable: false,
            validation: [],
            type: 'Column',
          },
        },
        searchable: false,
        segments: [],
      };

      expect(ModelToCollectionSchemaConverter.convert(modelElasticsearch, logger)).toEqual(schema);
    });

    it('should convert all model attributes to collection fields', () => {
      const { modelElasticsearch } = setup({
        myInteger: {
          type: 'integer',
        },
        myBoolean: {
          type: 'boolean',
        },
        myValue: {
          type: 'keyword',
        },
        myJson: {
          type: 'nested',
        },
        myDate: {
          type: 'date',
        },
        myText: {
          type: 'text',
        },
      });

      const schema: CollectionSchema = {
        actions: {},
        charts: [],
        countable: true,
        fields: {
          _id: {
            columnType: 'String',
            filterOperators: TypeConverter.operatorsForId(),
            isPrimaryKey: true,
            isReadOnly: true,
            isSortable: false,
            validation: [],
            type: 'Column',
          },
          myInteger: {
            columnType: 'Number',
            filterOperators: TypeConverter.operatorsForColumnType('Number'),
            isReadOnly: false,
            isSortable: true,
            validation: [],
            type: 'Column',
          },
          myBoolean: {
            columnType: 'Boolean',
            filterOperators: TypeConverter.operatorsForColumnType('Boolean'),
            isReadOnly: false,
            isSortable: true,
            validation: [],
            type: 'Column',
          },
          myValue: {
            columnType: 'String',
            filterOperators: TypeConverter.operatorsForColumnType('String'),
            isReadOnly: false,
            isSortable: true,
            validation: [],
            type: 'Column',
          },
          myText: {
            columnType: 'String',
            filterOperators: TypeConverter.operatorsForColumnType('String'),
            isReadOnly: false,
            isSortable: false,
            validation: [],
            type: 'Column',
          },
          myJson: {
            columnType: 'Json',
            filterOperators: TypeConverter.operatorsForColumnType('Json'),
            isReadOnly: false,
            isSortable: true,
            validation: [],
            type: 'Column',
          },
          myDate: {
            columnType: 'Date',
            filterOperators: TypeConverter.operatorsForColumnType('Date'),
            isReadOnly: false,
            isSortable: true,
            validation: [],
            type: 'Column',
          },
        },
        searchable: false,
        segments: [],
      };

      expect(ModelToCollectionSchemaConverter.convert(modelElasticsearch, logger)).toEqual(schema);
    });
  });
});
