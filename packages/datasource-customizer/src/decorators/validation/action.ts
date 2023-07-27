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

export default class ActionValidator {
  static validateActionConfiguration(name: string, action: ActionDefinition) {
    ajvErrors(ajv);
    ajvKeywords(ajv);

    const validate = ajv.compile(actionSchema);
    const result = validate(action);

    if (!result)
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
    const result = validate(field);
    const { label } = field;
    if (!result)
      throw new ActionFieldConfigurationValidationError(
        label,
        this.getValidationErrorMessage(validate.errors),
      );
  }

  private static getValidationErrorMessage(errors) {
    if (!errors || !errors.length) return '';

    const error = errors[0];

    return `\n${error.instancePath ? `${error.instancePath} ` : ''}${error.message} ${
      error.params.additionalProperty ? `(${error.params.additionalProperty})` : ''
    } `;
  }
}
