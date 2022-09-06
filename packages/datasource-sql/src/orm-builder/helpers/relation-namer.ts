import { plural, singular } from 'pluralize';

import { Relation } from '../types';
import { Table } from '../../introspection/types';

export default class RelationNamer {
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
      const conflictsWithTable = name === table.name;
      const conflictsWithColumn = !!table.columns.find(c => c.name === name);
      const conflictsWithOtherRelation = indexes.length > 1;

      if (conflictsWithColumn || conflictsWithTable || conflictsWithOtherRelation) {
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

    if (foreignKey?.length > 3 && foreignKey?.endsWith('_id'))
      name = foreignKey.substring(0, foreignKey.length - 3);

    if (foreignKey?.length > 2 && foreignKey?.endsWith('Id'))
      name = foreignKey.substring(0, foreignKey.length - 2);

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
