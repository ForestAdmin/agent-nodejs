export default class FieldNameGenerator {
  static generateManyToOneRelationName(fieldName: string, modelName: string): string {
    return `${fieldName}__${modelName.split('_').pop()}__manyToOne`;
  }

  static generateOneToOneRelationName(fieldName: string, modelName: string): string {
    return `${fieldName.split('.').shift()}__${modelName.split('_').pop()}__oneToOne`;
  }

  static generateOneToMany(foreignCollectionName: string, foreignKey: string): string {
    return `${foreignCollectionName}__${foreignKey}__oneToMany`;
  }

  static generateThroughFieldName(
    modelName: string,
    foreignCollectionName: string,
    fieldName: string,
  ): string {
    return `${modelName}__${foreignCollectionName}__${fieldName}`;
  }

  static getOriginFieldNameOfIds(name: string) {
    return name.split('_').pop();
  }

  static generateManyToManyName(
    foreignCollectionName: string,
    originKey: string,
    throughCollection: string,
  ): string {
    return `${foreignCollectionName}__${originKey}__${this.getOriginFieldNameOfIds(
      throughCollection,
    )}`;
  }

  static generateOneToOneName(fieldName: string, modelName: string): string {
    return `${modelName}__${fieldName.split('.').shift()}`;
  }

  static getOriginFromOneToOne(origin: string): string {
    return origin.split('__').pop();
  }

  static generateKey(name: string): string {
    return `${name}_id`;
  }
}
