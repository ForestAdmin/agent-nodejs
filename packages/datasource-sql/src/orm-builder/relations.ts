/* eslint-disable @typescript-eslint/no-explicit-any */
import { Logger } from '@forestadmin/datasource-toolkit';
import { Sequelize } from 'sequelize';

import { Table } from '../introspection/types';
import RelationExtractor from './helpers/relation-extractor';
import RelationNameGenerator from './helpers/relation-name-generator';
import { Relation } from './types';

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
    const relations = RelationExtractor.listRelations(table.name, tables);
    const relationNames = RelationNameGenerator.getUniqueRelationNames(table, relations);

    for (const [index, relation] of relations.entries()) {
      const as = relationNames[index];

      try {
        this.defineRelation(sequelize, relation, as);
      } catch (e) {
        logger?.('Warn', `Skipping relation "${table.name}.${as}" because of error: ${e.message}`);
      }
    }
  }

  private static defineRelation(sequelize: Sequelize, relation: Relation, as: string): void {
    const sourceModel = sequelize.model(relation.from);
    const targetModel = sequelize.model(relation.to);

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
        otherKey: relation.foreignKey,
        foreignKey: relation.originKey,
        targetKey: relation.foreignKeyTarget,
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
