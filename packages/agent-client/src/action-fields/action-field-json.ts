import ActionField from './action-field';

export default class ActionFieldJson extends ActionField {
  async fill(value?: object) {
    await this.setValue(value);
  }
}
