import ActionField from './action-field';
import { PlainFieldOption } from './types';

export default class ActionFieldCheckboxGroup<TypingsSchema> extends ActionField<TypingsSchema> {
  getOptions(): PlainFieldOption[] | undefined {
    return this.getMultipleChoiceField().getOptions();
  }

  async check(option: string) {
    const field = this.getMultipleChoiceField();
    await this.setValue([...((field.getValue() || []) as string[]), field.getOption(option).value]);
  }

  async uncheck(option: string) {
    const field = this.getMultipleChoiceField();
    const checkedValues = (field.getValue() as string[]) || [];
    const { value } = field.getOption(option);

    await this.setValue(checkedValues.filter(checkedValue => value !== checkedValue));
  }
}
