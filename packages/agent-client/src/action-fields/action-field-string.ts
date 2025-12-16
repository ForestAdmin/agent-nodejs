import ActionField from './action-field';

export default class ActionFieldString<TypingsSchema> extends ActionField<TypingsSchema> {
  async fill(value?: number | string) {
    await this.setValue(this.isValueUndefinedOrNull(value) ? value : value.toString());
  }
}
