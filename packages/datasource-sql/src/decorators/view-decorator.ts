import type { CollectionSchema } from '@forestadmin/datasource-toolkit';

import { CollectionDecorator, UnprocessableError } from '@forestadmin/datasource-toolkit';

export default class ViewDecorator extends CollectionDecorator {
  protected override refineSchema(subSchema: CollectionSchema): CollectionSchema {
    return {
      ...subSchema,

      fields: Object.entries(subSchema.fields).reduce(
        (fields, [fieldName, fieldSchema]) => ({
          ...fields,
          [fieldName]: {
            ...fieldSchema,
            isReadOnly: true,
          },
        }),
        {},
      ),
    };
  }

  override async create(): Promise<never> {
    throw new UnprocessableError('View is read-only');
  }

  override async update(): Promise<never> {
    throw new UnprocessableError('View is read-only');
  }

  override async delete(): Promise<never> {
    throw new UnprocessableError('View is read-only');
  }
}
