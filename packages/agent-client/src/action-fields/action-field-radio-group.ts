import ActionField from './action-field';
import { PlainFieldOption } from './types';

export default class ActionFieldRadioGroup extends ActionField {
  async getOptions(): Promise<PlainFieldOption[] | undefined> {
    return this.getMultipleChoiceField().getOptions();
  }

  async check(option: string): Promise<void> {
    await this.setValue(this.getMultipleChoiceField().getOption(option).value);
  }
}
