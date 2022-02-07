import { Association, Sequelize } from 'sequelize';

import { CollectionSchema, FieldTypes } from '@forestadmin/datasource-toolkit';

export default class CollectionSchemaToModelRelationsConverter {
  public static convert(
    name: string,
    schema: CollectionSchema,
    sequelize: Sequelize,
  ): Association[] {
    const relations: Association[] = [];

    const sourceModel = sequelize.model(name);

    Object.values(schema.fields).forEach(field => {
      if (field.type === FieldTypes.Column) return;

      const targetModel = sequelize.model(field.foreignCollection);

      if (field.type === FieldTypes.ManyToMany) {
        relations.push(
          sourceModel.belongsToMany(targetModel, {
            through: field.throughCollection,
            otherKey: field.otherField,
          }),
          targetModel.belongsToMany(sourceModel, {
            through: field.throughCollection,
            foreignKey: field.foreignKey,
          }),
        );
      } else if (field.type === FieldTypes.ManyToOne) {
        relations.push(
          sourceModel.belongsTo(targetModel, { targetKey: field.foreignKey }),
          targetModel.hasOne(sourceModel),
        );
      } else if (field.type === FieldTypes.OneToMany) {
        relations.push(
          sourceModel.hasMany(targetModel, { foreignKey: field.foreignKey }),
          targetModel.belongsTo(sourceModel),
        );
      } else if (field.type === FieldTypes.OneToOne) {
        relations.push(
          sourceModel.hasOne(targetModel, { foreignKey: field.foreignKey }),
          targetModel.belongsTo(sourceModel),
        );
      }
    });

    return relations;
  }
}
