import type SchemaDataSourceDecorator from './data-source';
import type { Field, LeafField } from '../../types';
import type { CollectionSchema, ColumnType } from '@forestadmin/datasource-toolkit';

import { CollectionDecorator } from '@forestadmin/datasource-toolkit';

import { isLeafField } from '../../types';

export default class SchemaCollectionDecorator extends CollectionDecorator {
  override dataSource: SchemaDataSourceDecorator;

  protected override refineSchema(subSchema: CollectionSchema): CollectionSchema {
    const baseFields = this.dataSource.getFields(this.name);
    const newSchema = { ...subSchema, fields: { ...subSchema.fields } };

    for (const [key, field] of Object.entries(newSchema.fields)) {
      if (field.type === 'Column') {
        const baseField = baseFields[key] as LeafField;
        newSchema.fields[key] = {
          ...field,
          columnType: this.computeType(baseField),
          isReadOnly: baseField.isReadOnly,
          defaultValue: baseField.defaultValue,
          validation: baseField.validation,
        };
      }
    }

    return newSchema;
  }

  private computeType(field: Field): ColumnType {
    if (isLeafField(field)) {
      return field.type === 'Integer' ? 'Number' : field.type;
    }

    if (Array.isArray(field)) {
      return [this.computeType(field[0])];
    }

    const entries = Object.entries(field).map(([key, value]) => [key, this.computeType(value)]);

    return Object.fromEntries(entries);
  }
}
