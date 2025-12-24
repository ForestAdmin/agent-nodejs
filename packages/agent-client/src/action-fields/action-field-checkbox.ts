import ActionField from './action-field';

export default class ActionFieldCheckbox extends ActionField {
  async check() {
    await this.setValue(true);
  }

  async uncheck() {
    await this.setValue(false);
  }
}
