import type { PlainField } from './types';

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

  // Agents emit list types as ['File'] / ['String'] but loadChanges echoes plainField back to
  // them verbatim, so the wire shape is normalized here for dispatch rather than in place.
  getType(): string {
    const { type } = this.plainField;

    return Array.isArray(type) ? `${type[0]}List` : type;
  }
}
