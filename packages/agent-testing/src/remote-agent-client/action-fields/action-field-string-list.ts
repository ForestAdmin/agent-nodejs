import ActionField from './action-field';

export default class ActionFieldStringList<TypingsSchema> extends ActionField<TypingsSchema> {
  async add(value: string) {
    const values = this.field?.getValue() as string[];
    await this.setValue([...(values || []), value]);
  }

  async remove(value: string) {
    const values = this.field?.getValue() as string[];
    if (values.includes(value)) throw new Error(`Value ${value} is not in the list`);

    await this.setValue((values || []).filter(val => val !== value));
  }
}
