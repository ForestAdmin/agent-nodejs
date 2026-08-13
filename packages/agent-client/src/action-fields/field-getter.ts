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

  /** Exactly what the agent sent: a list type is the array `['File']`, not `'FileList'`. */
  getType(): PlainField['type'] {
    return this.plainField.type;
  }

  /**
   * The same type as a single name, `['File']` becoming `'FileList'`. For dispatching on the type
   * and for reporting it to a reader; never for anything that goes back to an agent, which echoes
   * `plainField` verbatim through loadChanges and matches only the array form.
   */
  getTypeName(): string {
    const { type } = this.plainField;

    return Array.isArray(type) ? `${type[0]}List` : type;
  }
}
