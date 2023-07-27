/* eslint-disable max-classes-per-file */
import { ValidationError } from '@forestadmin/datasource-toolkit';

export class ActionConfigurationValidationError extends ValidationError {
  constructor(name: string, errorMessage: string) {
    super(`Error in action '${name}' configuration: ${errorMessage}`);
  }
}
export class ActionFieldConfigurationValidationError extends ValidationError {
  constructor(label: string, errorMessage: string) {
    super(`Error in action form configuration, field '${label}': ${errorMessage}`);
  }
}
