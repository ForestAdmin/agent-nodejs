import ActionField from './action-field';

export default class ActionFieldCheckbox<TypingsSchema> extends ActionField<TypingsSchema> {
  async check() {
    await this.setValue(true);
  }

  async uncheck() {
    await this.setValue(false);
  }
}
