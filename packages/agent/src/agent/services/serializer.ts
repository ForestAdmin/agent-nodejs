import {
  Collection,
  CollectionSchema,
  RecordData,
  SchemaUtils,
} from '@forestadmin/datasource-toolkit';
import JsonApiSerializer from 'json-api-serializer';

import { AgentOptionsWithDefaults } from '../types';
import IdUtils from '../utils/id';

type SerializedRecord = { forestId: string };
type SerializerOptions = Pick<AgentOptionsWithDefaults, 'prefix'>;

export default class Serializer {
  // No need to keep references to serializers for outdated schemas => weakmap.
  private readonly serializers: WeakMap<CollectionSchema, JsonApiSerializer> = new WeakMap();
  private prefix: string;

  constructor(options: SerializerOptions) {
    this.prefix = options.prefix;
  }

  serialize(collection: Collection, data: RecordData | RecordData[]): unknown {
    const result = this.getSerializer(collection).serialize(collection.name, data);
    this.stripUndefinedsInPlace(result);

    return result;
  }

  deserialize(collection: Collection, body: unknown): RecordData {
    return this.getSerializer(collection).deserialize(collection.name, body);
  }

  private getSerializer(collection: Collection): JsonApiSerializer {
    if (this.serializers.has(collection.schema)) {
      return this.serializers.get(collection.schema);
    }

    const serializer = new JsonApiSerializer();

    for (const sibling of collection.dataSource.collections) {
      this.registerCollection(sibling, serializer);
      this.serializers.set(sibling.schema, serializer);
    }

    return serializer;
  }

  private registerCollection(collection: Collection, serializer: JsonApiSerializer): void {
    serializer.register(collection.name, {
      id: 'forestId',
      relationships: this.buildRelationshipsConfiguration(collection),
      beforeSerialize: (data: Record<string, unknown>) => {
        const copy = { ...data };
        copy.forestId = IdUtils.packId(collection.schema, data);

        return copy;
      },
      afterDeserialize: (data: Record<string, unknown>) => {
        const copy = { ...data };

        if (data.forestId) {
          const parts = IdUtils.unpackId(collection.schema, data.forestId as string);
          const primaryKeys = SchemaUtils.getPrimaryKeys(collection.schema);
          primaryKeys.forEach((field, index) => {
            copy[field] = parts[index];
          });
        }

        delete copy.forestId;

        return copy;
      },
    });
  }

  private buildRelationshipsConfiguration(
    collection: Collection,
  ): Record<string, JsonApiSerializer.RelationshipOptions> {
    const relationships: Record<string, JsonApiSerializer.RelationshipOptions> = {};
    const urlPrefix = `${this.prefix}/${collection.name}`;

    for (const [name, field] of Object.entries(collection.schema.fields)) {
      if (field.type === 'ManyToOne' || field.type === 'OneToOne') {
        relationships[name] = {
          type: field.foreignCollection,
          deserialize: (data: Record<string, unknown>) => {
            const foreignCollection = collection.dataSource.getCollection(field.foreignCollection);

            return IdUtils.unpackId(foreignCollection.schema, data.id as string);
          },
        };
      }

      if (field.type === 'ManyToMany' || field.type === 'OneToMany') {
        relationships[name] = {
          type: field.foreignCollection,
          links: (data: SerializedRecord) => ({
            related: {
              href: `${urlPrefix}/${data.forestId}/relationships/${name}`,
            },
          }),
        };
      }
    }

    return relationships;
  }

  private stripUndefinedsInPlace(record: unknown): void {
    if (record === null || typeof record !== 'object') {
      return;
    }

    const indexable = record as Record<string, unknown>;

    for (const key of Object.keys(indexable)) {
      if (indexable[key] === undefined) {
        delete indexable[key];
      } else {
        this.stripUndefinedsInPlace(indexable[key]);
      }
    }
  }
}
