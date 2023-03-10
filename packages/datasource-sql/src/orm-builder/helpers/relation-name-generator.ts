import { plural, singular } from 'pluralize';

import { Table } from '../../introspection/types';
import { Relation } from '../types';

export default class RelationNameGenerator {
  static getUniqueRelationNames(table: Table, relations: Relation[]): string[] {
    const names = relations.map(this.getSimpleName);

    // Search for duplicates
    const indexesByName: Record<string, number[]> = {};

    for (let i = 0; i < names.length; i += 1) {
      indexesByName[names[i]] ??= [];
      indexesByName[names[i]].push(i);
    }

    // When a duplicate is found, use long names for all of them
    for (const [name, indexes] of Object.entries(indexesByName)) {
      // Legit conflicts we need to handle
      const conflictsWithColumn = !!table.columns.find(c => c.name === name);
      const conflictsWithOtherRelation = indexes.length > 1;

      // Workaround sequelize bugs
      // @see https://github.com/sequelize/sequelize/issues/8263
      const conflictsWithTable = name === table.name;
      const conflictsWithThroughTable = relations.find(r => r.through === name);

      if (
        conflictsWithColumn ||
        conflictsWithTable ||
        conflictsWithOtherRelation ||
        conflictsWithThroughTable
      ) {
        for (const index of indexes) {
          names[index] = this.getUniqueName(relations[index]);
        }
      }
    }

    return names;
  }

  private static getSimpleName(relation: Relation): string {
    const { foreignKey } = relation;
    let name = relation.to;

    for (const suffix of ['_id', 'Id']) {
      if (foreignKey?.length > suffix.length && foreignKey?.endsWith(suffix)) {
        name = foreignKey.substring(0, foreignKey.length - suffix.length);
      }
    }

    return relation.type === 'HasMany' || relation.type === 'BelongsToMany'
      ? plural(name)
      : singular(name);
  }

  private static getUniqueName(relation: Relation): string {
    switch (relation.type) {
      case 'BelongsTo':
        return `${singular(relation.to)}_through_${relation.foreignKey}`;
      case 'HasOne':
        return `${singular(relation.to)}_through_${relation.from}_${relation.originKey}`;
      case 'BelongsToMany':
        return `${plural(relation.to)}_through_${relation.through}`;
      case 'HasMany':
        return `${plural(relation.to)}_through_${relation.from}_${relation.originKey}`;
      default:
        throw new Error(`Invalid relation type ${relation.type}`);
    }
  }
}
