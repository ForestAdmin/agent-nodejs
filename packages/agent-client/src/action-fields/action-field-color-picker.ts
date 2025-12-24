import ActionField from './action-field';

export default class ActionFieldColorPicker extends ActionField {
  async fill(value?: number | string) {
    await this.setValue(this.isValueUndefinedOrNull(value) ? value : value.toString());
  }

  async isOpacityEnable() {
    return Boolean(this.field?.getPlainField().widgetEdit.parameters.static.enableOpacity);
  }

  async getQuickPalette(): Promise<string[] | undefined> {
    return this.field?.getPlainField().widgetEdit.parameters.static.quickPalette;
  }
}
