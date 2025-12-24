import ActionField from './action-field';

export default class ActionFieldDate extends ActionField {
  async fill(value?: number | Date) {
    await this.setValue(this.isValueUndefinedOrNull(value) ? value : new Date(value).toISOString());
  }
}
