import JSONAPISerializer from 'json-api-serializer';

export interface JsonApiRelationshipOptionsExt extends JSONAPISerializer.RelationshipOptions {
  deserialize?: (data: Record<string, unknown>) => unknown;
}

export interface JsonApiOptionsExt extends JSONAPISerializer.Options {
  relationships: Record<string, JsonApiRelationshipOptionsExt>;
}
