import type { CollectionSchema, ColumnSchema } from '@forestadmin/datasource-toolkit';

import {
  CollectionDecorator,
  FieldValidator,
  ValidationError,
} from '@forestadmin/datasource-toolkit';

/**
 * This decorator allows to override parts of the collections schema.
 * It can be used to toggle off collection level capabilities for performance
 * (for now, list-view counts and the search bar), or to hide filter operators
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
    FieldValidator.validate(this, name);

    if ((this.childCollection.schema.fields[name] as ColumnSchema).isPrimaryKey) {
      throw new ValidationError(`Cannot disable filtering on primary key '${this.name}.${name}'`);
    }

    this.unfilterableFields.add(name);
    this.markSchemaAsDirty();
  }

  protected override refineSchema(subSchema: CollectionSchema): CollectionSchema {
    const fields = { ...subSchema.fields };

    // Empty Set rather than undefined: FilterFactory calls filterOperators.has() unguarded
    for (const name of this.unfilterableFields) {
      fields[name] = { ...(fields[name] as ColumnSchema), filterOperators: new Set() };
    }

    return { ...subSchema, fields, ...this.schemaOverride };
  }
}
