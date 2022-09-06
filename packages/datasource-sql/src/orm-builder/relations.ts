/* eslint-disable @typescript-eslint/no-explicit-any */
import { Logger } from '@forestadmin/datasource-toolkit';
import { ModelStatic, Sequelize } from 'sequelize';

import { Relation } from './types';
import { Table } from '../introspection/types';
import RelationExtracter from './helpers/relation-extractor';
import RelationNamer from './helpers/relation-namer';

export default class RelationBuilder {
  static defineRelations(sequelize: Sequelize, logger: Logger, tables: Table[]): void {
    for (const table of tables) {
      this.defineTableRelations(sequelize, logger, table, tables);
    }
  }

  private static defineTableRelations(
    sequelize: Sequelize,
    logger: Logger,
    table: Table,
    tables: Table[],
  ): void {
    const relations = RelationExtracter.listRelations(table.name, tables);
    const relationNames = RelationNamer.getUniqueRelationNames(table, relations);

    for (const [index, relation] of relations.entries()) {
      const as = relationNames[index];

      try {
        const sourceModel = sequelize.model(relation.from);
        const targetModel = sequelize.model(relation.to);

        this.defineRelation(sourceModel, targetModel, relation, as);
      } catch (e) {
        logger?.('Warn', `Skipping relation "${table.name}.${as}" because of error: ${e.message}`);
      }
    }
  }

  private static defineRelation(
    sourceModel: ModelStatic<any>,
    targetModel: ModelStatic<any>,
    relation: Relation,
    as: string,
  ): void {
    if (relation.type === 'BelongsTo') {
      sourceModel.belongsTo(targetModel, {
        as,
        foreignKey: relation.foreignKey,
        targetKey: relation.foreignKeyTarget,
      });
    } else if (relation.type === 'HasMany') {
      sourceModel.hasMany(targetModel, {
        as,
        foreignKey: relation.originKey,
        sourceKey: relation.originKeyTarget,
      });
    } else if (relation.type === 'BelongsToMany') {
      sourceModel.belongsToMany(targetModel, {
        as,
        through: relation.through,
        foreignKey: relation.foreignKey,
        targetKey: relation.foreignKeyTarget,
        otherKey: relation.originKey,
        sourceKey: relation.originKeyTarget,
      });
    } else if (relation.type === 'HasOne') {
      sourceModel.hasOne(targetModel, {
        as,
        foreignKey: relation.originKey,
        sourceKey: relation.originKeyTarget,
      });
    }
  }
}
