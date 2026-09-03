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
   * The declared type as a single name, `['File']` becoming `'FileList'`. For dispatching on the
   * declared type — the Enum branch of getActionForm — never for anything that goes back to an
   * agent, which echoes `plainField` verbatim through loadChanges and matches only the array form.
   */
  getTypeName(): string {
    const { type } = this.plainField;

    return Array.isArray(type) ? `${type[0]}List` : type;
  }

  /**
   * What the field really holds, and what a reader is told. A v1 liana has no File type in its
   * action forms: it declares a file input as a String and says so only through the widget, so a
   * declared type read on its own would miss it. Use this to report a type or to encode a value;
   * use getTypeName when the declared type is what matters.
   */
  getEffectiveTypeName(): string {
    const typeName = this.getTypeName();
    const hasFilePickerWidget = this.plainField.widgetEdit?.name === 'file picker';

    if (hasFilePickerWidget && typeName === 'String') return 'File';
    if (hasFilePickerWidget && typeName === 'StringList') return 'FileList';

    return typeName;
  }
}
