import ActionField from './action-field';

export default class ActionFieldEnum extends ActionField {
  getOptions(): string[] | undefined {
    return this.field.getPlainField().enums;
  }

  async select(option: string) {
    if (!this.getOptions().some(o => o === option)) {
      throw new Error(`Option "${option}" not found in field "${this.name}"`);
    }

    await this.setValue(option);
  }
}
