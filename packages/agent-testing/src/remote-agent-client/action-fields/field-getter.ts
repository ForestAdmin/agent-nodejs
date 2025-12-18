import { PlainField } from './types';

export default class FieldGetter {
  private readonly plainField: PlainField;

  constructor(plainField: PlainField) {
    this.plainField = plainField;
  }

  getPlainField(): PlainField {
    return this.plainField;
  }

  getValue(): unknown {
    return this.plainField.value;
  }

  getName(): string {
    return this.plainField.field;
  }

  getType(): string {
    return this.plainField.type;
  }
}
