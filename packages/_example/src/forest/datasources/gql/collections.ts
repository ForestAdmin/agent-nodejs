import { CollectionReplicaSchema, LeafField } from '@forestadmin/datasource-replica';

export default class GQLCollectionSchema implements CollectionReplicaSchema {
  readonly name: string;
  private _fields: Record<string, LeafField>;
  readonly relationFields: Record<string, LeafField>;
  readonly queryName: string;
  readonly queryFields: string[];
  readonly queryRelations: Record<string, GQLCollectionSchema>;

  constructor(name: string, fields: Record<string, LeafField>, queryName: string) {
    this.name = name;
    this._fields = fields;
    this.relationFields = {};
    this.queryName = queryName;
    this.queryFields = Object.keys(this._fields);
    this.queryRelations = {};
  }

  getRelationIdentifier(relationName: string) {
    return `${relationName}_id`;
  }

  addRelation(fieldDefinition: LeafField, targetCollection: GQLCollectionSchema) {
    const { relationName } = fieldDefinition.reference;

    this.relationFields[this.getRelationIdentifier(relationName)] = fieldDefinition;
    this.queryRelations[relationName] = targetCollection;
  }

  get allQueryFields() {
    const relationQueryFields = Object.entries(this.queryRelations).map(
      ([relationName, collection]) => `${relationName} { ${collection.queryFields} }`,
    );

    return this.queryFields.concat(relationQueryFields);
  }

  get query() {
    return `${this.queryName} { ${this.allQueryFields} }`;
  }

  get fields() {
    return {
      ...this._fields,
      ...this.relationFields,
    };
  }
}
