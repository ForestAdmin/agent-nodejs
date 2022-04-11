import { Sequelize } from 'sequelize';

import { CollectionSchema } from '@forestadmin/datasource-toolkit';

export default class CollectionSchemaToModelRelationsConverter {
  public static convert(name: string, schema: CollectionSchema, sequelize: Sequelize) {
    const relations = [];

    const sourceModel = sequelize.model(name);

    Object.entries(schema.fields).forEach(([fieldName, field]) => {
      if (field.type === 'Column') return;

      const targetModel = sequelize.model(field.foreignCollection);

      if (field.type === 'ManyToMany') {
        relations.push(
          sourceModel.belongsToMany(targetModel, {
            as: fieldName,
            through: field.throughCollection,
            foreignKey: field.originKey,
            targetKey: field.originKeyTarget,
            otherKey: field.foreignKey,
            sourceKey: field.foreignKeyTarget,
          }),
        );
      } else if (field.type === 'ManyToOne') {
        relations.push(
          sourceModel.belongsTo(targetModel, {
            as: fieldName,
            foreignKey: field.foreignKey,
            targetKey: field.foreignKeyTarget,
          }),
        );
      } else if (field.type === 'OneToMany') {
        relations.push(
          sourceModel.hasMany(targetModel, {
            as: fieldName,
            foreignKey: field.originKey,
            sourceKey: field.originKeyTarget,
          }),
        );
      } else if (field.type === 'OneToOne') {
        relations.push(
          sourceModel.hasOne(targetModel, {
            as: fieldName,
            foreignKey: field.originKey,
            sourceKey: field.originKeyTarget,
          }),
        );
      }
    });

    return relations;
  }
}
