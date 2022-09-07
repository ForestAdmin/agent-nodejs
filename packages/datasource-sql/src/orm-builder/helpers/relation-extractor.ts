import { Relation } from '../types';
import { Table } from '../../introspection/types';

export default class RelationExtracter {
  static listRelations(tableName: string, tables: Table[]): Relation[] {
    const relations: Relation[] = [];

    for (const table of tables) {
      relations.push(...this.listDirectRelations(table));
      relations.push(...this.listIndirectRelations(table));
    }

    return relations.filter(r => r.from === tableName);
  }

  private static listDirectRelations(table: Table): Relation[] {
    const relations: Relation[] = [];

    for (const column of table.columns) {
      for (const constraint of column.constraints) {
        relations.push({
          type: 'BelongsTo',
          from: table.name,
          to: constraint.table,
          foreignKey: column.name,
          foreignKeyTarget: constraint.column,
        });

        // Skip HasMany to junction tables
        if (!this.isJunctionTable(table))
          relations.push({
            type: column.unique ? 'HasOne' : 'HasMany',
            from: constraint.table,
            to: table.name,
            originKey: column.name,
            originKeyTarget: constraint.column,
          });
      }
    }

    return relations;
  }

  private static listIndirectRelations(table: Table): Relation[] {
    const relations: Relation[] = [];
    const columns = table.columns.filter(c => c.primaryKey && c.constraints.length === 1);

    if (columns.length === 2) {
      const [column1, column2] = columns;

      relations.push({
        type: 'BelongsToMany',
        from: column1.constraints[0].table,
        to: column2.constraints[0].table,
        through: table.name,
        originKey: column1.name,
        foreignKey: column2.name,
        originKeyTarget: column1.constraints[0].column,
        foreignKeyTarget: column2.constraints[0].column,
      });

      relations.push({
        type: 'BelongsToMany',
        from: column2.constraints[0].table,
        to: column1.constraints[0].table,
        through: table.name,
        originKey: column2.name,
        foreignKey: column1.name,
        originKeyTarget: column2.constraints[0].column,
        foreignKeyTarget: column1.constraints[0].column,
      });
    }

    return relations;
  }

  private static isJunctionTable(table: Table): boolean {
    return table.columns.filter(c => c.primaryKey && c.constraints.length === 1).length === 2;
  }
}
