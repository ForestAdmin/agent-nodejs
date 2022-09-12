import { QueryTypes, Sequelize } from 'sequelize';

export default class ArrayTypeGetter {
  private readonly sequelize: Sequelize;
  private readonly fromArray: (arrayAsString: string) => string[];
  private readonly query = `
  SELECT
    (
      CASE
        WHEN e.udt_name = 'hstore' THEN e.udt_name
        ELSE e.data_type
      END
    ) || (
      CASE
        WHEN e.character_maximum_length IS NOT NULL THEN '(' || e.character_maximum_length || ')'
        ELSE ''
      END
    ) as "type",
    (
      SELECT
        array_agg(en.enumlabel)
      FROM
        pg_catalog.pg_type t
        JOIN pg_catalog.pg_enum en ON t.oid = en.enumtypid
      WHERE
        t.typname = e.udt_name
    ) AS "special"
  FROM
    INFORMATION_SCHEMA.columns c
    LEFT JOIN INFORMATION_SCHEMA.element_types e ON (
      (
        c.table_catalog,
        c.table_schema,
        c.table_name,
        'TABLE',
        c.dtd_identifier
      ) = (
        e.object_catalog,
        e.object_schema,
        e.object_name,
        e.object_type,
        e.collection_type_identifier
      )
    )
  WHERE
    table_name = :tableName
    AND c.column_name = :columnName
  ;
  `;

  constructor(sequelize: Sequelize) {
    this.sequelize = sequelize;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.fromArray = (this.sequelize.getQueryInterface().queryGenerator as any).fromArray;
  }

  async getType(
    tableName: string,
    columnName: string,
  ): Promise<{ type: string; special: string[] }> {
    const replacements = { tableName, columnName };

    const [{ type, special }] = await this.sequelize.query(this.query, {
      replacements,
      type: QueryTypes.SELECT,
    });

    return {
      type: type.toUpperCase(),
      special: special ? this.fromArray(special) : [],
    };
  }
}
