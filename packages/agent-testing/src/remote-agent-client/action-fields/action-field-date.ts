import ActionField from './action-field';

export default class ActionFieldDate<TypingsSchema> extends ActionField<TypingsSchema> {
  async fill(value?: number | Date) {
    await this.setValue(this.isValueUndefinedOrNull(value) ? value : new Date(value).toISOString());
  }
}
