import FieldFormStates from './field-form-states';

export default abstract class ActionField<TypingsSchema> {
  private readonly fieldsFormStates: FieldFormStates<TypingsSchema>;
  protected readonly name: string;

  constructor(name: string, fieldsFormStates: FieldFormStates<TypingsSchema>) {
    this.name = name;
    this.fieldsFormStates = fieldsFormStates;
  }

  protected get field() {
    return this.fieldsFormStates.getField(this.name);
  }

  getName(): string {
    return this.name;
  }

  getType(): string {
    return this.field?.getType();
  }

  getValue() {
    return this.field?.getValue();
  }

  isRequired() {
    return this.field?.getPlainField().isRequired;
  }

  getMultipleChoiceField() {
    return this.fieldsFormStates.getMultipleChoiceField(this.name);
  }

  protected isValueUndefinedOrNull(value: any): boolean {
    return value === undefined || value === null;
  }

  protected async setValue(value: unknown) {
    await this.fieldsFormStates.setFieldValue(this.name, value);
  }
}
