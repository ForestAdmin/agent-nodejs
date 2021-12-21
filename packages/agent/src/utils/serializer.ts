import {
  Collection,
  CollectionSchema,
  FieldTypes,
  RecordData,
  SchemaUtils,
} from '@forestadmin/datasource-toolkit';
import JsonApiSerializer from 'json-api-serializer';
import { FrontendOptions } from '../types';
import IdUtils from './id';

type SerializedRecord = { forestId: string };

export default class Serializer {
  // No need to keep references to serializers for outdated schemas => weakmap.
  private static readonly serializers: WeakMap<CollectionSchema, JsonApiSerializer> = new WeakMap();

  static serialize(options: FrontendOptions, collection: Collection, record: RecordData): unknown {
    return Serializer.getSerializer(options, collection).serialize(collection.name, record);
  }

  static deserialize(options: FrontendOptions, collection: Collection, data: unknown): RecordData {
    return Serializer.getSerializer(options, collection).deserialize(collection.name, data);
  }

  private static getSerializer(
    options: FrontendOptions,
    collection: Collection,
  ): JsonApiSerializer {
    // Serializers are invalidated when the schema reference is changed.
    if (!Serializer.serializers.has(collection.schema)) {
      const serializer = new JsonApiSerializer();

      for (const sibling of collection.dataSource.collections) {
        Serializer.registerCollection(options, sibling, serializer);
        Serializer.serializers.set(sibling.schema, serializer);
      }
    }

    return Serializer.serializers.get(collection.schema);
  }

  private static registerCollection(
    options: FrontendOptions,
    collection: Collection,
    serializer: JsonApiSerializer,
  ): void {
    const serializerOptions: JsonApiSerializer.Options = {
      // links
      links: (data: SerializedRecord) => ({
        self: `${options.prefix}/${collection.name}/${data.forestId}`,
      }),

      // pack/unpack primary id
      id: 'forestId',
      beforeSerialize: (data: Record<string, unknown>) => {
        const copy = { ...data };
        copy.forestId = IdUtils.packId(collection, data);

        return copy;
      },
      afterDeserialize: (data: Record<string, unknown>) => {
        const copy = { ...data };

        if (data.forestId) {
          const parts = IdUtils.unpackId(collection, data.forestId as string);
          const primaryKeys = SchemaUtils.getPrimaryKeys(collection.schema);
          primaryKeys.forEach((field, index) => {
            copy[field] = parts[index];
          });
        }

        delete copy.forestId;

        return copy;
      },
    };

    // Relationships
    serializerOptions.relationships = {};

    for (const [name, field] of Object.entries(collection.schema.fields)) {
      if (field.type === FieldTypes.ManyToOne || field.type === FieldTypes.OneToOne) {
        serializerOptions.relationships[name] = {
          type: field.foreignCollection,
          alternativeKey: field.foreignKey,
        };
      }

      if (field.type === FieldTypes.ManyToMany || field.type === FieldTypes.OneToMany) {
        serializerOptions.relationships[name] = {
          type: field.foreignCollection,
          links: (data: SerializedRecord) => ({
            related: `${options.prefix}/${collection.name}/${data.forestId}/relationships/${name}`,
          }),
        };
      }
    }

    serializer.register(collection.name, serializerOptions);
  }
}
