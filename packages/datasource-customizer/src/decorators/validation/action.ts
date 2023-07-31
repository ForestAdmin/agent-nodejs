import Ajv from 'ajv';
import ajvErrors from 'ajv-errors';
import ajvKeywords from 'ajv-keywords';

import {
  ActionConfigurationValidationError,
  ActionFieldConfigurationValidationError,
} from '../../errors';
import { ActionDefinition, actionSchema } from '../actions/types/actions';
import { DynamicField, fieldActionSchema } from '../actions/types/fields';

const ajv = new Ajv({ allErrors: true });
ajvErrors(ajv); // NOTICE: this library adds support for custom invalidity error messages.
// ex: errorMessage: 'should either by an array of string or a function' ;
ajvKeywords(ajv); // NOTICE: this library adds support for 'typeof' validation keyword, which allows
// to test if the objects passed are functions (ex: {typeof: 'function'})

export default class ActionValidator {
  static validateActionConfiguration(name: string, action: ActionDefinition) {
    const validate = ajv.compile(actionSchema);
    if (!validate(action))
      throw new ActionConfigurationValidationError(
        name,
        this.getValidationErrorMessage(validate.errors),
      );

    try {
      action.form?.forEach(field => {
        this.validateActionFieldConfiguration(field);
      });
    } catch (error) {
      if (error instanceof ActionFieldConfigurationValidationError) {
        throw new ActionConfigurationValidationError(name, `\n${error.message}`);
      }

      throw error;
    }
  }

  private static validateActionFieldConfiguration(field: DynamicField) {
    const validate = ajv.compile(fieldActionSchema(field.type));
    const { label } = field;
    if (!validate(field))
      throw new ActionFieldConfigurationValidationError(
        label,
        this.getValidationErrorMessage(validate.errors),
      );
  }

  private static getValidationErrorMessage(errors) {
    if (!errors || !errors.length) return '';

    const error = errors[0];
    const params = ['additionalProperty', 'allowedValues'].map(key =>
      error.params[key] ? `(${error.params[key]})` : '',
    );

    return `\n${error.instancePath ? `${error.instancePath} ` : ''}${error.message} ${params} `;
  }
}
