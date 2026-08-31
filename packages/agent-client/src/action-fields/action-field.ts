import type FieldFormStates from './field-form-states';
import type { PlainField } from './types';

export default abstract class ActionField {
  private readonly fieldsFormStates: FieldFormStates;
  protected readonly name: string;

  constructor(name: string, fieldsFormStates: FieldFormStates) {
    this.name = name;
    this.fieldsFormStates = fieldsFormStates;
  }

  protected get field() {
    return this.fieldsFormStates.getField(this.name);
  }

  getName(): string {
    return this.name;
  }

  getType(): PlainField['type'] {
    return this.field?.getType();
  }

  getTypeName(): string {
    return this.field?.getTypeName();
  }

  getEffectiveTypeName(): string {
    return this.field?.getEffectiveTypeName();
  }

  getValue() {
    return this.field?.getValue();
  }

  isRequired() {
    return this.field?.getPlainField().isRequired;
  }

  getPlainField() {
    return this.field?.getPlainField();
  }

  getMultipleChoiceField() {
    return this.fieldsFormStates.getMultipleChoiceField(this.name);
  }

  protected isValueUndefinedOrNull(value: unknown): boolean {
    return value === undefined || value === null;
  }

  protected async setValue(value: unknown) {
    await this.fieldsFormStates.setFieldValue(this.name, value);
  }
}
