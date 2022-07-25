import { ModelDefined } from 'sequelize/types';
import SequelizeModelAttributes from './sequelize-model-attributes';

export default function unAmbigousField(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: ModelDefined<any, any>,
  field: string,
  unAmbigous = false,
) {
  const isRelation = field.includes(':');

  let safeField: string;

  if (isRelation) {
    const paths = field.split(':');
    const relationFieldName = paths.pop();
    const fieldName = paths
      .reduce((acc, path) => acc.associations[path].target, model)
      .getAttributes()[relationFieldName].field;
    safeField = `${paths.join('.')}.${fieldName}`;
  } else {
    safeField = SequelizeModelAttributes.getAttributes(model)[field].field;
    if (unAmbigous) safeField = `${model.name}.${safeField}`;
  }

  return safeField;
}
