import type {
  CollectionSchema,
  ManyToOneSchema,
  OneToOneSchema,
} from '@forestadmin/datasource-toolkit';

import { CollectionDecorator, SchemaUtils, ValidationError } from '@forestadmin/datasource-toolkit';

/**
 * This decorator allows to override parts of the collections schema.
 * It can be used to toggle off collection level capabilities for performance
 * (for now, list-view counts and the search bar), or to hide filtering on fields
 * that decorators below still rely on (e.g. 'In' on a custom relation key).
 */
export default class SchemaCollectionDecorator extends CollectionDecorator {
  private schemaOverride: Partial<CollectionSchema> = {};
  private unfilterableFields = new Set<string>();

  overrideSchema(value: Partial<CollectionSchema>): void {
    Object.assign(this.schemaOverride, value);
    this.markSchemaAsDirty();
  }

  disableFieldFiltering(name: string): void {
    const field = SchemaUtils.getField(this.childCollection.schema, name, this.name);

    if (field.type === 'OneToMany' || field.type === 'ManyToMany') {
      throw new ValidationError(
        `Unexpected field type: '${this.name}.${name}' ` +
          `(found '${field.type}' expected 'Column', 'ManyToOne' or 'OneToOne')`,
      );
    }

    if (field.type === 'Column' && field.isPrimaryKey) {
      throw new ValidationError(`Cannot disable filtering on primary key '${this.name}.${name}'`);
    }

    this.unfilterableFields.add(name);
    this.markSchemaAsDirty();
  }

  protected override refineSchema(subSchema: CollectionSchema): CollectionSchema {
    const schema = { ...subSchema, ...this.schemaOverride };
    const fields = { ...schema.fields };

    for (const name of this.unfilterableFields) {
      const field = fields[name];

      // Empty Set rather than undefined: FilterFactory calls filterOperators.has() unguarded
      fields[name] =
        field.type === 'Column'
          ? { ...field, filterOperators: new Set() }
          : { ...(field as ManyToOneSchema | OneToOneSchema), isFilterable: false };
    }

    return { ...schema, fields };
  }
}
