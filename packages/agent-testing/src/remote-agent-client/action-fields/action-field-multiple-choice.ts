import FieldGetter from './field-getter';
import { PlainFieldOption } from './types';

export default class ActionFieldMultipleChoice extends FieldGetter {
  getOptions(): PlainFieldOption[] | undefined {
    return this.getPlainField().widgetEdit?.parameters.static.options;
  }

  getOption(label: string): PlainFieldOption | undefined {
    const options = this.getOptions()?.find(o => o.label === label);
    if (!options) throw new Error(`Option "${label}" not found in field "${this.getName()}"`);

    return options;
  }
}
