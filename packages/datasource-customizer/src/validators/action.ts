import { ValidationError } from '@forestadmin/datasource-toolkit';
import Ajv from 'ajv'; // A library for validating JSON objects
import ajvErrors from 'ajv-errors';
import ajvKeywords from 'ajv-keywords';
import { z } from 'zod';
import errorMap from 'zod/lib/locales/en';
import { ErrorMessageOptions, generateError, generateErrorMessage } from 'zod-error';
import { fromZodError } from 'zod-validation-error';

import { ActionDefinition, actionSchema } from '../decorators/actions/types/actions';
import { DynamicField, fieldValidator } from '../decorators/actions/types/fields';
import {
  ActionConfigurationValidationError,
  ActionFieldConfigurationValidationError,
} from '../errors';

const ajv = new Ajv({ allErrors: true });
ajvErrors(ajv); // NOTICE: this library adds support for custom invalidity error messages.
// ex: errorMessage: 'should either be an array of string or a function' ;
ajvKeywords(ajv); // NOTICE: this library adds support for 'typeof' validation keyword, which allows
// to test if objects are functions (ex: {typeof: 'function'})

export default class ActionValidator {
  static validateActionConfiguration(name: string, action: ActionDefinition) {
    const validate = ajv.compile(actionSchema);
    //    if (!validate(action))
    //      throw new ActionConfigurationValidationError(
    //        name,
    //        this.getValidationErrorMessage(validate.errors),
    //      );

    try {
      action.form?.forEach(field => {
        this.validateActionFieldConfiguration(field as DynamicField);
      });
    } catch (error) {
      if (error instanceof ActionFieldConfigurationValidationError) {
        throw new ActionConfigurationValidationError(name, error.message);
      }

      throw error;
    }
  }

  private static validateActionFieldConfiguration(field: DynamicField) {
    if (!field.type || !fieldValidator[field.type])
      throw new ActionFieldConfigurationValidationError(
        field.label,
        'Invalid or missing action field type',
      );

    try {
      return fieldValidator[field.type].parse(field);
    } catch (error) {
      throw new ActionFieldConfigurationValidationError(field.label, fromZodError(error).message);
    }
  }

  private static getValidationErrorMessage(errors) {
    if (!errors || !errors.length) return '';

    const error = errors[0];
    const params = ['additionalProperty', 'allowedValues']
      .map(key => (error.params[key] ? ` (${error.params[key]})` : ''))
      .filter(Boolean);

    return `\n${error.instancePath ? `${error.instancePath} ` : ''}${error.message}:${params}`;
  }
}
