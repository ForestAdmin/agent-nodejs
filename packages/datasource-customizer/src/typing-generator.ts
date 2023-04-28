import {
  Collection,
  CollectionUtils,
  ColumnSchema,
  ColumnType,
  DataSource,
} from '@forestadmin/datasource-toolkit';
import { readFile, writeFile } from 'fs/promises';

export default class TypingGenerator {
  /**
   * Write types to disk at a given path.
   * This method read the file which is already there before overwriting so that customers
   * using equivalents to nodemon to not enter restart loops.
   */
  static async updateTypesOnFileSystem(
    dataSource: DataSource,
    typingsPath: string,
    typingsMaxDepth: number,
  ): Promise<void> {
    const newTypes = TypingGenerator.generateTypes(dataSource, typingsMaxDepth);
    let olderTypes: string | null = null;

    try {
      olderTypes = await readFile(typingsPath, { encoding: 'utf-8' });
    } catch (e) {
      if (e.code === 'ENOENT') olderTypes = null;
      else throw e;
    }

    if (newTypes !== olderTypes) {
      await writeFile(typingsPath, newTypes, { encoding: 'utf-8' });
    }
  }

  /**
   * Generates types on a string.
   */
  static generateTypes(dataSource: DataSource, maxDepth: number): string {
    const collections = [...dataSource.collections].sort((a, b) => a.name.localeCompare(b.name));

    return [
      `/* eslint-disable */`,
      'export type Schema = {',
      ...collections.map(collection =>
        [
          `  '${collection.name}': {`,
          this.getRow(collection),
          this.getRelations(collection),
          this.getFlatRelations(collection, maxDepth),
          '  };',
        ].join(`\n`),
      ),
      '};\n',
    ].join('\n');
  }

  private static getRow(collection: Collection): string {
    const content = Object.entries(collection.schema.fields).reduce((memo, [name, field]) => {
      return field.type === 'Column' ? [...memo, `      '${name}': ${this.getType(field)};`] : memo;
    }, []);

    return `    plain: {\n${content.join('\n')}\n    };`;
  }

  private static getRelations(collection: Collection): string {
    const content = Object.entries(collection.schema.fields).reduce((memo, [name, field]) => {
      if (field.type === 'ManyToOne' || field.type === 'OneToOne') {
        const relation = field.foreignCollection;

        return [
          ...memo,
          `      '${name}': Schema['${relation}']['plain'] & Schema['${relation}']['nested'];`,
        ];
      }

      return memo;
    }, []);

    return content.length ? `    nested: {\n${content.join('\n')}\n    };` : `    nested: {};`;
  }

  private static getFlatRelations(collection: Collection, maxDepth: number): string {
    const fields = this.getFieldsRec(collection, maxDepth, []);

    return fields.length
      ? `    flat: {\n      ${fields.join('\n      ')}\n    };`
      : `    flat: {};`;
  }

  private static getFieldsRec(
    collection: Collection,
    maxDepth: number,
    traversed: { c: Collection; r: string }[],
  ): string[] {
    const columns =
      traversed.length > 0
        ? Object.entries(collection.schema.fields)
            .filter(([, schema]) => schema.type === 'Column')
            .map(([name, schema]) => `'${name}': ${this.getType(schema as ColumnSchema)};`)
        : [];

    const relations = Object.entries(collection.schema.fields).reduce((memo, [name, schema]) => {
      if (schema.type !== 'ManyToOne' && schema.type !== 'OneToOne') return memo;

      const subCollection = collection.dataSource.getCollection(schema.foreignCollection);
      const inverse = CollectionUtils.getInverseRelation(collection, name);

      // Do not expand inverse relations, as those create useless cycles
      const expand =
        traversed.length < maxDepth &&
        !traversed.find(({ c, r }) => c === subCollection && r === inverse);
      if (!expand) return memo;

      // Manually expand the field type (cycles are not allowed in template literal types)
      return [
        ...memo,
        ...this.getFieldsRec(subCollection, maxDepth, [
          ...traversed,
          { c: collection, r: name },
        ]).map(f => `'${name}:${f.slice(1)}`),
      ];
    }, []);

    return [...columns, ...relations];
  }

  private static getType(field: { columnType: ColumnType; enumValues?: string[] }): string {
    if (Array.isArray(field.columnType)) {
      return `Array<${this.getType({
        columnType: field.columnType[0],
        enumValues: field.enumValues,
      })}>`;
    }

    if (field.columnType === 'Enum') {
      return field.enumValues?.map(v => `'${v.replace(/'/g, "\\'")}'`).join(' | ') ?? 'string';
    }

    if (typeof field.columnType === 'string') {
      return {
        Boolean: 'boolean',
        Binary: 'Buffer',
        Date: 'string',
        Dateonly: 'string',
        Json: 'any',
        Number: 'number',
        Point: '[number, number]',
        String: 'string',
        Timeonly: 'string',
        Uuid: 'string',
      }[field.columnType];
    }

    return `{${Object.entries(field.columnType)
      .map(([key, subType]) => `${key}: ${this.getType({ columnType: subType })}`)
      .join('; ')}}`;
  }
}
