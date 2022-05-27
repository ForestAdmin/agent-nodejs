export default class NameFactory {
  static manyToOneRelationName(fieldName: string, modelName: string): string {
    return `${NameFactory.removeNestedPath(fieldName)}__${modelName.split('_').pop()}__manyToOne`;
  }

  static oneToOneRelationName(fieldName: string, modelName: string): string {
    return `${NameFactory.removeNestedPath(fieldName)}__${modelName.split('_').pop()}__oneToOne`;
  }

  static oneToMany(foreignCollectionName: string, foreignKey: string): string {
    return `${foreignCollectionName}__${foreignKey}__oneToMany`;
  }

  static getOriginFieldNameOfIds(name: string) {
    return NameFactory.removeNestedPath(name).split('_').pop();
  }

  static manyToManyName(
    modelName: string,
    foreignCollectionName: string,
    fieldName: string,
  ): string {
    return `${modelName}__${foreignCollectionName}__${this.getOriginFieldNameOfIds(fieldName)}`;
  }

  static getOriginFromOneToOne(origin: string): string {
    return origin.split('__').pop();
  }

  static generateKey(name: string): string {
    return `${name}_id`;
  }

  private static removeNestedPath(fieldName): string {
    return fieldName.split('.').shift();
  }
}
