/* eslint-disable import/prefer-default-export */
import type {
  ActionGlobal,
  CollectionCustomizer,
  DataSourceCustomizer,
} from '@forestadmin/datasource-customizer';

import renderers from './renderers';
import { Options } from './types';

function getFields(
  dataSource: DataSourceCustomizer,
  collection: CollectionCustomizer,
  remainingDepth: number,
): string[] {
  if (remainingDepth <= 0) return [];

  const result = [];

  for (const [name, field] of Object.entries(collection.schema.fields)) {
    if (field.type === 'Column') result.push(name);

    if (field.type === 'ManyToOne' || field.type === 'OneToOne') {
      const foreignCollection = dataSource.getCollection(field.foreignCollection);
      result.push(
        ...getFields(dataSource, foreignCollection, remainingDepth - 1).map(f => `${name}:${f}`),
      );
    }
  }

  return result;
}

function getForm(
  dataSource: DataSourceCustomizer,
  collection: CollectionCustomizer,
  options?: Options,
): ActionGlobal['form'] {
  const form: ActionGlobal['form'] = [];
  const projection = getFields(dataSource, collection, 2);

  if (!options?.filename)
    form.push({
      label: 'Filename',
      type: 'String',
      defaultValue: `${collection.name} - ${new Date().toISOString().substring(0, 10)}`,
    });

  if (!options?.format)
    form.push({
      label: 'Format',
      type: 'Enum',
      enumValues: Object.keys(renderers),
      defaultValue: Object.keys(renderers)[0],
    });

  if (!options?.fields)
    form.push({
      label: 'Fields',
      type: 'EnumList',
      enumValues: projection,
      // @fixme Using a change hook instead of default value to work around a frontend bug.
      // this line should be: `defaultValue: projection,`
      value: c => (c.formValues.Fields?.length ? c.formValues.Fields : projection),
    });

  return form;
}

export async function addExportAdvanced(
  dataSource: DataSourceCustomizer,
  collection: CollectionCustomizer,
  options?: Options,
): Promise<void> {
  const collections = collection ? [collection] : dataSource.collections;

  for (const c of collections) {
    c.addAction(options?.actionName ?? `Export ${c.name} (advanced)`, {
      scope: 'Global',
      generateFile: true,
      form: getForm(dataSource, c, options),
      execute: async (context, resultBuilder) => {
        const format = context.formValues.Format || options.format;
        const fields = context.formValues.Fields || options.fields;
        const filename = context.formValues.Filename || options.filename;

        const renderer = renderers[format];
        const records = await context.collection.list({}, fields);
        const excelFile = renderer.handler(records, fields);

        return resultBuilder.file(excelFile, `${filename}${format}`, renderer.mimeType);
      },
    });
  }
}
