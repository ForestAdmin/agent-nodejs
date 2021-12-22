import {
  Collection,
  CollectionSchema,
  FieldTypes,
  RecordData,
  SchemaUtils,
} from '@forestadmin/datasource-toolkit';
import JsonApiSerializer from 'json-api-serializer';
import IdUtils from '../utils/id';

type SerializedRecord = { forestId: string };

export default class Serializer {
  // No need to keep references to serializers for outdated schemas => weakmap.
  private readonly serializers: WeakMap<CollectionSchema, JsonApiSerializer> = new WeakMap();
  private prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  serialize(collection: Collection, record: RecordData): unknown {
    const result = this.getSerializer(collection).serialize(collection.name, record);
    this.stripUndefinedsInPlace(result);

    return result;
  }

  deserialize(collection: Collection, data: unknown): RecordData {
    return this.getSerializer(collection).deserialize(collection.name, data);
  }

  private getSerializer(collection: Collection): JsonApiSerializer {
    if (!this.serializers.has(collection.schema)) {
      const serializer = new JsonApiSerializer();

      for (const sibling of collection.dataSource.collections) {
        this.registerCollection(sibling, serializer);
        this.serializers.set(sibling.schema, serializer);
      }
    }

    return this.serializers.get(collection.schema);
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

  private buildRelationshipsConfiguration(collection: Collection): {
    [key: string]: JsonApiSerializer.RelationshipOptions;
  } {
    const relationships = {};
    const urlPrefix = `${this.prefix}/${collection.name}`;

    for (const [name, field] of Object.entries(collection.schema.fields)) {
      if (field.type === FieldTypes.ManyToOne || field.type === FieldTypes.OneToOne) {
        relationships[name] = {
          type: field.foreignCollection,
          alternativeKey: field.foreignKey,
        };
      }

      if (field.type === FieldTypes.ManyToMany || field.type === FieldTypes.OneToMany) {
        relationships[name] = {
          type: field.foreignCollection,
          links: (data: SerializedRecord) => ({
            related: `${urlPrefix}/${data.forestId}/relationships/${name}`,
          }),
        };
      }
    }

    return relationships;
  }

  private stripUndefinedsInPlace(record: unknown): void {
    if (typeof record === 'object') {
      for (const key of Object.keys(record)) {
        if (record[key] === undefined) {
          delete record[key];
        } else {
          this.stripUndefinedsInPlace(record[key]);
        }
      }
    }
  }
}
