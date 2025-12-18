import ActionField from './action-field';
import { PlainFieldOption } from './types';

export default class ActionFieldDropdown<TypingsSchema> extends ActionField<TypingsSchema> {
  getOptions(): PlainFieldOption[] | undefined {
    return this.getMultipleChoiceField().getOptions();
  }

  async select(option: string): Promise<void> {
    await this.setValue(this.getMultipleChoiceField().getOption(option).value);
  }
}
