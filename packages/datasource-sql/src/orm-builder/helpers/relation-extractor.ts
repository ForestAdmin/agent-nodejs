import { Table } from '../../introspection/types';
import { Relation } from '../types';

export default class RelationExtractor {
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
        if (!this.isJunctionTable(table)) {
          relations.push({
            type: this.isUnique(table, column.name) ? 'HasOne' : 'HasMany',
            from: constraint.table,
            to: table.name,
            originKey: column.name,
            originKeyTarget: constraint.column,
          });
        }
      }
    }

    return relations;
  }

  private static listIndirectRelations(table: Table): Relation[] {
    const relations: Relation[] = [];
    const columns = table.columns.filter(c => c.primaryKey && c.constraints.length === 1);

    if (this.isJunctionTable(table)) {
      for (const [column1, column2] of [
        [columns[0], columns[1]],
        [columns[1], columns[0]],
      ]) {
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
      }
    }

    return relations;
  }

  private static isJunctionTable(table: Table): boolean {
    return table.columns.filter(c => c.primaryKey && c.constraints.length === 1).length === 2;
  }

  private static isUnique(table: Table, columnName: string): boolean {
    return table.unique.some(u => u.length === 1 && u[0] === columnName);
  }
}
