import ActionField from './action-field';

export default class ActionFieldFile extends ActionField {
  async fill(file?: { mimeType: string; buffer: Buffer; name: string; charset?: string }) {
    if (this.isValueUndefinedOrNull(file)) {
      await this.setValue(file);

      return;
    }

    await this.setValue(ActionFieldFile.makeDataUri(file));
  }

  protected static makeDataUri(file: {
    mimeType: string;
    buffer: Buffer;
    name: string;
    charset?: string;
  }): string {
    const { mimeType, buffer, ...rest } = file;
    const mediaTypes = Object.entries(rest)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join(';');

    return mediaTypes.length
      ? `data:${mimeType};${mediaTypes};base64,${buffer.toString('base64')}`
      : `data:${mimeType};base64,${buffer.toString('base64')}`;
  }
}
