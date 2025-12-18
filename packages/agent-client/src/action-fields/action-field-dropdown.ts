import type { PlainFieldOption } from './types';

import ActionField from './action-field';

export default class ActionFieldDropdown<TypingsSchema> extends ActionField<TypingsSchema> {
  getOptions(): PlainFieldOption[] | undefined {
    return this.getMultipleChoiceField().getOptions();
  }

  async select(option: string): Promise<void> {
    await this.setValue(this.getMultipleChoiceField().getOption(option).value);
  }
}
