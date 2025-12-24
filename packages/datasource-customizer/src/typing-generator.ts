import type {
  Collection,
  ColumnSchema,
  ColumnType,
  DataSource,
  Logger,
  ManyToOneSchema,
  OneToOneSchema,
} from '@forestadmin/datasource-toolkit';

import { CollectionUtils } from '@forestadmin/datasource-toolkit';
import { readFile, writeFile } from 'fs/promises';

export default class TypingGenerator {
  private readonly options = {
    maxFieldsCount: 10_000,
  };

  constructor(private readonly logger: Logger, options: { maxFieldsCount?: number } = {}) {
    this.options.maxFieldsCount = options.maxFieldsCount ?? this.options.maxFieldsCount;
  }

  private static sortedEntries<T>(
    ...args: Parameters<typeof Object.entries<T>>
  ): ReturnType<typeof Object.entries<T>> {
    return Object.entries(...args).sort(([name1], [name2]) => name1.localeCompare(name2));
  }

  /**
   * Write types to disk at a given path.
   * This method read the file which is already there before overwriting so that customers
   * using equivalents to nodemon to not enter restart loops.
   */
  public async updateTypesOnFileSystem(
    dataSource: DataSource,
    typingsPath: string,
    typingsMaxDepth: number,
  ): Promise<void> {
    const newTypes = this.generateTypes(dataSource, typingsMaxDepth);
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
  public generateTypes(dataSource: DataSource, maxDepth: number): string {
    const collections = [...dataSource.collections].sort((a, b) => a.name.localeCompare(b.name));

    return [
      `/* eslint-disable */`,
      `import {`,
      `  CollectionCustomizer,`,
      `  TAggregation,`,
      `  TConditionTree,`,
      `  TPaginatedFilter,`,
      `  TPartialRow,`,
      `  TSortClause`,
      `} from '@forestadmin/agent';`,
      '',
      this.generateAliases(dataSource),
      '',
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

  private generateAliases(dataSource: DataSource): string {
    return dataSource.collections
      .flatMap(collection => {
        const name =
          collection.name.slice(0, 1).toUpperCase() +
          collection.name.slice(1).replace(/(_|-)[a-z]/g, match => match.slice(1).toUpperCase());

        return [
          `export type ${name}Customizer = CollectionCustomizer<Schema, '${collection.name}'>;`,
          `export type ${name}Record = TPartialRow<Schema, '${collection.name}'>;`,
          `export type ${name}ConditionTree = TConditionTree<Schema, '${collection.name}'>;`,
          `export type ${name}Filter = TPaginatedFilter<Schema, '${collection.name}'>;`,
          `export type ${name}SortClause = TSortClause<Schema, '${collection.name}'>;`,
          `export type ${name}Aggregation = TAggregation<Schema, '${collection.name}'>;`,
          '',
        ];
      })
      .join('\n');
  }

  private getRow(collection: Collection): string {
    const content = TypingGenerator.sortedEntries(collection.schema.fields).reduce(
      (memo, [name, field]) => {
        return field.type === 'Column'
          ? [...memo, `      '${name}': ${this.getStrictType(field)};`]
          : memo;
      },
      [],
    );

    return `    plain: {\n${content.join('\n')}\n    };`;
  }

  private getRelations(collection: Collection): string {
    const content = TypingGenerator.sortedEntries(collection.schema.fields).reduce(
      (memo, [name, field]) => {
        if (field.type === 'ManyToOne' || field.type === 'OneToOne') {
          const relation = field.foreignCollection;

          return [
            ...memo,
            `      '${name}': Schema['${relation}']['plain'] & Schema['${relation}']['nested'];`,
          ];
        }

        return memo;
      },
      [],
    );

    return content.length ? `    nested: {\n${content.join('\n')}\n    };` : `    nested: {};`;
  }

  private getFlatRelations(collection: Collection, maxDepth: number): string {
    const fields = this.getFieldsOnCollection(collection, maxDepth);

    return fields.length
      ? `    flat: {\n      ${fields.join('\n      ')}\n    };`
      : `    flat: {};`;
  }

  private getFieldsOnCollection(mainCollection: Collection, maxDepth: number): string[] {
    const result: string[] = [];

    const queue = [{ collection: mainCollection, depth: 0, prefix: '', traversed: [] }];

    while (queue.length > 0 && result.length < this.options.maxFieldsCount) {
      const { collection, depth, prefix, traversed } = queue.shift();
      const sortedFields = TypingGenerator.sortedEntries(collection.schema.fields);

      if (prefix) {
        result.push(
          ...sortedFields
            .filter(([, schema]) => schema.type === 'Column')
            .map(
              ([name, schema]) =>
                `'${prefix}:${name}': ${this.getStrictType(schema as ColumnSchema)};`,
            ),
        );
      }

      if (depth < maxDepth) {
        queue.push(
          ...sortedFields
            .filter(([, schema]) => schema.type === 'ManyToOne' || schema.type === 'OneToOne')
            .map(([name, schema]: [name: string, schema: OneToOneSchema | ManyToOneSchema]) => {
              return {
                subCollection: collection.dataSource.getCollection(schema.foreignCollection),
                inverse: CollectionUtils.getInverseRelation(collection, name),
                name,
                schema,
              };
            })
            .filter(({ subCollection, inverse }) => {
              // Do not expand inverse relations, as those create useless cycles
              return !traversed.find(({ c, r }) => c === subCollection && r === inverse);
            })
            .map(({ subCollection, name }) => {
              return {
                collection: subCollection,
                depth: depth + 1,
                prefix: prefix ? `${prefix}:${name}` : name,
                traversed: [...traversed, { c: collection, r: name }],
              };
            }),
        );
      }
    }

    if (queue.length || result.length >= this.options.maxFieldsCount) {
      this.logger?.(
        'Warn',
        `Fields generation stopped on collection ${mainCollection.name}, ` +
          `try using a lower typingsMaxDepth (${maxDepth}) to avoid this issue.`,
      );
    }

    return result.slice(0, this.options.maxFieldsCount);
  }

  private getStrictType(columnSchema: ColumnSchema): string {
    const isRequired =
      (columnSchema.validation?.some(v => v.operator === 'Present') ||
        columnSchema.isPrimaryKey ||
        columnSchema.allowNull === false) ??
      false;

    return `${this.getType(columnSchema)}${isRequired ? '' : ' | null'}`;
  }

  private getType(field: { columnType: ColumnType; enumValues?: string[] }): string {
    if (Array.isArray(field.columnType)) {
      return `Array<${this.getType({
        columnType: field.columnType[0],
        enumValues: field.enumValues,
      })}>`;
    }

    if (field.columnType === 'Enum') {
      if (field.enumValues === undefined) return 'string';

      return (
        [...field.enumValues]
          .sort((v1, v2) => v1.localeCompare(v2))
          .map(v => `'${v.replace(/'/g, "\\'")}'`)
          .join(' | ') ?? 'string'
      );
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
        Time: 'string',
        Uuid: 'string',
      }[field.columnType];
    }

    return `{${TypingGenerator.sortedEntries(field.columnType)
      .map(([key, subType]) => `'${key}': ${this.getType({ columnType: subType })}`)
      .join('; ')}}`;
  }
}
