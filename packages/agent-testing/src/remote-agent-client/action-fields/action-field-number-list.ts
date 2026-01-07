import ActionField from './action-field';

export default class ActionFieldNumberList<TypingsSchema> extends ActionField<TypingsSchema> {
  async add(value: number) {
    const values = this.field?.getValue() as number[];
    await this.setValue([...(values || []), value]);
  }

  async remove(value: number) {
    const values = this.field?.getValue() as number[];
    if (values.includes(value)) throw new Error(`Value ${value} is not in the list`);

    await this.setValue((values || []).filter(val => val !== value));
  }
}
