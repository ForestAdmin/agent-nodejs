/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ModelDefined } from 'sequelize/types';

function getRealFieldName(model: ModelDefined<any, any>, fieldName: string) {
  const fields = model.getAttributes();
  const fieldModel = fields[fieldName]
    ? fields[fieldName]
    : Object.entries(fields)
        .filter(([, value]) => value.field === fieldName)
        .map(([, value]) => value)[0];

  return fieldModel.field;
}

export default function unAmbigousField(
  model: ModelDefined<any, any>,
  field: string,
  unAmbigous = false,
) {
  const isSafe = field.includes('.');
  const isRelation = field.includes(':');

  let safeField: string;

  if (isSafe) {
    safeField = field;
  } else if (isRelation) {
    const paths = field.split(':');
    const relationFieldName = paths.pop();
    const relatedModel = paths.reduce((acc, path) => acc.associations[path].target, model);
    const fieldName = getRealFieldName(relatedModel, relationFieldName);
    safeField = `${paths.join('.')}.${fieldName}`;
  } else {
    safeField = getRealFieldName(model, field);
    if (unAmbigous) safeField = `${model.name}.${safeField}`;
  }

  return safeField;
}
