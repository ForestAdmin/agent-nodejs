import ActionField from './action-field';

export type FileInput = { mimeType: string; buffer: Buffer; name: string; charset?: string };

export default class ActionFieldFile extends ActionField {
  async fill(file?: FileInput | null) {
    if (this.isValueUndefinedOrNull(file)) {
      await this.setValue(file);

      return;
    }

    await this.setValue(ActionFieldFile.makeDataUri(file));
  }

  static makeDataUri(file: FileInput): string {
    const { mimeType, buffer, ...rest } = file;
    const params = Object.entries(rest)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join(';');

    return `data:${mimeType};${params};base64,${buffer.toString('base64')}`;
  }
}
